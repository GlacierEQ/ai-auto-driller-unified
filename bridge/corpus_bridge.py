#!/usr/bin/env python3
"""Local retrieval bridge for AI Auto-Driller.

Indexes organized AI conversation exports into a local SQLite FTS5 database and
serves the exact HTTP contract used by scripts/auto-driller-master.user.js:
POST http://127.0.0.1:8765/search

The source files are never modified. The SQLite database is a disposable derived
index that can be rebuilt at any time.
"""
from __future__ import annotations

import argparse
from contextlib import closing
import json
import os
import re
import sqlite3
import sys
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urlparse

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DEFAULT_REFRESH_SECONDS = 300
DEFAULT_MAX_FILE_BYTES = 64 * 1024 * 1024
DEFAULT_CHUNK_CHARS = 2400
DEFAULT_CHUNK_OVERLAP = 300
INDEX_SCHEMA_VERSION = "auto-driller-corpus-index/v1"
ALLOWED_SUFFIXES = {".md", ".txt", ".json", ".jsonl", ".html", ".htm"}
TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:/#-]{2,}")
GENERIC_COMMAND_TERMS = {
    "again", "better", "build", "continue", "do", "fix", "improve", "more",
    "next", "please", "plz", "rerun", "retry", "run", "same", "test", "that",
    "this", "update", "advance", "check", "it", "okay", "ok", "yep", "yes",
}
STOP_TERMS = {
    "about", "after", "also", "and", "are", "been", "but", "can", "could",
    "does", "for", "from", "have", "into", "just", "like", "more", "most",
    "not", "only", "should", "some", "than", "that", "the", "their", "them",
    "then", "there", "these", "they", "this", "using", "very", "was", "were",
    "what", "when", "where", "which", "while", "will", "with", "would", "your",
}


def _norm(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _tokens(text: str) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for match in TOKEN_RE.finditer(text.lower()):
        token = match.group(0).strip("._:/#-")
        if len(token) < 3 or token in STOP_TERMS or token in seen:
            continue
        seen.add(token)
        output.append(token)
    return output


def _is_weak_query(query: str, latest_user_text: str = "") -> bool:
    text = _norm(latest_user_text or query).lower()
    terms = [token for token in _tokens(text) if token not in GENERIC_COMMAND_TERMS]
    # One distinctive term is enough: "Yamatani", "corruption", "AutoDriller".
    return len(terms) == 0


def _fts_quote(term: str) -> str:
    return '"' + term.replace('"', '""') + '"'


def _build_fts_query(query: str, keywords: Sequence[str]) -> tuple[str, list[str]]:
    phrases: list[str] = []
    seen: set[str] = set()
    for raw in list(keywords) + _tokens(query):
        term = _norm(raw).strip("._:/#-")
        if len(term) < 3:
            continue
        key = term.lower()
        if key in STOP_TERMS or key in GENERIC_COMMAND_TERMS or key in seen:
            continue
        seen.add(key)
        phrases.append(term)
        if len(phrases) >= 16:
            break
    if not phrases:
        return "", []
    return " OR ".join(_fts_quote(term) for term in phrases), phrases


def _snippet(text: str, terms: Sequence[str], radius: int = 360) -> str:
    if not text:
        return ""
    lower = text.lower()
    positions = [lower.find(term.lower()) for term in terms if term and lower.find(term.lower()) >= 0]
    center = min(positions) if positions else 0
    start = max(0, center - radius)
    end = min(len(text), center + radius)
    out = text[start:end].strip()
    if start:
        out = "…" + out
    if end < len(text):
        out += "…"
    return _norm(out)


def _iter_chunks(text: str, chunk_chars: int, overlap: int) -> Iterable[tuple[int, int, str]]:
    if not text:
        return
    length = len(text)
    start = 0
    while start < length:
        hard_end = min(length, start + chunk_chars)
        end = hard_end
        if hard_end < length:
            # Prefer a paragraph or line boundary near the end of the target chunk.
            search_start = max(start + chunk_chars // 2, hard_end - 500)
            candidates = [text.rfind("\n\n", search_start, hard_end), text.rfind("\n", search_start, hard_end)]
            boundary = max(candidates)
            if boundary > start:
                end = boundary + 1
        chunk = text[start:end].strip()
        if chunk:
            yield start, end, chunk
        if end >= length:
            break
        start = max(start + 1, end - overlap)


def discover_roots(explicit_roots: Sequence[str] | None = None) -> list[Path]:
    candidates: list[Path] = []
    for raw in explicit_roots or []:
        if raw:
            candidates.append(Path(raw).expanduser())
    env_roots = os.environ.get("AUTO_DRILLER_CORPUS_ROOTS", "")
    if env_roots:
        candidates.extend(Path(item).expanduser() for item in env_roots.split(os.pathsep) if item)

    home = Path.home()
    candidates.extend(
        [
            home / "Library/CloudStorage/Dropbox/Cherry Chan/03_MASTER_STORAGE_AND_MEDIA_VAULTS/05_AI_CONVERSATION_EXPORTS",
            home / "Dropbox/Cherry Chan/03_MASTER_STORAGE_AND_MEDIA_VAULTS/05_AI_CONVERSATION_EXPORTS",
            home / "Library/CloudStorage/Dropbox/Cherry Chan/05_AI_CONVERSATION_EXPORTS",
            home / "Dropbox/Cherry Chan/05_AI_CONVERSATION_EXPORTS",
        ]
    )

    output: list[Path] = []
    seen: set[str] = set()
    for path in candidates:
        try:
            resolved = path.resolve()
        except OSError:
            continue
        key = os.path.normcase(str(resolved))
        if key in seen or not resolved.is_dir():
            continue
        seen.add(key)
        output.append(resolved)
    return output


@dataclass
class IndexStats:
    scanned_files: int = 0
    indexed_files: int = 0
    unchanged_files: int = 0
    removed_files: int = 0
    skipped_large_files: int = 0
    chunks_written: int = 0
    errors: int = 0

    def as_dict(self) -> dict[str, int]:
        return self.__dict__.copy()


class CorpusIndex:
    def __init__(
        self,
        db_path: Path,
        roots: Sequence[Path],
        *,
        max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
        chunk_chars: int = DEFAULT_CHUNK_CHARS,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        refresh_seconds: int = DEFAULT_REFRESH_SECONDS,
    ) -> None:
        self.db_path = Path(db_path).expanduser()
        self.roots = [Path(root).resolve() for root in roots]
        self.max_file_bytes = max_file_bytes
        self.chunk_chars = chunk_chars
        self.chunk_overlap = chunk_overlap
        self.refresh_seconds = refresh_seconds
        self._lock = threading.RLock()
        self._last_refresh_monotonic = 0.0
        self._last_stats = IndexStats()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self) -> None:
        with closing(self._connect()) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS documents (
                    path TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    mtime_ns INTEGER NOT NULL,
                    size INTEGER NOT NULL,
                    indexed_at REAL NOT NULL
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                    doc_path UNINDEXED,
                    title,
                    text,
                    tokenize='unicode61 remove_diacritics 2'
                );
                CREATE TABLE IF NOT EXISTS request_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_key TEXT NOT NULL,
                    at REAL NOT NULL,
                    raw_query TEXT NOT NULL,
                    effective_query TEXT NOT NULL,
                    strong INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS request_history_session_idx
                ON request_history(session_key, id DESC);
                """
            )
            conn.execute(
                "INSERT INTO metadata(key, value) VALUES('schema', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (INDEX_SCHEMA_VERSION,),
            )

    def _candidate_files(self) -> Iterable[Path]:
        for root in self.roots:
            if not root.is_dir():
                continue
            for path in root.rglob("*"):
                if path.is_file() and path.suffix.lower() in ALLOWED_SUFFIXES:
                    yield path

    def refresh(self, *, force: bool = False) -> IndexStats:
        stats = IndexStats()
        now = time.monotonic()
        if not force and now - self._last_refresh_monotonic < self.refresh_seconds:
            return self._last_stats

        with self._lock:
            now = time.monotonic()
            if not force and now - self._last_refresh_monotonic < self.refresh_seconds:
                return self._last_stats

            seen_paths: set[str] = set()
            with closing(self._connect()) as conn:
                existing = {
                    row["path"]: (row["mtime_ns"], row["size"])
                    for row in conn.execute("SELECT path, mtime_ns, size FROM documents")
                }

                for path in self._candidate_files():
                    stats.scanned_files += 1
                    try:
                        stat = path.stat()
                    except OSError:
                        stats.errors += 1
                        continue
                    canonical = str(path.resolve())
                    seen_paths.add(canonical)
                    if stat.st_size > self.max_file_bytes:
                        stats.skipped_large_files += 1
                        continue
                    if not force and existing.get(canonical) == (stat.st_mtime_ns, stat.st_size):
                        stats.unchanged_files += 1
                        continue
                    try:
                        text = path.read_text(encoding="utf-8", errors="replace")
                    except OSError:
                        stats.errors += 1
                        continue

                    conn.execute("DELETE FROM chunks_fts WHERE doc_path = ?", (canonical,))
                    title = path.stem
                    chunks = list(_iter_chunks(text, self.chunk_chars, self.chunk_overlap))
                    conn.executemany(
                        "INSERT INTO chunks_fts(doc_path, title, text) VALUES (?, ?, ?)",
                        [(canonical, title, chunk) for _, _, chunk in chunks],
                    )
                    conn.execute(
                        """
                        INSERT INTO documents(path, title, mtime_ns, size, indexed_at)
                        VALUES(?, ?, ?, ?, ?)
                        ON CONFLICT(path) DO UPDATE SET
                            title=excluded.title,
                            mtime_ns=excluded.mtime_ns,
                            size=excluded.size,
                            indexed_at=excluded.indexed_at
                        """,
                        (canonical, title, stat.st_mtime_ns, stat.st_size, time.time()),
                    )
                    stats.indexed_files += 1
                    stats.chunks_written += len(chunks)

                stale = [path for path in existing if path not in seen_paths]
                for canonical in stale:
                    conn.execute("DELETE FROM chunks_fts WHERE doc_path = ?", (canonical,))
                    conn.execute("DELETE FROM documents WHERE path = ?", (canonical,))
                    stats.removed_files += 1
                conn.commit()

            self._last_refresh_monotonic = time.monotonic()
            self._last_stats = stats
            return stats

    def _previous_strong_query(self, conn: sqlite3.Connection, session_key: str) -> str | None:
        row = conn.execute(
            "SELECT effective_query FROM request_history WHERE session_key = ? AND strong = 1 ORDER BY id DESC LIMIT 1",
            (session_key,),
        ).fetchone()
        if row:
            return str(row[0])
        row = conn.execute(
            "SELECT effective_query FROM request_history WHERE strong = 1 ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return str(row[0]) if row else None

    def _record_request(
        self,
        conn: sqlite3.Connection,
        *,
        session_key: str,
        raw_query: str,
        effective_query: str,
        strong: bool,
    ) -> None:
        conn.execute(
            "INSERT INTO request_history(session_key, at, raw_query, effective_query, strong) VALUES (?, ?, ?, ?, ?)",
            (session_key, time.time(), raw_query, effective_query, 1 if strong else 0),
        )
        # Keep the derived continuity cache bounded.
        conn.execute(
            "DELETE FROM request_history WHERE id NOT IN (SELECT id FROM request_history ORDER BY id DESC LIMIT 2000)"
        )

    def search(
        self,
        query: str,
        *,
        keywords: Sequence[str] | None = None,
        latest_user_text: str = "",
        platform: str = "unknown",
        page_url: str = "",
        limit: int = 6,
    ) -> dict[str, object]:
        self.refresh()
        raw_query = _norm(query)
        latest_user_text = _norm(latest_user_text)
        session_key = f"{platform}|{page_url}" if page_url else platform
        weak = _is_weak_query(raw_query, latest_user_text)

        with self._lock, closing(self._connect()) as conn:
            previous = self._previous_strong_query(conn, session_key) if weak else None
            effective_query = previous or raw_query or latest_user_text
            effective_keywords = list(keywords or [])
            if weak and previous:
                effective_keywords = []
            fts_query, terms = _build_fts_query(effective_query, effective_keywords)
            self._record_request(
                conn,
                session_key=session_key,
                raw_query=raw_query or latest_user_text,
                effective_query=effective_query,
                strong=not weak and bool(effective_query),
            )
            conn.commit()

            if not fts_query:
                return {
                    "matches": [],
                    "query": raw_query,
                    "effective_query": effective_query,
                    "continuity_from_previous": bool(previous),
                    "weak_query": weak,
                }

            fetch_limit = max(1, min(int(limit), 20)) * 5
            rows = conn.execute(
                """
                SELECT rowid, doc_path, title, text, bm25(chunks_fts, 0.0, 2.0, 1.0) AS rank
                FROM chunks_fts
                WHERE chunks_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_query, fetch_limit),
            ).fetchall()

        scored: list[dict[str, object]] = []
        seen_chunks: set[tuple[str, str]] = set()
        for row in rows:
            text = str(row["text"] or "")
            title = str(row["title"] or "")
            doc_path = str(row["doc_path"] or "")
            text_lower = text.lower()
            matched = [term for term in terms if term.lower() in text_lower or term.lower() in title.lower()]
            overlap = len({term.lower() for term in matched})
            phrase_bonus = 2 if effective_query and effective_query.lower() in text_lower else 0
            rank = float(row["rank"] or 0.0)
            score = overlap * 10 + phrase_bonus * 5 + max(0.0, -rank)
            snippet = _snippet(text, matched or terms)
            dedupe_key = (doc_path, snippet[:160])
            if dedupe_key in seen_chunks:
                continue
            seen_chunks.add(dedupe_key)
            scored.append(
                {
                    "title": title,
                    "text": snippet,
                    "source_path": doc_path,
                    "score": round(score, 6),
                    "matched_terms": matched,
                }
            )

        scored.sort(key=lambda item: (-float(item["score"]), str(item["title"]), str(item["source_path"])))
        return {
            "matches": scored[: max(1, min(int(limit), 20))],
            "query": raw_query,
            "effective_query": effective_query,
            "continuity_from_previous": bool(previous),
            "weak_query": weak,
            "terms": terms,
        }

    def stats(self) -> dict[str, object]:
        with closing(self._connect()) as conn:
            docs = int(conn.execute("SELECT count(*) FROM documents").fetchone()[0])
            chunks = int(conn.execute("SELECT count(*) FROM chunks_fts").fetchone()[0])
            history = int(conn.execute("SELECT count(*) FROM request_history").fetchone()[0])
        return {
            "schema": INDEX_SCHEMA_VERSION,
            "ready": docs > 0 and chunks > 0,
            "documents": docs,
            "chunks": chunks,
            "request_history": history,
            "roots": [str(root) for root in self.roots],
            "db_path": str(self.db_path),
            "last_refresh": self._last_stats.as_dict(),
        }


class CorpusBridgeService:
    def __init__(self, index: CorpusIndex) -> None:
        self.index = index

    def search_payload(self, payload: dict[str, object]) -> dict[str, object]:
        query = _norm(payload.get("query"))
        keywords_raw = payload.get("keywords")
        keywords = [str(item) for item in keywords_raw] if isinstance(keywords_raw, list) else []
        limit = payload.get("limit", 6)
        try:
            limit_value = int(limit)
        except (TypeError, ValueError):
            limit_value = 6
        return self.index.search(
            query,
            keywords=keywords,
            latest_user_text=_norm(payload.get("latestUserText")),
            platform=_norm(payload.get("platform")) or "unknown",
            page_url=_norm(payload.get("pageUrl")),
            limit=limit_value,
        )


def make_handler(service: CorpusBridgeService) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "AutoDrillerCorpusBridge/1.0"

        def _json(self, status: int, payload: dict[str, object]) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self._json(204, {})

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path in {"/health", "/stats"}:
                self._json(200, service.index.stats())
                return
            self._json(404, {"error": "not-found"})

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length < 0 or length > 1_048_576:
                self._json(413, {"error": "payload-too-large"})
                return
            raw = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._json(400, {"error": "invalid-json"})
                return
            if not isinstance(payload, dict):
                self._json(400, {"error": "json-object-required"})
                return

            if path == "/search":
                self._json(200, service.search_payload(payload))
                return
            if path == "/reindex":
                stats = service.index.refresh(force=True)
                self._json(200, {"ok": True, "refresh": stats.as_dict(), **service.index.stats()})
                return
            self._json(404, {"error": "not-found"})

        def log_message(self, fmt: str, *args: object) -> None:
            sys.stderr.write("[corpus-bridge] " + (fmt % args) + "\n")

    return Handler


def _default_db_path() -> Path:
    return Path(os.environ.get("AUTO_DRILLER_INDEX_DB", "~/.auto-driller/corpus.sqlite3")).expanduser()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Auto Driller local chat-export retrieval bridge")
    parser.add_argument("--root", action="append", default=[], help="Conversation-export root. May be repeated.")
    parser.add_argument("--db", default=str(_default_db_path()), help="Derived SQLite FTS index path")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--refresh-seconds", type=int, default=DEFAULT_REFRESH_SECONDS)
    parser.add_argument("--max-file-mb", type=int, default=64)
    parser.add_argument("--reindex", action="store_true", help="Force a full refresh before serving")
    parser.add_argument("--once", help="Index/search once, print JSON, and exit")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    roots = discover_roots(args.root)
    if not roots:
        print(
            "No conversation-export roots found. Pass --root PATH or set AUTO_DRILLER_CORPUS_ROOTS.",
            file=sys.stderr,
        )
        return 2

    index = CorpusIndex(
        Path(args.db),
        roots,
        max_file_bytes=max(1, args.max_file_mb) * 1024 * 1024,
        refresh_seconds=max(0, args.refresh_seconds),
    )
    refresh = index.refresh(force=args.reindex)
    print(json.dumps({"event": "indexed", "refresh": refresh.as_dict(), **index.stats()}, ensure_ascii=False))

    if args.once is not None:
        result = index.search(args.once, latest_user_text=args.once, limit=8)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    service = CorpusBridgeService(index)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(service))
    print(f"Auto Driller corpus bridge listening on http://{args.host}:{args.port}")
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

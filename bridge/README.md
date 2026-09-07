# Auto Driller Corpus Bridge

The corpus bridge turns organized AI conversation exports into the retrieval service already used by `scripts/auto-driller-master.user.js`.

It is deliberately simple:

```text
user message
  -> Auto Driller Context Lens
  -> POST 127.0.0.1:8765/search
  -> local SQLite FTS5 index
  -> compact historical matches
  -> relevant follow-up question
```

The bridge never edits the source exports. Its SQLite database is a disposable derived index.

## Start

On macOS/Linux:

```bash
python3 bridge/corpus_bridge.py
```

The bridge automatically looks for the organized export tree in common Dropbox locations, including:

```text
~/Library/CloudStorage/Dropbox/Cherry Chan/03_MASTER_STORAGE_AND_MEDIA_VAULTS/05_AI_CONVERSATION_EXPORTS
~/Dropbox/Cherry Chan/03_MASTER_STORAGE_AND_MEDIA_VAULTS/05_AI_CONVERSATION_EXPORTS
```

Or point it at any export root explicitly:

```bash
python3 bridge/corpus_bridge.py --root "/path/to/05_AI_CONVERSATION_EXPORTS"
```

Multiple roots are supported by repeating `--root` or setting `AUTO_DRILLER_CORPUS_ROOTS` using the OS path separator.

## Endpoints

- `POST /search` - retrieval contract consumed by Auto Driller
- `GET /health` - index readiness, roots, document/chunk counts
- `GET /stats` - same derived-index state
- `POST /reindex` - force refresh

Default address:

```text
http://127.0.0.1:8765
```

## Continuity behavior

The bridge records only a small derived query-continuity cache. If the current message is weak or referential, such as:

```text
continue
run it again
plz test it
fix it
```

it reuses the last strong search query for that conversation URL instead of searching generic action words. One distinctive term such as `Yamatani`, `corruption`, or `AutoDriller` is sufficient to become a new search seed.

## Index behavior

- SQLite FTS5, Python standard library only
- incremental refresh based on source path, size, and modification time
- paragraph-aware overlapping chunks
- source paths preserved in every result
- large monolithic exports are skipped by default rather than loaded wholesale; organized Markdown/text exports are the intended immediate corpus
- source files are read-only from the bridge's perspective

The default derived database is:

```text
~/.auto-driller/corpus.sqlite3
```

Override with `--db` or `AUTO_DRILLER_INDEX_DB`.

## Tests

```bash
python3 -m unittest -v bridge/test_corpus_bridge.py
```

The tests cover retrieval ranking, weak-prompt continuation, incremental refresh, the live HTTP contract, source immutability, and index health.

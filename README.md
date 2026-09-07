# AI Auto-Driller Unified

**Cross-platform userscript automation toolkit with deterministic repository validation and explicit browser-runtime boundaries.**

The canonical runtime is [`scripts/auto-driller-master.user.js`](scripts/auto-driller-master.user.js), currently userscript version **5.1.1**. The repository also preserves platform-specific scripts, configuration documentation, validation harnesses, and the local chat-export retrieval bridge.

## What is verified here

Repository-native proof validates the checked-in source without claiming a live third-party browser session:

- the master userscript has valid metadata and recognized platform match/include rules;
- the master validation harness exercises input targeting, response-stability logic, retries, approval gating, operation-generation cancellation, cache/backoff behavior, and export-oriented state;
- the legacy validation harness exercises preserved platform-specific userscripts;
- the corpus bridge tests exercise local FTS retrieval, weak-prompt continuity, incremental refresh, source immutability, and the HTTP contract consumed by Auto Driller;
- every `scripts/*.user.js` parses as JavaScript and carries userscript metadata inside a valid `==UserScript==` metadata block;
- public CI is bound to the exact pull-request head or push SHA.

## Canonical runtime

Install or inspect:

```text
scripts/auto-driller-master.user.js
```

The master userscript includes adapters/selectors for public web surfaces such as ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek, Kimi, Qwen, Cohere, Notion, and local hosts. Those adapter definitions are **compatibility code**, not proof that every named website is currently reachable, unchanged, authorized for automation, or successfully driven in a live browser session.

The runtime defaults are deliberately conservative:

- `autoDrill: false`
- `autoAccept: false`
- bounded drill depth and intervals
- approval/action checks before automated acceptance
- operation-generation cancellation so stale work can be invalidated
- response-stability checks before follow-up activity

## Retrieval-first Context Lens

Auto Driller 5.1 makes continuity part of question generation rather than a separate ritual.

For each drill it:

1. prioritizes the latest visible user message as the search seed;
2. extracts a small set of high-information terms;
3. folds in nearby page context and persisted recent drill context;
4. queries the local corpus bridge at `http://127.0.0.1:8765/search` when it is running;
5. if matches are returned, injects only compact recovered snippets into the next question;
6. if no bridge is available, asks the AI to search available prior conversation/export history for the extracted terms before answering.

Corpus retrieval is an accelerator, not a gate. A missing or timed-out bridge falls back to local context and does not disable drilling.

## Local Corpus Bridge

`bridge/corpus_bridge.py` now implements the `127.0.0.1:8765/search` contract that the userscript already calls.

It builds a disposable SQLite FTS5 index over organized AI conversation exports and never rewrites the source files. On macOS it automatically checks the current Dropbox-style export location under:

```text
~/Library/CloudStorage/Dropbox/Cherry Chan/03_MASTER_STORAGE_AND_MEDIA_VAULTS/05_AI_CONVERSATION_EXPORTS
```

Start it with:

```bash
python3 bridge/corpus_bridge.py
```

or point it at another export root:

```bash
python3 bridge/corpus_bridge.py --root "/path/to/05_AI_CONVERSATION_EXPORTS"
```

The bridge also carries a small derived query-continuity cache. Referential commands such as `continue`, `run it again`, `plz test it`, or `fix it` reuse the prior strong query for the same conversation instead of searching generic action words. A distinctive term such as `Yamatani`, `corruption`, or `AutoDriller` starts a new search thread immediately.

See [`bridge/README.md`](bridge/README.md) for the endpoints, index behavior, root discovery, and tests.

## Validation

```bash
npm ci
npm test
python3 -m unittest -v bridge/test_corpus_bridge.py
```

The Public Truth Gate additionally syntax-checks userscripts, verifies metadata, checks the canonical master-version token on Node.js 20, and runs the corpus bridge suite on Python 3.12.

## Evidence boundary

A green repository workflow establishes **source-level userscript behavior and validation harness results only**. It does not establish:

- affiliation with, endorsement by, or employment at any named AI/provider company;
- guaranteed compatibility with a provider's current DOM or product policy after the verified Git head;
- successful live browser execution on every listed platform;
- autonomous account authority, subscription access, rate-limit bypass, or privileged API access;
- correctness of third-party model responses;
- permission to automate actions that a site or account does not otherwise allow;
- production deployment outside a user-controlled userscript/browser environment.

## Repository layout

| Path | Role |
|---|---|
| `scripts/auto-driller-master.user.js` | canonical consolidated userscript |
| `scripts/*-max.user.js` | preserved platform-specific userscripts |
| `scripts/master_validation_harness.js` | canonical validation harness |
| `scripts/validation_harness.js` | legacy/platform validation harness |
| `bridge/corpus_bridge.py` | local SQLite FTS chat-export retrieval service |
| `bridge/test_corpus_bridge.py` | retrieval/continuity/HTTP/source-integrity tests |
| `bridge/README.md` | corpus bridge setup and behavior |
| `docs/` | configuration, themes, iOS/bookmarklet notes |
| `test-driller.html` | local/manual test fixture |

## Version boundary

The canonical userscript declares `@version 5.1.1`. `package.json` is tooling metadata for the repository validation wrapper and remains `5.0.0`; userscript release identity is taken from the canonical userscript header/runtime constant rather than inferred from npm package metadata.

# AI Auto-Driller Unified

**Cross-platform userscript automation toolkit with deterministic repository validation and explicit browser-runtime boundaries.**

The canonical runtime is [`scripts/auto-driller-master.user.js`](scripts/auto-driller-master.user.js), currently userscript version **5.0.1**. The repository also preserves platform-specific scripts, configuration documentation, and validation harnesses.

## What is verified here

Repository-native proof validates the checked-in source without claiming a live third-party browser session:

- the master userscript has valid metadata and recognized platform match/include rules;
- the master validation harness exercises input targeting, response-stability logic, retries, approval gating, operation-generation cancellation, cache/backoff behavior, and export-oriented state;
- the legacy validation harness exercises preserved platform-specific userscripts;
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

## Validation

```bash
npm ci
npm test
```

The Public Truth Gate additionally syntax-checks userscripts, verifies metadata, and checks the canonical master-version token on Node.js 20.

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
| `docs/` | configuration, themes, iOS/bookmarklet notes |
| `test-driller.html` | local/manual test fixture |

## Version boundary

The canonical userscript declares `@version 5.0.1`. `package.json` is tooling metadata for the repository validation wrapper and remains `5.0.0`; userscript release identity is taken from the canonical userscript header/runtime constant rather than inferred from npm package metadata.

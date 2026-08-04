# Auto Driller Master v5 — Installation

## Recommended installation

Install one script only:

`https://raw.githubusercontent.com/GlacierEQ/ai-auto-driller-unified/main/scripts/auto-driller-master.user.js`

The URL becomes the canonical one-click installer after the v5 branch is merged to `main`.

## Before installing

1. Install Tampermonkey or Violentmonkey.
2. Disable or remove the older per-platform Auto Driller scripts. Running a legacy script beside the master can create duplicate panels and duplicate submissions.
3. Open the raw master-script URL above and approve the userscript-manager installation prompt.
4. Refresh the supported AI site.

## First-run behavior

The safe defaults are:

- Auto drill: off
- Safe auto-accept: off
- Maximum depth: 5
- Minimum drill interval: 7 seconds
- User-activity quiet period: 10 seconds

Use **Drill current response** to verify the active platform manually. Enable Auto drill only after the manual action succeeds.

## Supported targets

- ChatGPT
- Claude
- Gemini
- Perplexity
- Grok
- DeepSeek
- Kimi
- Qwen
- Cohere Chat
- Notion AI
- Local LLM interfaces on localhost or 127.0.0.1

Notion AI is intentionally manual-only so the script cannot type into ordinary Notion pages.

## Controls

- Floating panel: settings, current status, reset, and audit export
- `Ctrl+Shift+D`: drill the current response
- Userscript menu: toggle panel, drill now, toggle auto drill, emergency stop
- Emergency stop disables Auto drill and Safe auto-accept immediately

## Verification rules

A drill is counted only after the runtime verifies:

1. A stable, new assistant response exists.
2. The prompt input is empty.
3. The generated question was actually inserted.
4. Submission started, detected by input clearing, a busy indicator, or a changed response hash.

Failures are shown in the panel and recorded in the exported audit log.

## Updating

The script contains `@updateURL` and `@downloadURL` metadata pointing to the canonical `main` branch. Tampermonkey and Violentmonkey can therefore detect future releases automatically.

## Rollback

Disable **AI Auto-Driller Master** in the userscript manager, then re-enable the prior platform-specific script if needed. Session exports are standalone JSON and do not modify site data.

## Validation

```bash
npm install
npm test
```

The test command runs both the legacy validation harness and the master-script contract harness.

# Nebelus Chat Widget -- Test & Demo

Interactive test harness for the Nebelus embeddable chat widget. Lets you paste your own embed snippet and test thread resumption across multiple simulated user sessions.

## Quick Start

```bash
cd docs
make widget
```

Or manually:

```bash
cd docs/widget && python3 -m http.server 8084
```

Then open <http://localhost:8084> in your browser.

## What This Demo Does

- **Session switching** -- Simulate multiple users (Session A / B / C) by composing `userId = baseUserId + sessionId`.
- **Thread persistence** -- The demo stores thread IDs in `localStorage` and passes them back via `threadId` on re-init to resume conversations.
- **Debug console** -- Live view of all widget events (`onReady`, `onNewThread`, `onMessage`, `onError`, `onThreadTitleUpdate`) and internal state.
- **Snippet editor** -- Paste your real embed snippet; the demo parses it and injects your `apiKey`, `agentId`, and `deploymentId` automatically.

## Full Documentation

See the comprehensive integration guide: [widget-integration.md](../widget-integration.md)

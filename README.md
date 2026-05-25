# Daily Log — Chrome Extension

Track your daily goals with one-tap timers, a 12-month adherence heatmap, and per-goal targets. All data lives in your browser. No accounts, no sync, no telemetry.

## Features

- **One tap to start a timer.** Recent goals always in view.
- **Live elapsed counter** while a timer runs. Survives refresh and closing the tab.
- **Drag to reorder** goals. Click the name to rename. Hover the card to remove.
- **Per-goal targets** with smart chips: Halfway, Completed, ±15 minutes.
- **Year-long heatmap** showing every day at a glance:
  - Gray = no progress
  - Mid green = some goals hit
  - Bright green = all goals hit
- **Save to file** appends today's log to any markdown file (uses the File System Access API).
- **Auto-draft** to browser storage — refresh-safe.

## Install (Load Unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select this `chrome-extension/` folder.
5. Pin the **Daily Log** extension to your toolbar (puzzle-piece icon → pin).
6. Click the icon any time to open Daily Log in a tab.

## Privacy

All data stays in your browser's local storage. The extension makes no network requests. The only file it can touch is the markdown file you explicitly pick via **Save to file**.

## Customizing for yourself

- Click **+ Add goal** to add new tracked goals.
- Hover a goal card to reveal the × remove button.
- Click any goal name to rename it.
- Drag cards by clicking and holding to reorder.

## Browser support

- Chrome, Edge, Brave, Arc (anything Chromium-based) — full support.
- Firefox / Safari — not supported as an extension (file save fallback works but requires the standalone HTML).

## License

Copyright (c) 2026 Yufan Chen. All rights reserved.

Free for personal, non-commercial use. Source published for transparency. Not licensed for redistribution, modification-and-redistribution, or inclusion in paid products. See `LICENSE` for the full terms. For commercial licensing, contact the author.

# Shorts Blocker

A browser extension (Chrome and Safari, Manifest V3) that keeps YouTube distraction-free by:

- **Blocking YouTube Shorts** – removes the Shorts shelf, navigation entry, and individual Short items.
- **Hiding recommended videos** – hides the sidebar "Up Next" panel, end-screen cards, and homepage recommendation rows.
- **Staying active during SPA navigation** – uses a `MutationObserver` and YouTube's `yt-navigate-finish` event so blocking persists as you move between pages without a full reload.
- **Optional toggle** – a small popup lets you enable or disable blocking without reinstalling the extension.

---

## Project structure

```
shortsBlocker/
├── manifest.json   # Manifest V3 config (Chrome & Safari)
├── content.js      # DOM-blocking logic (MutationObserver)
├── popup.html      # Toggle UI
└── popup.js        # Toggle state via storage API
```

---

## How to load the extension in Chrome (unpacked)

1. **Download / clone** this repository to your machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `shortsBlocker` folder (the one that contains `manifest.json`).
5. The extension icon will appear in the toolbar. Pin it for easy access.

> **Tip:** After toggling the blocker on or off, reload the YouTube tab to see the change take full effect.

---

## How to load the extension in Safari (unpacked)

Safari requires extensions to be packaged as a Safari Web Extension. You can convert this extension using Xcode's built-in migration tool:

1. **Install Xcode** (version 12 or later) from the Mac App Store.
2. **Run the conversion tool** from your terminal, replacing `<output-dir>` with your chosen output directory:
   ```bash
   xcrun safari-web-extension-converter /path/to/shortsBlocker --project-location <output-dir>
   ```
3. Xcode will open the generated project automatically. Click **Run** (▶) to build and install the extension.
4. In Safari, open **Settings → Extensions**, find **Shorts Blocker**, and enable it.
5. Grant access to `youtube.com` when prompted.

> **Note:** Safari 15.4 or later (macOS 12.3+, iOS 15.4+) is required for Manifest V3 support.

---

## Usage

- Click the extension icon to open the popup.
- Use the toggle switch to **enable** (default) or **disable** blocking.
- Your preference is saved automatically and restored on every browser session.

---

## How it works

| File | Responsibility |
|---|---|
| `manifest.json` | Declares the extension, permissions (`storage`), and injects `content.js` on all YouTube pages. |
| `content.js` | Defines CSS selectors for Shorts and recommendation elements, hides them with `display:none`, and watches for dynamically added nodes via `MutationObserver`. Listens for `yt-navigate-finish` to re-apply blocking after SPA navigations. Uses a cross-browser API shim (`browser` namespace on Safari/Firefox, `chrome` on Chrome). |
| `popup.html` | Renders a minimal toggle UI (no external dependencies). |
| `popup.js` | Reads / writes the `enabled` flag in `storage.local` and sends a `SET_ENABLED` message to the active tab's content script. Uses a cross-browser API shim for compatibility with both Chrome and Safari. |

---

## Selectors blocked

**Shorts**

| Selector | What it targets |
|---|---|
| `ytd-rich-shelf-renderer[is-shorts]` | Shorts shelf on homepage |
| `ytd-rich-shelf-renderer[shelf-style='shorts']` | Fallback Shorts shelf variant |
| `ytd-guide-entry-renderer a[title='Shorts']` | Shorts link in the left guide |
| `ytd-mini-guide-entry-renderer a[title='Shorts']` | Shorts link in the collapsed guide |
| `ytd-reel-shelf-renderer` | Reel / Shorts shelf |
| `ytd-reel-item-renderer` | Individual Short items |

**Recommendations**

| Selector | What it targets |
|---|---|
| `#secondary #related` | Sidebar "Up Next" / related videos panel |
| `ytd-compact-video-renderer` | Individual items in the related panel |
| `.ytp-endscreen-content` | End-screen recommendation cards |
| `ytd-feed-filter-chip-bar-renderer` | Topic chip / filter bar on homepage |
| `ytd-rich-item-renderer` | Recommended video rows on homepage |

# Folio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

**A sleek desktop viewer _and_ editor for Markdown and JSON.**

Double-clicking a `.md` or `.json` shouldn't launch a code editor. Folio renders
them the way you want to read them — Markdown as a clean, formatted document and
JSON as a tidy, collapsible tree — and lets you edit them in place. Set it as your
default app and double-clicking *just works*.

> ⚠️ **Status:** v0.1, but genuinely daily-usable. macOS-focused.

![Folio rendering Markdown in light mode](docs/light.png)

<table>
  <tr>
    <td width="50%"><img src="docs/dark.png" alt="Folio in dark mode" /><br/><sub><b>Dark mode</b></sub></td>
    <td width="50%"><img src="docs/edit.png" alt="Folio's Obsidian-style live editor" /><br/><sub><b>Live editing — markers dimmed, headings sized</b></sub></td>
  </tr>
</table>

## Features

- **Markdown, rendered** — GitHub-flavored (tables, task lists) with syntax-highlighted code
- **JSON, explored** — a collapsible, color-coded tree; fold big nodes, see key/item counts, clear "invalid JSON" errors
- **Edit in place** — an **Obsidian-style live Markdown editor** (headings sized, `#`/`**` markers dimmed, bold/italic styled *as you type*) and a syntax-highlighted JSON editor. **Save**, **Save as…**, and **Format** (pretty-print JSON)
- **New files** — `⌘N` (Markdown) / `⇧⌘N` (JSON), or the `＋ New` menu
- **"Open with Folio"** — registers as a handler for `.md`/`.json`; set it as default and double-click opens here, not Xcode
- **Light & dark themes** + a **clean mode** that hides the sidebar for distraction-free reading
- **Find** (`⌘F`), **zoom** (`⌘ ±`), live **stats** (word count + reading time, or JSON keys + size), **Copy**, **Reveal in Finder**
- Sidebar for multiple open files (hover to close), **drag & drop**
- **100% local** — files are read on your machine; no network, no telemetry

## Supported files

| Type | Shown as |
| ---- | -------- |
| `.md` `.markdown` `.mdx` `.mdown` | formatted Markdown |
| `.json` `.jsonc` `.geojson` | collapsible JSON tree |
| anything else | plain text |

## Make it your default app

```bash
npm run tauri build           # produces Folio.app
```

Move `src-tauri/target/release/bundle/macos/Folio.app` into **/Applications**, then in
Finder: right-click a `.md` → **Get Info** → **Open with: Folio** → **Change All…**
(repeat for `.json`). Now double-clicking those files opens Folio.

## Install / run from source

Prerequisites: [Node.js](https://nodejs.org) 18+ and the
[Rust toolchain](https://www.rust-lang.org/tools/install)
([Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
git clone https://github.com/growthforging/folio.git
cd folio
npm install
npm run tauri dev      # develop
npm run tauri build    # build the .app
```

## Tech

- [Tauri v2](https://tauri.app) — tiny native shell (Rust)
- [React](https://react.dev) + TypeScript + [Vite](https://vite.dev)
- [`react-markdown`](https://github.com/remarkjs/react-markdown) + `remark-gfm` + `rehype-highlight` for rendering
- [CodeMirror 6](https://codemirror.net) for the live Markdown / JSON editor
- A hand-rolled collapsible JSON tree ([`src/JsonTree.tsx`](src/JsonTree.tsx))

## License

[MIT](LICENSE)

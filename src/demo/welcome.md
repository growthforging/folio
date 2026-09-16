# Welcome to Folio

Folio is a small, fast reader and editor for the plain-text files you actually use: Markdown notes, JSON payloads, and CSV exports. Open a file and it renders the way it was meant to be read, with real headings, tables, and highlighted code instead of raw `#` and `|` characters.

> Files stay on your machine. Folio has no accounts, no sync, and no telemetry.

## What it does

- **Renders Markdown** with GitHub-flavored extras: tables, task lists, footnotes, and fenced code.
- **Explores JSON** as a collapsible tree with key counts, so a large payload stays navigable.
- **Shows CSV as a real table**, with numeric columns aligned right and a header that stays put.
- **Edits in place** with a Notion-style editor, or switch to source when you want the raw text.

## Keyboard first

| Action | Shortcut |
| --- | --- |
| Open a file | `⌘O` |
| New Markdown or JSON | `⌘N` or `⇧⌘N` |
| Command palette | `⌘K` |
| Find in document | `⌘F` |
| Toggle sidebar | `⌘\` |
| Zoom | `⌘+` `⌘−` `⌘0` |

Everything in the toolbar has a keyboard equivalent, and the palette lists all of them.

## Editing

Press **Edit** (or `⌘E`) and the document becomes a Notion-style canvas. Type `/` for blocks, drag the handle to reorder paragraphs, and switch to *Source* when you'd rather see the Markdown itself. `⌘S` saves without leaving edit mode; **Done** takes you back to reading.

```ts
export function readingTime(text: string, wordsPerMinute = 220) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}
```

### A short checklist

- [x] Render headings, lists, and tables
- [x] Highlight fenced code
- [x] Jump around long documents with the outline
- [ ] Sync to the cloud (not planned)

## Make it the default app

Build Folio, move it to Applications, then in Finder choose **Get Info → Open with → Change All…** for `.md`, `.json`, and `.csv`. Double-clicking a file now opens it here instead of in a code editor.

---

Folio is open source under the MIT license. Bug reports and pull requests are welcome on [GitHub](https://github.com/growthforging/folio).

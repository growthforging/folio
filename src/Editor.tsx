import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  drawSelection,
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { tags as t } from "@lezer/highlight";

/* Obsidian-style "live" markdown: headings sized, bold/italic styled, markers dimmed. */
const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.7em", fontWeight: "700", lineHeight: "1.5" },
  { tag: t.heading2, fontSize: "1.42em", fontWeight: "700", lineHeight: "1.5" },
  { tag: t.heading3, fontSize: "1.22em", fontWeight: "700" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--accent)" },
  { tag: t.url, color: "var(--muted)" },
  { tag: t.monospace, fontFamily: "var(--mono)", color: "var(--jstr)" },
  { tag: t.quote, color: "var(--muted)", fontStyle: "italic" },
  { tag: t.list, color: "var(--accent)" },
  { tag: t.processingInstruction, color: "var(--muted)", opacity: "0.5" },
]);

const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--jkey)" },
  { tag: t.string, color: "var(--jstr)" },
  { tag: t.number, color: "var(--jnum)" },
  { tag: [t.bool, t.null], color: "var(--jbw)" },
  { tag: [t.separator, t.brace, t.bracket, t.punctuation], color: "var(--muted)" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--text)", backgroundColor: "transparent", height: "100%" },
  ".cm-scroller": {
    fontFamily: "var(--mono)",
    fontSize: "calc(13px * var(--scale, 1))",
    lineHeight: "1.7",
    overflow: "auto",
  },
  ".cm-content": { padding: "20px 26px", caretColor: "var(--text)" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--muted)", border: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "rgba(110, 168, 254, 0.25)",
  },
});

export function Editor({
  value,
  language,
  onChange,
}: {
  value: string;
  language: "markdown" | "json" | "text";
  onChange: (v: string) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const common = [
      history(),
      drawSelection(),
      indentOnInput(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current(u.state.doc.toString());
      }),
    ];
    const langExt =
      language === "json"
        ? [
            json(),
            syntaxHighlighting(jsonHighlight),
            lineNumbers(),
            highlightActiveLineGutter(),
            foldGutter(),
            bracketMatching(),
          ]
        : language === "markdown"
        ? [markdown(), syntaxHighlighting(mdHighlight)]
        : [];

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions: [...common, ...langExt] }),
      parent: host.current,
    });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external content changes (e.g. JSON "Format") back into the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div className="cm-host" ref={host} />;
}

import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { tags as t } from "@lezer/highlight";

/* Live-preview flavoured Markdown: headings sized, emphasis styled, markers dimmed. */
const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.7em", fontWeight: "700", lineHeight: "1.4" },
  { tag: t.heading2, fontSize: "1.4em", fontWeight: "700", lineHeight: "1.4" },
  { tag: t.heading3, fontSize: "1.2em", fontWeight: "700" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--link)" },
  { tag: t.url, color: "var(--text-3)" },
  { tag: t.monospace, color: "var(--j-str)" },
  { tag: t.quote, color: "var(--text-2)", fontStyle: "italic" },
  { tag: t.list, color: "var(--text-2)" },
  { tag: t.processingInstruction, color: "var(--text-3)" },
  { tag: t.contentSeparator, color: "var(--text-3)" },
]);

const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--j-key)" },
  { tag: t.string, color: "var(--j-str)" },
  { tag: t.number, color: "var(--j-num)" },
  { tag: [t.bool, t.null], color: "var(--j-bool)" },
  { tag: [t.separator, t.brace, t.bracket, t.punctuation], color: "var(--text-3)" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--text)", backgroundColor: "transparent", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--text-3)", border: "none" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
});

const foldMarker = (open: boolean) => {
  const s = document.createElement("span");
  s.className = `cm-fold${open ? " open" : ""}`;
  s.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  return s;
};

export interface EditorHandle {
  openSearch: () => void;
  focus: () => void;
}

interface Props {
  value: string;
  language: "markdown" | "json" | "text";
  onChange: (v: string) => void;
  onReady?: () => void;
  scrollRef?: RefObject<HTMLElement | null>;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { value, language, onChange, onReady, scrollRef },
  ref
) {
  const host = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  /** The last value we emitted, so a debounced echo from the parent never overwrites newer typing. */
  const emitted = useRef(value);

  useImperativeHandle(
    ref,
    () => ({
      openSearch: () => {
        const v = viewRef.current;
        if (v) openSearchPanel(v);
      },
      focus: () => viewRef.current?.focus(),
    }),
    []
  );

  useEffect(() => {
    if (!host.current) return;
    const common = [
      history(),
      drawSelection(),
      indentOnInput(),
      closeBrackets(),
      highlightSelectionMatches(),
      search({ top: true }),
      EditorView.lineWrapping,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          const text = u.state.doc.toString();
          emitted.current = text;
          onChangeRef.current(text);
        }
      }),
    ];
    const langExt =
      language === "json"
        ? [
            json(),
            syntaxHighlighting(jsonHighlight),
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            foldGutter({ markerDOM: foldMarker }),
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
    if (scrollRef) scrollRef.current = view.scrollDOM;
    view.focus();
    onReadyRef.current?.();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external content changes (e.g. JSON "Format") back into the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === emitted.current) return;
    if (value !== view.state.doc.toString()) {
      emitted.current = value;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      className={`cm-host${language === "markdown" ? " md" : ""}${language === "text" ? " txt" : ""}`}
      ref={host}
    />
  );
});

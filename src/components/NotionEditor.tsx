import { useEffect, useRef, type RefObject } from "react";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx, editorViewOptionsCtx } from "@milkdown/kit/core";
import "@milkdown/crepe/theme/common/style.css";

interface Props {
  value: string;
  onChange: (md: string) => void;
  /** Fires once the editor has rendered its content and taken focus. */
  onReady?: () => void;
  scrollRef?: RefObject<HTMLElement | null>;
}

/**
 * Notion-style WYSIWYG markdown editing via Milkdown's "Crepe" editor.
 * Mounted imperatively so it's framework-agnostic; Markdown is the source of
 * truth and `markdownUpdated` streams it back out.
 */
export function NotionEditor({ value, onChange, onReady, scrollRef }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const crepe = new Crepe({
      root,
      defaultValue: value,
      features: {
        // Math rendering pulls in KaTeX; Folio documents don't need it.
        [Crepe.Feature.Latex]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: "Type / for blocks, or just start writing", mode: "block" },
      },
    });
    // Keep the caret comfortably inside the viewport while typing near an edge.
    crepe.editor.config((ctx) => {
      ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, scrollThreshold: 96, scrollMargin: 96 }));
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prev) => {
        if (markdown !== prev) onChangeRef.current(markdown);
      });
    });
    let alive = true;
    const ready = crepe.create().then(() => {
      if (!alive) return;
      root.classList.add("ready");
      try {
        crepe.editor.ctx.get(editorViewCtx).focus();
      } catch {
        /* editor may already be gone */
      }
      onReadyRef.current?.();
    });
    return () => {
      alive = false;
      void ready.then(() => crepe.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="folio-crepe"
      ref={(el) => {
        host.current = el;
        if (scrollRef) scrollRef.current = el;
      }}
    />
  );
}

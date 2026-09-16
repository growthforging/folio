import { useEffect, useRef, type RefObject } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";

/**
 * Notion-style WYSIWYG markdown editing via Milkdown's "Crepe" editor.
 * Mounted imperatively so it's framework-agnostic; Markdown is the source of
 * truth and `markdownUpdated` streams it back out.
 */
export function NotionEditor({
  value,
  onChange,
  scrollRef,
}: {
  value: string;
  onChange: (md: string) => void;
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const crepe = new Crepe({ root: host.current, defaultValue: value });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => onChangeRef.current(markdown));
    });
    const ready = crepe.create();
    return () => {
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

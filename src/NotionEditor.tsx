import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";

/**
 * Notion-style WYSIWYG markdown editing via Milkdown's "Crepe" editor.
 * Mounted imperatively (like the CodeMirror editor) so it's framework-agnostic.
 * Markdown is the source of truth — `markdownUpdated` streams it back out.
 */
export function NotionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (md: string) => void;
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
      // Wait for creation to settle before tearing down (avoids destroy-mid-create).
      void ready.then(() => crepe.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="folio-crepe" ref={host} />;
}

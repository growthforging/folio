import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  applyHighlights,
  clearHighlights,
  collectRanges,
  legacyFind,
  scrollToRange,
  supportsHighlights,
} from "../lib/find";
import { usePresence } from "../lib/hooks";
import { IconButton } from "../ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  getRoot: () => HTMLElement | null;
  getScroller: () => HTMLElement | null;
  resetKey: string;
}

export function FindBar({ open, onClose, getRoot, getScroller, resetKey }: Props) {
  const { mounted, exiting } = usePresence(open, 100);
  const [q, setQ] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [cur, setCur] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = getRoot();
    const rs = root && q && supportsHighlights ? collectRanges(root, q) : [];
    setRanges(rs);
    setCur(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, resetKey]);

  useEffect(() => {
    if (!open) {
      clearHighlights();
      return;
    }
    applyHighlights(ranges, cur);
    const r = ranges[cur];
    if (r) scrollToRange(r, getScroller());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranges, cur, open]);

  useEffect(() => () => clearHighlights(), []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  const step = (d: number) => {
    if (!supportsHighlights) {
      legacyFind(q, d < 0);
      return;
    }
    if (!ranges.length) return;
    setCur((c) => (c + d + ranges.length) % ranges.length);
  };

  if (!mounted) return null;
  const count = !q ? "" : supportsHighlights ? (ranges.length ? `${cur + 1} of ${ranges.length}` : "No matches") : "";
  return (
    <div className={`find${exiting ? " exit" : ""}`} role="search">
      <Search size={14} strokeWidth={2} />
      <input
        ref={inputRef}
        value={q}
        placeholder="Find in document"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span className={`count${q && supportsHighlights && !ranges.length ? " none" : ""}`}>{count}</span>
      <IconButton icon={ChevronUp} label="Previous" kbd="⇧↩" size={14} onClick={() => step(-1)} disabled={!q} />
      <IconButton icon={ChevronDown} label="Next" kbd="↩" size={14} onClick={() => step(1)} disabled={!q} />
      <IconButton icon={X} label="Close" kbd="esc" size={14} onClick={onClose} />
    </div>
  );
}

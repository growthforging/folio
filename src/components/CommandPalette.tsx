import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search, type LucideIcon } from "lucide-react";
import { fuzzyScore } from "../lib/fuzzy";
import { usePresence } from "../lib/hooks";

export interface PaletteAction {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  kbd?: string;
  sub?: string;
  keywords?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}

export function CommandPalette({ open, onClose, actions }: Props) {
  const { mounted, exiting } = usePresence(open, 120);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const [hl, setHl] = useState<{ top: number; h: number } | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) return actions;
    return actions
      .map((a) => ({ a, s: fuzzyScore(query, `${a.label} ${a.keywords ?? ""} ${a.sub ?? ""}`) }))
      .filter((x): x is { a: PaletteAction; s: number } => x.s !== null)
      .sort((x, y) => y.s - x.s)
      .map((x) => x.a);
  }, [q, actions]);

  const groups = useMemo(() => {
    const m = new Map<string, PaletteAction[]>();
    for (const a of results) {
      const list = m.get(a.group);
      if (list) list.push(a);
      else m.set(a.group, [a]);
    }
    return Array.from(m.entries());
  }, [results]);
  const flat = useMemo(() => groups.flatMap(([, list]) => list), [groups]);
  const current = flat[Math.min(idx, flat.length - 1)] ?? null;

  useEffect(() => setIdx(0), [q]);

  useLayoutEffect(() => {
    const el = current ? itemRefs.current.get(current.id) : undefined;
    if (!el) {
      setHl(null);
      return;
    }
    setHl({ top: el.offsetTop, h: el.offsetHeight });
    const list = listRef.current;
    if (list) {
      const top = el.offsetTop - 6;
      const bottom = el.offsetTop + el.offsetHeight + 6;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
  }, [current, groups]);

  if (!mounted) return null;

  const pick = (a: PaletteAction) => {
    onClose();
    a.run();
  };

  return createPortal(
    <>
      <div className={`pal-backdrop${exiting ? " exit" : ""}`} onPointerDown={onClose} />
      <div className={`pal${exiting ? " exit" : ""}`} role="dialog" aria-label="Command palette">
        <div className="pal-input">
          <Search size={16} strokeWidth={1.9} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Type a command or search files…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => (flat.length ? (i + 1) % flat.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (current) pick(current);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "Home") {
                setIdx(0);
              } else if (e.key === "End") {
                setIdx(Math.max(0, flat.length - 1));
              }
            }}
          />
        </div>
        <div className="pal-list" ref={listRef}>
          {hl && <span className="pal-hl" style={{ transform: `translateY(${hl.top}px)`, height: hl.h }} />}
          {groups.length === 0 && <div className="pal-empty">No matches</div>}
          {groups.map(([group, list]) => (
            <div key={group}>
              <div className="pal-group">{group}</div>
              {list.map((a) => {
                const Icon = a.icon;
                const on = current?.id === a.id;
                return (
                  <div
                    key={a.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(a.id, el);
                      else itemRefs.current.delete(a.id);
                    }}
                    className="pal-item"
                    role="option"
                    aria-selected={on}
                    onPointerMove={() => {
                      const i = flat.indexOf(a);
                      if (i >= 0 && i !== idx) setIdx(i);
                    }}
                    onClick={() => pick(a)}
                  >
                    <span className="pi-ico">{Icon && <Icon size={15} strokeWidth={1.8} />}</span>
                    <span className="pi-label">{a.label}</span>
                    {a.sub && <span className="pi-sub">{a.sub}</span>}
                    {a.kbd && <span className="pi-kbd">{a.kbd}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="pal-foot">
          <span>↑↓ navigate</span>
          <span>
            <CornerDownLeft size={11} strokeWidth={2} /> run
          </span>
          <span>esc close</span>
        </div>
      </div>
    </>,
    document.body
  );
}

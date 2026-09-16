import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** Collect headings from a rendered article and track which one is in view. */
export function useHeadings(
  scrollerRef: RefObject<HTMLElement | null>,
  proseRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  contentKey: string
) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(null);
    const root = proseRef.current;
    if (!enabled || !root) {
      setHeadings([]);
      return;
    }
    const els = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((h) => h.id);
    setHeadings(els.map((h) => ({ id: h.id, text: h.textContent || "", level: Number(h.tagName[1]) })));
    if (els.length < 2) return;
    const visible = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = els.find((h) => visible.has(h.id));
        if (first) setActiveId(first.id);
      },
      { root: scrollerRef.current, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    els.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, contentKey]);

  return { headings, activeId, setActiveId };
}

export function Outline({
  headings,
  activeId,
  onJump,
  open,
}: {
  headings: Heading[];
  activeId: string | null;
  onJump: (id: string) => void;
  open: boolean;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  const [rail, setRail] = useState<{ top: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = activeId ? refs.current.get(activeId) : undefined;
    setRail(el ? { top: el.offsetTop, h: el.offsetHeight } : null);
  }, [activeId, headings]);

  const minLevel = headings.length ? Math.min(...headings.map((h) => h.level)) : 1;
  return (
    <aside className={`outline${open ? "" : " hidden"}`} aria-hidden={!open}>
      <div className="ol-inner">
        <div className="ol-head">Contents</div>
        <ul className="ol-list">
          <span
            className={`ol-rail${rail ? " on" : ""}`}
            style={rail ? { transform: `translateY(${rail.top}px)`, height: rail.h } : undefined}
          />
          {headings.map((h, i) => (
            <li
              key={`${h.id}-${i}`}
              ref={(el) => {
                if (el) refs.current.set(h.id, el);
                else refs.current.delete(h.id);
              }}
              className={`ol-item${activeId === h.id ? " active" : ""}`}
              style={{ paddingLeft: 12 + (h.level - minLevel) * 12 }}
              title={h.text}
              onClick={() => onJump(h.id)}
            >
              {h.text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

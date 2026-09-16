import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, type LucideIcon } from "lucide-react";
import { usePresence } from "../lib/hooks";

export type MenuEntry =
  | {
      type?: "item";
      id: string;
      label: string;
      icon?: LucideIcon;
      kbd?: string;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
      onSelect: () => void;
    }
  | { type: "sep" }
  | { type: "label"; label: string };

export type MenuAnchor = DOMRect | { x: number; y: number };

interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchor: MenuAnchor | null;
  anchorEl?: Element | null;
  items: MenuEntry[];
  align?: "start" | "end";
  prefer?: "below" | "above";
  minWidth?: number;
}

const isRect = (a: MenuAnchor): a is DOMRect => "width" in a;

export function Menu({
  open,
  onClose,
  anchor,
  anchorEl,
  items,
  align = "start",
  prefer = "below",
  minWidth,
}: MenuProps) {
  const { mounted, exiting } = usePresence(open, 100);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  const [active, setActive] = useState(-1);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasChecks = items.some((it) => (!it.type || it.type === "item") && it.checked !== undefined);

  useLayoutEffect(() => {
    if (!mounted || exiting || !anchor || !ref.current) return;
    const m = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    let left: number;
    let top: number;
    let vert: "top" | "bottom";
    if (isRect(anchor)) {
      left = align === "end" ? anchor.right - m.width : anchor.left;
      const below = anchor.bottom + 6;
      const above = anchor.top - 6 - m.height;
      const fitsBelow = below + m.height <= vh - pad;
      const fitsAbove = above >= pad;
      const useBelow = prefer === "below" ? fitsBelow || !fitsAbove : !fitsAbove;
      top = useBelow ? below : above;
      vert = useBelow ? "top" : "bottom";
    } else {
      left = anchor.x;
      top = anchor.y;
      vert = "top";
      if (top + m.height > vh - pad) {
        top = Math.max(pad, anchor.y - m.height);
        vert = "bottom";
      }
    }
    left = Math.min(Math.max(pad, left), Math.max(pad, vw - m.width - pad));
    top = Math.min(Math.max(pad, top), Math.max(pad, vh - m.height - pad));
    const next = { left, top, origin: `${vert} ${align === "end" ? "right" : "left"}` };
    setPos((p) => (p && p.left === next.left && p.top === next.top && p.origin === next.origin ? p : next));
  }, [mounted, exiting, anchor, align, prefer]);

  useEffect(() => {
    if (!open || !mounted) return;
    setActive(-1);
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (ref.current?.contains(t)) return;
      if (anchorEl && anchorEl.contains(t)) return;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const close = () => onCloseRef.current();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      prev?.focus({ preventScroll: true });
    };
  }, [open, mounted, anchorEl]);

  const enabled = items
    .map((it, i) => ((!it.type || it.type === "item") && !it.disabled ? i : -1))
    .filter((i) => i >= 0);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const next = at < 0 ? (dir > 0 ? 0 : enabled.length - 1) : (at + dir + enabled.length) % enabled.length;
      setActive(enabled[next]);
    } else if (e.key === "Home") {
      setActive(enabled[0]);
    } else if (e.key === "End") {
      setActive(enabled[enabled.length - 1]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const it = items[active];
      if (it && (!it.type || it.type === "item")) {
        it.onSelect();
        onClose();
      }
    } else if (e.key === "Tab") {
      onClose();
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      className={`menu${exiting ? " exit" : ""}${pos ? "" : " measuring"}`}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setActive(-1)}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, minWidth, "--origin": pos?.origin } as CSSProperties}
    >
      {items.map((it, i) => {
        if (it.type === "sep") return <div key={`sep-${i}`} className="menu-sep" role="separator" />;
        if (it.type === "label")
          return (
            <div key={`label-${i}`} className="menu-label">
              {it.label}
            </div>
          );
        const Icon = it.icon;
        return (
          <div
            key={it.id}
            role="menuitem"
            aria-disabled={it.disabled || undefined}
            className={`menu-item${it.danger ? " danger" : ""}${it.disabled ? " disabled" : ""}`}
            data-active={i === active ? "" : undefined}
            onPointerMove={() => !it.disabled && setActive(i)}
            onClick={() => {
              if (it.disabled) return;
              it.onSelect();
              onClose();
            }}
          >
            {hasChecks && (
              <span className="mi-check">{it.checked && <Check size={12} strokeWidth={2.5} />}</span>
            )}
            {Icon && (
              <span className="mi-ico">
                <Icon size={15} strokeWidth={1.8} />
              </span>
            )}
            <span className="mi-label">{it.label}</span>
            {it.kbd && <span className="mi-kbd">{it.kbd}</span>}
          </div>
        );
      })}
    </div>,
    document.body
  );
}

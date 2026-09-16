import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * One tooltip for the whole app. Any element with `data-tip` (and optionally
 * `data-kbd`) gets one. Delayed in, instant out, and it travels between
 * neighbouring controls instead of re-animating.
 */
interface TipState {
  text: string;
  kbd?: string;
  x: number;
  y: number;
  place: "top" | "bottom";
  key: number;
  travel: boolean;
}

const SHOW_DELAY = 420;
const TRAVEL_WINDOW = 350;

export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let showTimer = 0;
    let lastHide = 0;
    let key = 0;

    const find = (t: EventTarget | null): HTMLElement | null => {
      const el = t instanceof Element ? t.closest<HTMLElement>("[data-tip]") : null;
      return el && el.dataset.tip ? el : null;
    };
    const show = (el: HTMLElement, travel: boolean) => {
      current = el;
      const r = el.getBoundingClientRect();
      const place = el.dataset.tipPlace === "top" ? "top" : "bottom";
      if (!travel) key++;
      setTip({
        text: el.dataset.tip ?? "",
        kbd: el.dataset.kbd,
        x: Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80),
        y: place === "top" ? r.top : r.bottom,
        place,
        key,
        travel,
      });
    };
    const cancel = () => {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = 0;
      }
    };
    const hide = () => {
      cancel();
      if (current) {
        current = null;
        lastHide = Date.now();
        setTip(null);
      }
    };
    const onOver = (e: Event) => {
      const el = find(e.target);
      if (!el || el === current) return;
      cancel();
      if (current) show(el, true);
      else if (Date.now() - lastHide < TRAVEL_WINDOW) show(el, false);
      else showTimer = window.setTimeout(() => show(el, false), SHOW_DELAY);
    };
    const onOut = (e: Event) => {
      const el = find(e.target);
      if (!el) return;
      const rel = (e as MouseEvent).relatedTarget;
      if (rel instanceof Node && el.contains(rel)) return;
      if (el === current) hide();
      else cancel();
    };
    const onDown = () => {
      hide();
      lastHide = 0;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = find(e.target);
      if (el && el.matches(":focus-visible")) show(el, false);
    };
    const onFocusOut = () => hide();

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      key={tip.key}
      className={`tip ${tip.travel ? "travel" : "fresh"} ${tip.place}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
      {tip.kbd && <kbd>{tip.kbd}</kbd>}
    </div>,
    document.body
  );
}

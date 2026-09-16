/** In-document find using the CSS Custom Highlight API (falls back to window.find). */

type HighlightCtor = new (...ranges: Range[]) => unknown;
type Registry = { set: (k: string, v: unknown) => void; delete: (k: string) => void };

const registry = (): Registry | null => {
  const css = (globalThis as { CSS?: { highlights?: Registry } }).CSS;
  return css?.highlights ?? null;
};
const ctor = (): HighlightCtor | null =>
  (globalThis as { Highlight?: HighlightCtor }).Highlight ?? null;

export const supportsHighlights = registry() !== null && ctor() !== null;

export function collectRanges(root: HTMLElement, query: string, max = 3000): Range[] {
  const out: Range[] = [];
  if (!query) return out;
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = (node.textContent ?? "").toLowerCase();
    let i = text.indexOf(q);
    while (i !== -1) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + q.length);
      out.push(r);
      if (out.length >= max) return out;
      i = text.indexOf(q, i + q.length);
    }
  }
  return out;
}

export function applyHighlights(ranges: Range[], current: number) {
  const reg = registry();
  const H = ctor();
  if (!reg || !H) return;
  reg.set("folio-find", new H(...ranges));
  const c = ranges[current];
  if (c) reg.set("folio-find-current", new H(c));
  else reg.delete("folio-find-current");
}

export function clearHighlights() {
  const reg = registry();
  if (!reg) return;
  reg.delete("folio-find");
  reg.delete("folio-find-current");
}

export function scrollToRange(r: Range, scroller: HTMLElement | null) {
  const rect = r.getBoundingClientRect();
  if (!scroller) {
    (r.startContainer.parentElement ?? null)?.scrollIntoView({ block: "center" });
    return;
  }
  const sr = scroller.getBoundingClientRect();
  const margin = 72;
  if (rect.top < sr.top + margin || rect.bottom > sr.bottom - margin) {
    scroller.scrollTo({
      top: scroller.scrollTop + (rect.top - sr.top) - sr.height / 2,
      behavior: "smooth",
    });
  }
}

/** Legacy fallback for engines without highlight support. */
export function legacyFind(query: string, backwards: boolean) {
  const w = window as unknown as { find?: (...a: unknown[]) => boolean };
  w.find?.(query, false, backwards, true);
}

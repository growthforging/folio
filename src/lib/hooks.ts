import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** useState that mirrors itself into localStorage as JSON. */
export function usePersisted<T>(
  key: string,
  initial: T,
  validate?: (v: unknown) => boolean
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const v: unknown = JSON.parse(raw);
        if (!validate || validate(v)) return v as T;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

/** Keeps an element mounted for `exitMs` after `open` turns false so it can animate out. */
export function usePresence(open: boolean, exitMs = 150): { mounted: boolean; exiting: boolean } {
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const t = setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exitMs]);
  return { mounted, exiting };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

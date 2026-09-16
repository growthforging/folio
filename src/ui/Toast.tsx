import { useEffect, useState } from "react";
import { Check, CircleAlert, Info } from "lucide-react";

export type ToastKind = "ok" | "err" | "info";
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
  exiting: boolean;
}

let list: ToastItem[] = [];
let seq = 0;
const subs = new Set<(l: ToastItem[]) => void>();
const emit = () => subs.forEach((s) => s(list));

export function toast(text: string, kind: ToastKind = "ok") {
  const id = ++seq;
  list = [...list, { id, text, kind, exiting: false }].slice(-3);
  emit();
  window.setTimeout(
    () => {
      list = list.map((t) => (t.id === id ? { ...t, exiting: true } : t));
      emit();
      window.setTimeout(() => {
        list = list.filter((t) => t.id !== id);
        emit();
      }, 170);
    },
    kind === "err" ? 3400 : 1600
  );
}

export function Toasts() {
  const [items, setItems] = useState(list);
  useEffect(() => {
    subs.add(setItems);
    return () => {
      subs.delete(setItems);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => {
        const Icon = t.kind === "ok" ? Check : t.kind === "err" ? CircleAlert : Info;
        return (
          <div key={t.id} className={`toast${t.exiting ? " exit" : ""}`}>
            <span className={`ti ${t.kind}`}>
              <Icon size={14} strokeWidth={2.2} />
            </span>
            {t.text}
          </div>
        );
      })}
    </div>
  );
}

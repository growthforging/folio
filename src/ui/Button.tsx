import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  kbd?: string;
  active?: boolean;
  size?: number;
  tipPlace?: "top" | "bottom";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, kbd, active, size = 15, tipPlace, className = "", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ibtn${active ? " on" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      aria-pressed={active}
      data-tip={label}
      data-kbd={kbd}
      data-tip-place={tipPlace}
      {...rest}
    >
      <Icon size={size} strokeWidth={1.8} />
    </button>
  );
});

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: "default" | "primary" | "ghost";
  size?: "sm" | "lg";
  tip?: string;
  kbd?: string;
  children?: ReactNode;
}

export function Button({
  icon: Icon,
  variant = "default",
  size = "sm",
  tip,
  kbd,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn ${variant} ${size}${className ? ` ${className}` : ""}`}
      data-tip={tip}
      data-kbd={kbd}
      {...rest}
    >
      {Icon && <Icon size={size === "lg" ? 15 : 14} strokeWidth={1.9} />}
      {children != null && <span className="btn-label">{children}</span>}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="k">{children}</kbd>;
}

export interface SegOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  tip?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = refs.current.get(value);
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, options]);
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {pill && (
        <span className="seg-pill" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />
      )}
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            className={o.id === value ? "on" : ""}
            ref={(el) => {
              if (el) refs.current.set(o.id, el);
              else refs.current.delete(o.id);
            }}
            onClick={() => onChange(o.id)}
            data-tip={o.tip}
          >
            {Icon && <Icon size={13} strokeWidth={1.9} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

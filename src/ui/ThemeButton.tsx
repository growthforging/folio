import { useRef, useState } from "react";
import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import type { ThemePref } from "../lib/commands";
import { IconButton } from "./Button";
import { Menu } from "./Menu";

export function ThemeButton({
  theme,
  onChange,
  prefer = "below",
}: {
  theme: ThemePref;
  onChange: (t: ThemePref, origin: { x: number; y: number }) => void;
  prefer?: "below" | "above";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : SunMoon;
  const pick = (t: ThemePref) => {
    const r = ref.current?.getBoundingClientRect();
    onChange(t, {
      x: r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: r ? r.top + r.height / 2 : 40,
    });
  };
  return (
    <>
      <IconButton
        ref={ref}
        icon={Icon}
        label="Appearance"
        active={open}
        tipPlace={prefer === "above" ? "top" : "bottom"}
        onClick={() => setOpen((v) => !v)}
      />
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchor={ref.current?.getBoundingClientRect() ?? null}
        anchorEl={ref.current}
        prefer={prefer}
        minWidth={180}
        items={[
          { id: "light", label: "Light", icon: Sun, checked: theme === "light", onSelect: () => pick("light") },
          { id: "dark", label: "Dark", icon: Moon, checked: theme === "dark", onSelect: () => pick("dark") },
          { type: "sep" },
          {
            id: "system",
            label: "Match System",
            icon: Monitor,
            checked: theme === "system",
            onSelect: () => pick("system"),
          },
        ]}
      />
    </>
  );
}

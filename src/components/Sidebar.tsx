import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Braces, Command, Copy, Eye, FileText, FolderOpen, PanelLeftClose, Plus, X } from "lucide-react";
import { KIND, dirOf, isUntitled, isVirtual, type Doc } from "../lib/docs";
import type { Run, ThemePref } from "../lib/commands";
import { IS_TAURI } from "../lib/platform";
import { IconButton } from "../ui/Button";
import { Menu, type MenuEntry } from "../ui/Menu";
import { ThemeButton } from "../ui/ThemeButton";

interface Props {
  docs: Doc[];
  active: string | null;
  dirtyPath: string | null;
  open: boolean;
  width: number;
  onWidth: (w: number) => void;
  theme: ThemePref;
  onTheme: (t: ThemePref, origin: { x: number; y: number }) => void;
  run: Run;
}

type Box = { top: number; h: number };

export function Sidebar({ docs, active, dirtyPath, open, width, onWidth, theme, onTheme, run }: Props) {
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [hover, setHover] = useState<Box | null>(null);
  const [act, setAct] = useState<Box | null>(null);
  const [ctx, setCtx] = useState<{ path: string; x: number; y: number } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLButtonElement>(null);
  const [resizing, setResizing] = useState(false);

  useLayoutEffect(() => {
    const el = active ? itemRefs.current.get(active) : undefined;
    setAct(el ? { top: el.offsetTop, h: el.offsetHeight } : null);
  }, [active, docs, width]);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    const startX = e.clientX;
    const startW = width;
    target.setPointerCapture(e.pointerId);
    setResizing(true);
    const move = (ev: PointerEvent) => onWidth(Math.min(380, Math.max(200, startW + ev.clientX - startX)));
    const up = () => {
      setResizing(false);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const ctxItems: MenuEntry[] = ctx
    ? [
        ...(IS_TAURI && !isVirtual(ctx.path)
          ? [{ id: "reveal", label: "Reveal in Finder", icon: Eye, onSelect: () => run("reveal", ctx.path) } as MenuEntry]
          : []),
        ...(!isUntitled(ctx.path)
          ? [{ id: "copy-path", label: "Copy Path", icon: Copy, onSelect: () => run("copy-path", ctx.path) } as MenuEntry]
          : []),
        { type: "sep" },
        { id: "close", label: "Close", icon: X, kbd: "⌘W", onSelect: () => run("close-doc", ctx.path) },
        { id: "close-others", label: "Close Others", disabled: docs.length < 2, onSelect: () => run("close-others", ctx.path) },
      ]
    : [];

  return (
    <aside className={`sidebar${open ? "" : " closed"}${resizing ? " resizing" : ""}`} aria-hidden={!open}>
      <div className="sb-inner">
        <div className="sb-top" data-tauri-drag-region>
          <IconButton icon={FolderOpen} label="Open file" kbd="⌘O" onClick={() => run("open")} />
          <IconButton
            ref={newRef}
            icon={Plus}
            label="New document"
            kbd="⌘N"
            active={newOpen}
            onClick={() => setNewOpen((v) => !v)}
          />
          <Menu
            open={newOpen}
            onClose={() => setNewOpen(false)}
            anchor={newRef.current?.getBoundingClientRect() ?? null}
            anchorEl={newRef.current}
            align="end"
            items={[
              { id: "md", label: "New Markdown", icon: FileText, kbd: "⌘N", onSelect: () => run("new-md") },
              { id: "json", label: "New JSON", icon: Braces, kbd: "⇧⌘N", onSelect: () => run("new-json") },
            ]}
          />
          <IconButton icon={PanelLeftClose} label="Hide sidebar" kbd="⌘\" onClick={() => run("sidebar")} />
        </div>

        <div className="sb-section">
          <span>Open files</span>
          <span className="count">{docs.length}</span>
        </div>

        <ul className="sb-list" onMouseLeave={() => setHover(null)}>
          <span
            className={`sb-glide sb-glide-hover${hover ? " on" : ""}`}
            style={hover ? { transform: `translateY(${hover.top}px)`, height: hover.h } : undefined}
          />
          <span
            className={`sb-glide sb-glide-active${act ? " on" : ""}`}
            style={act ? { transform: `translateY(${act.top}px)`, height: act.h } : undefined}
          />
          {docs.map((d) => {
            const k = KIND[d.kind];
            const Icon = k.icon;
            const dirty = d.path === dirtyPath;
            return (
              <li
                key={d.path}
                ref={(el) => {
                  if (el) itemRefs.current.set(d.path, el);
                  else itemRefs.current.delete(d.path);
                }}
                className={`sb-item${d.path === active ? " active" : ""}${dirty ? " dirty" : ""}`}
                tabIndex={0}
                aria-current={d.path === active ? "true" : undefined}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  setHover({ top: el.offsetTop, h: el.offsetHeight });
                }}
                onClick={() => run("select-doc", d.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") run("select-doc", d.path);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({ path: d.path, x: e.clientX, y: e.clientY });
                }}
              >
                <Icon className="ico" size={16} strokeWidth={1.8} style={{ color: k.color }} />
                <span className="name">{d.name}</span>
                <span className="side">
                  {dirty && <span className="dot" />}
                  <button
                    type="button"
                    className="close"
                    data-tip="Close"
                    aria-label={`Close ${d.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      run("close-doc", d.path);
                    }}
                  >
                    <X size={13} strokeWidth={2} />
                  </button>
                </span>
                <span className="sub">{dirOf(d.path)}</span>
              </li>
            );
          })}
        </ul>

        <Menu
          open={!!ctx}
          onClose={() => setCtx(null)}
          anchor={ctx ? { x: ctx.x, y: ctx.y } : null}
          items={ctxItems}
        />

        <div className="sb-foot">
          <ThemeButton theme={theme} onChange={onTheme} prefer="above" />
          <IconButton icon={Command} label="Command palette" kbd="⌘K" tipPlace="top" onClick={() => run("palette")} />
          <span className="grow" />
        </div>
      </div>
      <div className="sb-resize" onPointerDown={startResize} aria-hidden="true" />
    </aside>
  );
}

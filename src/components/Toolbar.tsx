import { useRef, useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CodeXml,
  Copy,
  Ellipsis,
  Eye,
  ListTree,
  PanelLeft,
  PenLine,
  Search,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { KIND, isUntitled, isVirtual, type Doc } from "../lib/docs";
import type { MdMode, Run } from "../lib/commands";
import { IS_TAURI } from "../lib/platform";
import { Button, IconButton, Segmented } from "../ui/Button";
import { Menu, type MenuEntry } from "../ui/Menu";

interface Props {
  doc: Doc;
  editing: boolean;
  dirty: boolean;
  mdMode: MdMode;
  outlineOpen: boolean;
  canOutline: boolean;
  sidebarOpen: boolean;
  run: Run;
}

export function Toolbar({ doc, editing, dirty, mdMode, outlineOpen, canOutline, sidebarOpen, run }: Props) {
  const moreRef = useRef<HTMLButtonElement>(null);
  const [more, setMore] = useState(false);
  const k = KIND[doc.kind];
  const Icon = k.icon;

  const moreItems: MenuEntry[] = [
    { id: "copy", label: "Copy Contents", icon: Copy, onSelect: () => run("copy") },
    ...(!isUntitled(doc.path)
      ? [{ id: "copy-path", label: "Copy Path", onSelect: () => run("copy-path") } as MenuEntry]
      : []),
    ...(IS_TAURI && !isVirtual(doc.path)
      ? [{ id: "reveal", label: "Reveal in Finder", icon: Eye, kbd: "⌥⌘R", onSelect: () => run("reveal") } as MenuEntry]
      : []),
    { type: "sep" },
    { id: "zoom-in", label: "Zoom In", icon: ZoomIn, kbd: "⌘+", onSelect: () => run("zoom-in") },
    { id: "zoom-out", label: "Zoom Out", icon: ZoomOut, kbd: "⌘−", onSelect: () => run("zoom-out") },
    { id: "zoom-reset", label: "Actual Size", kbd: "⌘0", onSelect: () => run("zoom-reset") },
    { type: "sep" },
    { id: "close", label: "Close", icon: X, kbd: "⌘W", onSelect: () => run("close-doc") },
  ];

  return (
    <header className="toolbar" data-tauri-drag-region>
      {!sidebarOpen && (
        <IconButton icon={PanelLeft} label="Show sidebar" kbd="⌘\" onClick={() => run("sidebar")} />
      )}
      <div className="tb-title" data-tauri-drag-region>
        <Icon size={15} strokeWidth={1.8} style={{ color: k.color }} />
        <span className="name" data-tauri-drag-region>
          {doc.name}
        </span>
        {dirty && <span className="dirty" aria-label="Unsaved changes" />}
      </div>
      <div className="tb-spacer" data-tauri-drag-region />

      <div className="tb-group">
        <IconButton icon={Search} label="Find" kbd="⌘F" onClick={() => run("find")} />
        {canOutline && (
          <IconButton
            icon={ListTree}
            label={outlineOpen ? "Hide outline" : "Show outline"}
            kbd="⇧⌘O"
            active={outlineOpen}
            onClick={() => run("outline")}
          />
        )}
        {doc.kind === "json" && !editing && (
          <>
            <IconButton icon={ChevronsDownUp} label="Collapse all" onClick={() => run("json-collapse")} />
            <IconButton icon={ChevronsUpDown} label="Expand all" onClick={() => run("json-expand")} />
          </>
        )}
        <IconButton ref={moreRef} icon={Ellipsis} label="More" active={more} onClick={() => setMore((v) => !v)} />
        <Menu
          open={more}
          onClose={() => setMore(false)}
          anchor={moreRef.current?.getBoundingClientRect() ?? null}
          anchorEl={moreRef.current}
          align="end"
          items={moreItems}
        />
      </div>

      <div className="tb-sep" />

      {editing ? (
        <div className="tb-group edit">
          {doc.kind === "json" && (
            <Button onClick={() => run("format-json")} tip="Pretty-print JSON">
              Format
            </Button>
          )}
          {doc.kind === "markdown" && (
            <Segmented<MdMode>
              label="Editing mode"
              value={mdMode}
              onChange={(m) => run(m === "rich" ? "md-rich" : "md-source")}
              options={[
                { id: "rich", label: "Rich", icon: Sparkles, tip: "Notion-style editing" },
                { id: "source", label: "Source", icon: CodeXml, tip: "Raw Markdown" },
              ]}
            />
          )}
          <Button
            variant="primary"
            onClick={() => run("save")}
            disabled={!dirty && !isUntitled(doc.path)}
            tip="Save"
            kbd="⌘S"
          >
            Save
          </Button>
          <Button onClick={() => run("done")} tip="Finish editing" kbd="⇧⌘E">
            Done
          </Button>
        </div>
      ) : (
        <Button icon={PenLine} onClick={() => run("edit")} tip="Edit document" kbd="⌘E">
          Edit
        </Button>
      )}
    </header>
  );
}

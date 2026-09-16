import { Command } from "lucide-react";
import { KIND, displayPath, middleTruncate, type Doc } from "../lib/docs";
import type { Run } from "../lib/commands";

interface Props {
  doc: Doc;
  stats: string[];
  zoom: number;
  editing: boolean;
  dirty: boolean;
  run: Run;
}

export function StatusBar({ doc, stats, zoom, editing, dirty, run }: Props) {
  const path = displayPath(doc.path);
  return (
    <footer className="status">
      <span className="chip">{KIND[doc.kind].short}</span>
      <span className="path" title={path}>
        {middleTruncate(path, 64)}
      </span>
      {editing && <span className={`mode${dirty ? " unsaved" : ""}`}>{dirty ? "Unsaved changes" : "Editing"}</span>}
      <span className="grow" />
      <span className="stats">{stats.join("  ·  ")}</span>
      {zoom !== 1 && (
        <button type="button" className="st-btn" onClick={() => run("zoom-reset")} data-tip="Reset zoom" data-kbd="⌘0" data-tip-place="top">
          {Math.round(zoom * 100)}%
        </button>
      )}
      <button type="button" className="st-btn" onClick={() => run("palette")} data-tip="Command palette" data-kbd="⌘K" data-tip-place="top">
        <Command size={11} strokeWidth={2.2} />
        <span>K</span>
      </button>
    </footer>
  );
}

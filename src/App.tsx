import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { JsonView } from "./JsonTree";
import { Editor } from "./Editor";
import "./App.css";

interface Doc {
  path: string;
  name: string;
  kind: "markdown" | "json" | "text";
  content: string;
  error: string | null;
}

type Theme = "light" | "dark";

const EXTS = ["md", "markdown", "mdx", "json", "jsonc", "geojson", "txt"];
const isUntitled = (p: string) => p.startsWith("untitled://");

function prettySize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function docStats(doc: Doc): string {
  const size = prettySize(new Blob([doc.content]).size);
  if (doc.kind === "markdown") {
    const words = (doc.content.trim().match(/\S+/g) || []).length;
    return `${words} words · ~${Math.max(1, Math.round(words / 200))} min · ${size}`;
  }
  if (doc.kind === "json") {
    try {
      const p = JSON.parse(doc.content);
      const n =
        p && typeof p === "object"
          ? Array.isArray(p)
            ? `${p.length} items`
            : `${Object.keys(p).length} keys`
          : "value";
      return `${n} · ${size}`;
    } catch {
      return `invalid JSON · ${size}`;
    }
  }
  return `${doc.content.split("\n").length} lines · ${size}`;
}

function App() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () =>
      (localStorage.getItem("folio-theme") as Theme) ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem("folio-zoom")) || 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [jsonDepth, setJsonDepth] = useState(2);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [cleanMode, setCleanMode] = useState(() => localStorage.getItem("folio-clean") !== "0");
  const newCounter = useRef(0);

  const activeDoc = useMemo(() => docs.find((d) => d.path === active) ?? null, [docs, active]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("folio-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("folio-zoom", String(zoom));
  }, [zoom]);

  useEffect(() => {
    localStorage.setItem("folio-clean", cleanMode ? "1" : "0");
  }, [cleanMode]);

  const addPaths = useCallback(async (paths: string[]) => {
    if (!paths.length) return;
    const results = await invoke<Doc[]>("read_docs", { paths });
    setDocs((prev) => {
      const byPath = new Map(prev.map((d) => [d.path, d]));
      for (const d of results) byPath.set(d.path, d);
      return Array.from(byPath.values());
    });
    const last = results[results.length - 1];
    if (last) {
      setEditing(false);
      setActive(last.path);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") setDragging(true);
        else if (event.payload.type === "drop") {
          setDragging(false);
          void addPaths(event.payload.paths);
        } else setDragging(false);
      })
      .then((u) => {
        unlisten = u;
      });
    return () => unlisten?.();
  }, [addPaths]);

  // "Open with Folio": files from launch (cold) + while running (warm).
  useEffect(() => {
    invoke<string[]>("take_pending")
      .then((paths) => {
        if (paths.length) void addPaths(paths);
      })
      .catch(() => {});
    let unlisten: (() => void) | undefined;
    listen<string[]>("open-files", (e) => void addPaths(e.payload)).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, [addPaths]);

  const browse = useCallback(async () => {
    const sel = await open({ multiple: true, filters: [{ name: "Documents", extensions: EXTS }] });
    if (!sel) return;
    void addPaths(Array.isArray(sel) ? sel : [sel]);
  }, [addPaths]);

  const newDoc = useCallback((kind: "markdown" | "json") => {
    newCounter.current += 1;
    const n = newCounter.current;
    const path = `untitled://${n}`;
    const name = kind === "json" ? `Untitled-${n}.json` : `Untitled-${n}.md`;
    const content = kind === "json" ? "{\n  \n}\n" : "# Untitled\n\n";
    setDocs((prev) => [...prev, { path, name, kind, content, error: null }]);
    setActive(path);
    setDraft(content);
    setEditing(true);
    setNewMenuOpen(false);
  }, []);

  const selectDoc = useCallback((path: string) => {
    setEditing(false);
    setActive(path);
  }, []);

  const closeDoc = useCallback(
    (path: string) => {
      const idx = docs.findIndex((d) => d.path === path);
      const next = docs.filter((d) => d.path !== path);
      setDocs(next);
      if (active === path) {
        const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
        setActive(fallback ? fallback.path : null);
        setEditing(false);
      }
    },
    [docs, active]
  );

  const startEdit = useCallback(() => {
    if (!activeDoc) return;
    setDraft(activeDoc.content);
    setEditing(true);
  }, [activeDoc]);

  const saveAs = useCallback(async () => {
    const oldPath = activeDoc?.path;
    const wasUntitled = oldPath ? isUntitled(oldPath) : false;
    const path = await save({
      defaultPath: activeDoc?.name,
      filters: [{ name: "Documents", extensions: EXTS }],
    });
    if (!path) return;
    try {
      await invoke("write_file", { path, content: draft });
      const results = await invoke<Doc[]>("read_docs", { paths: [path] });
      setDocs((prev) => {
        let list = prev;
        if (wasUntitled && oldPath) list = list.filter((d) => d.path !== oldPath);
        const byPath = new Map(list.map((d) => [d.path, d]));
        for (const d of results) byPath.set(d.path, d);
        return Array.from(byPath.values());
      });
      setEditing(false);
      setActive(path);
    } catch (e) {
      alert(String(e));
    }
  }, [activeDoc, draft]);

  const saveOverwrite = useCallback(async () => {
    if (!activeDoc) return;
    if (isUntitled(activeDoc.path)) {
      await saveAs();
      return;
    }
    try {
      await invoke("write_file", { path: activeDoc.path, content: draft });
      setDocs((prev) =>
        prev.map((d) => (d.path === activeDoc.path ? { ...d, content: draft, error: null } : d))
      );
      setEditing(false);
    } catch (e) {
      alert(String(e));
    }
  }, [activeDoc, draft, saveAs]);

  const formatJson = useCallback(() => {
    try {
      setDraft((d) => JSON.stringify(JSON.parse(d), null, 2));
    } catch {
      /* leave as-is if not valid JSON */
    }
  }, []);

  const copyContent = useCallback(() => {
    if (activeDoc) void navigator.clipboard?.writeText(activeDoc.content).catch(() => {});
  }, [activeDoc]);

  const reveal = useCallback(() => {
    if (activeDoc && !isUntitled(activeDoc.path))
      void invoke("reveal_in_finder", { path: activeDoc.path }).catch(() => {});
  }, [activeDoc]);

  const runFind = useCallback((q: string) => {
    if (!q) return;
    (window as unknown as { find?: (...a: unknown[]) => boolean }).find?.(q, false, false, true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (meta && k === "f") {
        e.preventDefault();
        setFindOpen(true);
      } else if (e.key === "Escape") {
        setFindOpen(false);
      } else if (meta && k === "n") {
        e.preventDefault();
        newDoc(e.shiftKey ? "json" : "markdown");
      } else if (meta && k === "o") {
        e.preventDefault();
        void browse();
      } else if (meta && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => Math.min(2.2, +(z + 0.1).toFixed(2)));
      } else if (meta && e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)));
      } else if (meta && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      } else if (meta && k === "s" && editing) {
        e.preventDefault();
        void saveOverwrite();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, saveOverwrite, newDoc, browse]);

  const themeBtn = (
    <button
      className="icon-btn"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      title="Toggle light / dark"
    >
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );

  return (
    <div className={`app ${docs.length ? "has-docs" : ""}`}>
      {docs.length > 0 && !cleanMode && (
        <aside className="sidebar">
          <div className="sidebar-head">
            <span className="brand">Folio</span>
            <div className="head-actions">
              <div className="newwrap">
                <button className="ghost" onClick={() => setNewMenuOpen((v) => !v)}>
                  ＋ New
                </button>
                {newMenuOpen && (
                  <>
                    <div className="backdrop" onClick={() => setNewMenuOpen(false)} />
                    <div className="newmenu">
                      <button onClick={() => newDoc("markdown")}>New Markdown</button>
                      <button onClick={() => newDoc("json")}>New JSON</button>
                    </div>
                  </>
                )}
              </div>
              <button className="ghost" onClick={browse}>
                Open…
              </button>
            </div>
          </div>
          <ul className="files">
            {docs.map((d) => (
              <li
                key={d.path}
                className={d.path === active ? "active" : ""}
                onClick={() => selectDoc(d.path)}
                title={d.path}
              >
                <span className={`kind kind-${d.kind}`}>
                  {d.kind === "markdown" ? "MD" : d.kind === "json" ? "{ }" : "TXT"}
                </span>
                <span className="fname">{d.name}</span>
                <button
                  className="close"
                  title="Close (doesn't delete the file)"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDoc(d.path);
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <main className={`viewer ${dragging ? "dragging" : ""}`} style={{ "--scale": zoom } as CSSProperties}>
        {!activeDoc ? (
          <div className="empty">
            <div className="empty-toolbar">{themeBtn}</div>
            <div className="empty-card">
              <div className="empty-logo">📄</div>
              <h1>Folio</h1>
              <p>
                Drop a <strong>.md</strong> or <strong>.json</strong> file here to view it.
              </p>
              <button className="primary" onClick={browse}>
                Open a file…
              </button>
              <div className="empty-new">
                <button className="link" onClick={() => newDoc("markdown")}>
                  New Markdown
                </button>
                <span>·</span>
                <button className="link" onClick={() => newDoc("json")}>
                  New JSON
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="toolbar">
              <button
                className="icon-btn"
                title={cleanMode ? "Show sidebar" : "Hide sidebar (clean mode)"}
                onClick={() => setCleanMode((c) => !c)}
              >
                ☰
              </button>
              <div className="tb-left">
                <span className="tb-name">{activeDoc.name}</span>
                <span className="tb-stats">{docStats(activeDoc)}</span>
              </div>
              <div className="tb-right">
                <button className="icon-btn" title="Find (⌘F)" onClick={() => setFindOpen((v) => !v)}>
                  ⌕
                </button>
                <button className="icon-btn" title="Zoom out (⌘−)" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))}>
                  A−
                </button>
                <button className="icon-btn" title="Zoom in (⌘+)" onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.1).toFixed(2)))}>
                  A+
                </button>
                {activeDoc.kind === "json" && !editing && (
                  <>
                    <button className="icon-btn" title="Collapse all" onClick={() => setJsonDepth(1)}>
                      ⊟
                    </button>
                    <button className="icon-btn" title="Expand all" onClick={() => setJsonDepth(99)}>
                      ⊞
                    </button>
                  </>
                )}
                <button className="icon-btn" title="Copy contents" onClick={copyContent}>
                  ⧉
                </button>
                {!isUntitled(activeDoc.path) && (
                  <button className="icon-btn" title="Reveal in Finder" onClick={reveal}>
                    ⤴
                  </button>
                )}
                {!editing ? (
                  <button className="tb-btn" onClick={startEdit}>
                    ✎ Edit
                  </button>
                ) : (
                  <span className="edit-actions">
                    {activeDoc.kind === "json" && (
                      <button className="tb-btn" onClick={formatJson} title="Pretty-print JSON">
                        Format
                      </button>
                    )}
                    <button className="tb-btn" onClick={saveAs}>
                      Save as…
                    </button>
                    <button className="tb-btn primary-btn" onClick={saveOverwrite} title="Save (⌘S)">
                      Save
                    </button>
                    <button className="tb-btn" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </span>
                )}
                {themeBtn}
              </div>
            </header>

            {findOpen && (
              <div className="findbar">
                <input
                  autoFocus
                  placeholder="Find in document…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runFind(query);
                    if (e.key === "Escape") setFindOpen(false);
                  }}
                />
                <button className="icon-btn" onClick={() => runFind(query)} title="Next">
                  ↵
                </button>
                <button className="icon-btn" onClick={() => setFindOpen(false)} title="Close">
                  ✕
                </button>
              </div>
            )}

            {editing ? (
              <Editor key={activeDoc.path} value={draft} language={activeDoc.kind} onChange={setDraft} />
            ) : activeDoc.error ? (
              <div className="pane json-error">⚠ {activeDoc.error}</div>
            ) : activeDoc.kind === "markdown" ? (
              <article className="pane prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {activeDoc.content}
                </ReactMarkdown>
              </article>
            ) : activeDoc.kind === "json" ? (
              <div className="pane">
                <JsonView key={`${activeDoc.path}:${jsonDepth}`} content={activeDoc.content} openDepth={jsonDepth} />
              </div>
            ) : (
              <pre className="pane raw">{activeDoc.content}</pre>
            )}
          </>
        )}
        {dragging && <div className="drop-overlay">Drop to open</div>}
      </main>
    </div>
  );
}

export default App;

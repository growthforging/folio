import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import {
  Braces,
  ChevronsDownUp,
  ChevronsUpDown,
  CodeXml,
  Copy,
  Eye,
  FileDown,
  FileText,
  FolderOpen,
  ListTree,
  Monitor,
  Moon,
  PanelLeft,
  PenLine,
  Save,
  Search,
  Sparkles,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { StatusBar } from "./components/StatusBar";
import { Welcome } from "./components/Welcome";
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { FindBar } from "./components/FindBar";
import { MarkdownView } from "./components/MarkdownView";
import { Outline, useHeadings } from "./components/Outline";
import { JsonView } from "./components/JsonTree";
import { CsvEditor, CsvTable } from "./components/CsvTable";
import { Editor, type EditorHandle } from "./components/Editor";
import { NotionEditor } from "./components/NotionEditor";
import { ErrorState } from "./ui/ErrorState";
import { Toasts, toast } from "./ui/Toast";
import { TooltipLayer } from "./ui/Tooltip";
import { isCmd, type Cmd, type MdMode, type Run, type ThemePref } from "./lib/commands";
import {
  KIND,
  UNTITLED,
  baseName,
  byteLength,
  dirOf,
  docStats,
  isUntitled,
  isVirtual,
  kindFor,
  setHome,
  type Doc,
  type DocKind,
  type Recent,
} from "./lib/docs";
import { useMediaQuery, usePersisted, usePresence, useReducedMotion } from "./lib/hooks";
import {
  IS_TAURI,
  confirmDialog,
  getHome,
  onFileDrop,
  onMenu,
  onOpenFiles,
  onWindowFocus,
  pickFiles,
  pickSavePath,
  readPaths,
  revealInFinder,
  setWindowTheme,
  setWindowTitle,
  takePending,
  writeDoc,
} from "./lib/platform";
import { demoDocs } from "./demo";
import "./styles/index.css";

/* Browser-only demo switches (used for screenshots): ?doc=welcome.md&theme=dark&edit=rich */
const DEMO = IS_TAURI ? new URLSearchParams() : new URLSearchParams(window.location.search);
const INITIAL_DOCS: Doc[] = IS_TAURI || DEMO.get("doc") === "none" ? [] : demoDocs();
const DEMO_DOC = INITIAL_DOCS.find((d) => d.name === DEMO.get("doc")) ?? INITIAL_DOCS[0] ?? null;
const DEMO_THEME = DEMO.get("theme");
const DEMO_EDIT = DEMO.get("edit");
const isBool = (v: unknown) => typeof v === "boolean";
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const clampZoom = (z: number) => Math.min(2.2, Math.max(0.7, +z.toFixed(2)));

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

export default function App() {
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
  const [active, setActive] = useState<string | null>(DEMO_DOC?.path ?? null);
  const [theme, setTheme] = usePersisted<ThemePref>(
    "folio.theme",
    DEMO_THEME === "light" || DEMO_THEME === "dark" ? DEMO_THEME : "system",
    (v) => (DEMO_THEME ? false : v === "light" || v === "dark" || v === "system")
  );
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const reduced = useReducedMotion();
  const [zoom, setZoom] = usePersisted<number>("folio.zoom", 1, isNum);
  const [sidebarOpen, setSidebarOpen] = usePersisted<boolean>("folio.sidebar", true, isBool);
  const [sidebarWidth, setSidebarWidth] = usePersisted<number>("folio.sidebarWidth", 248, isNum);
  const [outlineOpen, setOutlineOpen] = usePersisted<boolean>("folio.outline", true, isBool);
  const [mdMode, setMdMode] = usePersisted<MdMode>(
    "folio.mdMode",
    DEMO_EDIT === "source" ? "source" : "rich",
    (v) => (DEMO_EDIT ? false : v === "rich" || v === "source")
  );
  const [recents, setRecents] = usePersisted<Recent[]>("folio.recents", [], Array.isArray);
  const [editing, setEditing] = useState(DEMO_EDIT !== null && DEMO_DOC !== null);
  const [draft, setDraft] = useState(DEMO_EDIT !== null && DEMO_DOC ? DEMO_DOC.content : "");
  const [jsonDepth, setJsonDepth] = useState(2);
  const [editorReady, setEditorReady] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [, rerender] = useState(0);

  const newCounter = useRef(0);
  const proseRef = useRef<HTMLElement | null>(null);
  const ghostProseRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  /* The editors report every keystroke synchronously into `draftRef`; React
     state follows a beat later so typing never waits on a full re-render. */
  const draftRef = useRef(DEMO_EDIT !== null && DEMO_DOC ? DEMO_DOC.content : "");
  const draftTimer = useRef(0);
  const updateDraft = useCallback((v: string) => {
    draftRef.current = v;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = 0;
      setDraft(v);
    }, 80);
  }, []);
  const resetDraft = useCallback((v: string) => {
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = 0;
    draftRef.current = v;
    setDraft(v);
  }, []);

  /* Scroll position carried across view switches (read ↔ edit, rich ↔ source). */
  type Layout = "prose" | "other";
  const pendingScroll = useRef<{ top: number; ratio: number; layout: Layout } | null>(null);
  const layoutOf = (edit: boolean, mode: MdMode, kind?: DocKind): Layout =>
    kind === "markdown" && (!edit || mode === "rich") ? "prose" : "other";
  const applyScroll = useCallback((el: HTMLElement | null, layout: Layout, consume: boolean) => {
    const memo = pendingScroll.current;
    if (!el || !memo) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = memo.layout === "prose" && layout === "prose" ? Math.min(memo.top, max) : memo.ratio * max;
    if (consume) pendingScroll.current = null;
  }, []);

  const activeDoc = useMemo(() => docs.find((d) => d.path === active) ?? null, [docs, active]);
  const dirty = editing && activeDoc !== null && draft !== activeDoc.content;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const stats = useMemo(() => (activeDoc ? docStats(activeDoc) : []), [activeDoc]);
  const captureScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !activeDoc) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    pendingScroll.current = {
      top: el.scrollTop,
      ratio: max > 0 ? el.scrollTop / max : 0,
      layout: layoutOf(editing, mdMode, activeDoc.kind),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc, editing, mdMode]);
  const reading = activeDoc?.kind === "markdown" && !editing && !activeDoc.error;
  const { headings, activeId, setActiveId } = useHeadings(
    scrollerRef,
    proseRef,
    reading,
    activeDoc ? `${activeDoc.path}:${activeDoc.content.length}:${activeDoc.modified ?? 0}` : ""
  );
  const canOutline = reading && headings.length >= 2;

  /* ---- environment sync ------------------------------------------------ */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    setWindowTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    setWindowTitle(activeDoc ? `${activeDoc.name}${dirty ? " — Edited" : ""}` : "Folio");
  }, [activeDoc, dirty]);

  useEffect(
    () => onWindowFocus((focused) => document.documentElement.toggleAttribute("data-inactive", !focused)),
    []
  );

  useEffect(() => {
    void getHome().then((h) => {
      setHome(h);
      rerender((n) => n + 1);
    });
  }, []);

  const changeTheme = useCallback(
    (pref: ThemePref, origin?: { x: number; y: number }) => {
      const next = pref === "system" ? (systemDark ? "dark" : "light") : pref;
      const docEl = document as ViewTransitionDoc;
      if (next === resolved || !docEl.startViewTransition || reduced) {
        setTheme(pref);
        return;
      }
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? 40;
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = docEl.startViewTransition(() => {
        document.documentElement.setAttribute("data-theme", next);
        flushSync(() => setTheme(pref));
      });
      transition.ready
        .then(() => {
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
            { duration: 460, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
          );
        })
        .catch(() => {});
    },
    [systemDark, resolved, reduced, setTheme]
  );

  /* ---- documents ------------------------------------------------------- */
  const pushRecent = useCallback(
    (d: Doc) => {
      if (isVirtual(d.path) || d.error) return;
      setRecents((prev) =>
        [{ path: d.path, name: d.name, kind: d.kind, at: Date.now() }, ...prev.filter((r) => r.path !== d.path)].slice(
          0,
          12
        )
      );
    },
    [setRecents]
  );

  const addDocs = useCallback(
    (incoming: Doc[]) => {
      if (!incoming.length) return;
      setDocs((prev) => {
        const byPath = new Map(prev.map((d) => [d.path, d]));
        for (const d of incoming) byPath.set(d.path, d);
        return Array.from(byPath.values());
      });
      for (const d of incoming) {
        if (d.error) toast(`Couldn't open ${d.name}`, "err");
        else pushRecent(d);
      }
      const last = incoming[incoming.length - 1];
      if (dirtyRef.current) {
        toast(incoming.length === 1 ? `Opened ${last.name}` : `Opened ${incoming.length} files`, "info");
        return;
      }
      setEditing(false);
      setActive(last.path);
    },
    [pushRecent]
  );

  const discardIfDirty = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current || !activeDoc) return true;
    return confirmDialog(`Discard unsaved changes to ${activeDoc.name}?`, { ok: "Discard", cancel: "Keep Editing" });
  }, [activeDoc]);

  const selectDoc = useCallback(
    async (path: string) => {
      if (path === active) return;
      if (!(await discardIfDirty())) return;
      pendingScroll.current = null;
      setEditing(false);
      setActive(path);
    },
    [active, discardIfDirty]
  );

  const closeDoc = useCallback(
    async (path: string) => {
      const doc = docs.find((d) => d.path === path);
      if (!doc) return;
      if (path === active && !(await discardIfDirty())) return;
      const idx = docs.findIndex((d) => d.path === path);
      const next = docs.filter((d) => d.path !== path);
      setDocs(next);
      if (active === path) {
        const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
        setActive(fallback ? fallback.path : null);
        setEditing(false);
      }
    },
    [docs, active, discardIfDirty]
  );

  const closeOthers = useCallback(
    async (path: string) => {
      const keep = docs.find((d) => d.path === path);
      if (!keep) return;
      if (active !== path && !(await discardIfDirty())) return;
      setDocs([keep]);
      if (active !== path) {
        setActive(path);
        setEditing(false);
      }
    },
    [docs, active, discardIfDirty]
  );

  const closeAll = useCallback(async () => {
    if (!(await discardIfDirty())) return;
    setDocs([]);
    setActive(null);
    setEditing(false);
  }, [discardIfDirty]);

  const newDoc = useCallback(
    async (kind: "markdown" | "json") => {
      if (!(await discardIfDirty())) return;
      newCounter.current += 1;
      const n = newCounter.current;
      const path = `${UNTITLED}${n}`;
      const name = kind === "json" ? `Untitled-${n}.json` : `Untitled-${n}.md`;
      const content = kind === "json" ? "{\n  \n}\n" : "# Untitled\n\n";
      setDocs((prev) => [...prev, { path, name, kind, content, error: null, size: byteLength(content), modified: Date.now() }]);
      setActive(path);
      pendingScroll.current = null;
      resetDraft(content);
      setEditing(true);
      setFindOpen(false);
    },
    [discardIfDirty, resetDraft]
  );

  const startEdit = useCallback(() => {
    if (!activeDoc || activeDoc.error) return;
    captureScroll();
    resetDraft(activeDoc.content);
    setEditing(true);
    setFindOpen(false);
  }, [activeDoc, captureScroll, resetDraft]);

  const saveDoc = useCallback(
    async (as: boolean): Promise<boolean> => {
      if (!activeDoc || !editing) return false;
      let path = activeDoc.path;
      if (as || isUntitled(path)) {
        const picked = await pickSavePath(activeDoc.name);
        if (!picked) return false;
        path = picked;
      }
      const text = draftRef.current;
      try {
        await writeDoc(path, text);
      } catch (e) {
        toast(String(e), "err");
        return false;
      }
      resetDraft(text);
      const now = Date.now();
      const size = byteLength(text);
      if (path !== activeDoc.path) {
        const name = baseName(path);
        const updated: Doc = { ...activeDoc, path, name, kind: kindFor(name), content: text, error: null, modified: now, size };
        setDocs((prev) => prev.map((d) => (d.path === activeDoc.path ? updated : d)));
        setActive(path);
        pushRecent(updated);
      } else {
        setDocs((prev) => prev.map((d) => (d.path === path ? { ...d, content: text, modified: now, size } : d)));
      }
      toast(isVirtual(path) ? "Downloaded" : "Saved");
      return true;
    },
    [activeDoc, editing, pushRecent, resetDraft]
  );

  const finishEdit = useCallback(async () => {
    if (!editing || !activeDoc) return;
    if (draftRef.current !== activeDoc.content) {
      const save = await confirmDialog(`Save changes to ${activeDoc.name}?`, { ok: "Save", cancel: "Don't Save" });
      if (save && !(await saveDoc(false))) return;
    }
    captureScroll();
    setEditing(false);
  }, [editing, activeDoc, saveDoc, captureScroll]);

  const formatJson = useCallback(() => {
    try {
      resetDraft(JSON.stringify(JSON.parse(draftRef.current), null, 2) + "\n");
      toast("Formatted");
    } catch {
      toast("Not valid JSON yet", "err");
    }
  }, [resetDraft]);

  const copyText = useCallback((text: string, label: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    toast(label);
  }, []);

  const jumpTo = useCallback(
    (id: string) => {
      setActiveId(id);
      document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    },
    [reduced, setActiveId]
  );

  const openFind = useCallback(() => {
    if (!activeDoc) return;
    const usesCodeMirror = editing && (activeDoc.kind === "json" || activeDoc.kind === "text" || (activeDoc.kind === "markdown" && mdMode === "source"));
    if (usesCodeMirror) {
      editorRef.current?.openSearch();
      return;
    }
    if (editing && activeDoc.kind === "csv") {
      toast("Finish editing to search the table", "info");
      return;
    }
    setFindOpen(true);
  }, [activeDoc, editing, mdMode]);

  /* ---- command dispatcher ---------------------------------------------- */
  const run: Run = useCallback(
    (cmd: Cmd, arg?: string) => {
      const target = arg ?? active ?? undefined;
      switch (cmd) {
        case "open":
          void pickFiles().then(addDocs).catch(() => {});
          break;
        case "new-md":
          void newDoc("markdown");
          break;
        case "new-json":
          void newDoc("json");
          break;
        case "close-doc":
          if (target) void closeDoc(target);
          break;
        case "close-others":
          if (target) void closeOthers(target);
          break;
        case "close-all":
          void closeAll();
          break;
        case "save":
          void saveDoc(false);
          break;
        case "save-as":
          void saveDoc(true);
          break;
        case "reveal":
          if (target && !isVirtual(target)) revealInFinder(target);
          break;
        case "copy":
          if (activeDoc) copyText(editing ? draftRef.current : activeDoc.content, "Copied contents");
          break;
        case "copy-path":
          if (target && !isUntitled(target)) copyText(target, "Copied path");
          break;
        case "find":
          openFind();
          break;
        case "edit":
          startEdit();
          break;
        case "done":
          void finishEdit();
          break;
        case "sidebar":
          setSidebarOpen((v) => !v);
          break;
        case "outline":
          setOutlineOpen((v) => !v);
          break;
        case "palette":
          setPaletteOpen((v) => !v);
          break;
        case "zoom-in":
          setZoom((z) => clampZoom(z + 0.1));
          break;
        case "zoom-out":
          setZoom((z) => clampZoom(z - 0.1));
          break;
        case "zoom-reset":
          setZoom(1);
          break;
        case "format-json":
          formatJson();
          break;
        case "json-expand":
          setJsonDepth(99);
          break;
        case "json-collapse":
          setJsonDepth(1);
          break;
        case "md-rich":
          if (editing) captureScroll();
          setMdMode("rich");
          break;
        case "md-source":
          if (editing) captureScroll();
          setMdMode("source");
          break;
        case "md-toggle":
          if (editing) captureScroll();
          setMdMode((m) => (m === "rich" ? "source" : "rich"));
          break;
        case "theme-light":
          changeTheme("light");
          break;
        case "theme-dark":
          changeTheme("dark");
          break;
        case "theme-system":
          changeTheme("system");
          break;
        case "select-doc":
          if (arg) void selectDoc(arg);
          break;
        case "open-recent":
          if (arg) {
            void readPaths([arg]).then((res) => {
              if (res.some((d) => d.error)) setRecents((prev) => prev.filter((r) => r.path !== arg));
              addDocs(res);
            });
          }
          break;
        case "remove-recent":
          if (arg) setRecents((prev) => prev.filter((r) => r.path !== arg));
          break;
      }
    },
    [
      active,
      activeDoc,
      editing,
      captureScroll,
      addDocs,
      newDoc,
      closeDoc,
      closeOthers,
      closeAll,
      saveDoc,
      copyText,
      openFind,
      startEdit,
      finishEdit,
      formatJson,
      changeTheme,
      selectDoc,
      setSidebarOpen,
      setOutlineOpen,
      setZoom,
      setMdMode,
      setRecents,
    ]
  );
  const runRef = useRef(run);
  runRef.current = run;

  /* ---- host events ----------------------------------------------------- */
  useEffect(
    () =>
      onFileDrop({
        over: () => setDragging(true),
        leave: () => setDragging(false),
        drop: (p) => void p.then(addDocs).catch(() => setDragging(false)),
      }),
    [addDocs]
  );

  useEffect(() => {
    void takePending().then((paths) => {
      if (paths.length) void readPaths(paths).then(addDocs);
    });
    return onOpenFiles((paths) => void readPaths(paths).then(addDocs));
  }, [addDocs]);

  useEffect(
    () =>
      onMenu((id) => {
        if (isCmd(id)) runRef.current(id);
      }),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (findOpen) setFindOpen(false);
        return;
      }
      if (e.defaultPrevented) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // Under Tauri the native menu bar owns these accelerators.
      if (IS_TAURI) return;
      const k = e.key;
      const shift = e.shiftKey;
      let cmd: Cmd | null = null;
      if (k === "k" || k === "K") cmd = "palette";
      else if (k === "\\") cmd = "sidebar";
      else if (shift && k === "O") cmd = "outline";
      else if (k === "o") cmd = "open";
      else if (shift && k === "N") cmd = "new-json";
      else if (k === "n") cmd = "new-md";
      else if (shift && k === "S") cmd = "save-as";
      else if (k === "s") cmd = "save";
      else if (k === "f") cmd = "find";
      else if (shift && k === "E") cmd = "done";
      else if (k === "e") cmd = "edit";
      else if (k === "w") cmd = "close-doc";
      else if (k === "=" || k === "+") cmd = "zoom-in";
      else if (k === "-") cmd = "zoom-out";
      else if (k === "0") cmd = "zoom-reset";
      else if (shift && k === "M") cmd = "md-toggle";
      else if (e.altKey && (k === "r" || k === "®")) cmd = "reveal";
      if (!cmd) return;
      e.preventDefault();
      runRef.current(cmd);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, findOpen]);

  /* ---- command palette -------------------------------------------------- */
  const paletteActions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];
    const add = (id: string, label: string, group: string, run: () => void, extra: Partial<PaletteAction> = {}) =>
      list.push({ id, label, group, run, ...extra });
    const r = (cmd: Cmd, arg?: string) => () => runRef.current(cmd, arg);

    if (activeDoc) {
      if (!editing) add("edit", "Edit document", "Document", r("edit"), { icon: PenLine, kbd: "⌘E" });
      else {
        add("save", "Save", "Document", r("save"), { icon: Save, kbd: "⌘S" });
        add("save-as", "Save as…", "Document", r("save-as"), { kbd: "⇧⌘S" });
        add("done", "Finish editing", "Document", r("done"), { kbd: "⇧⌘E" });
        if (activeDoc.kind === "markdown")
          add("md-toggle", mdMode === "rich" ? "Switch to source editing" : "Switch to rich editing", "Document", r("md-toggle"), {
            icon: mdMode === "rich" ? CodeXml : Sparkles,
            kbd: "⇧⌘M",
          });
        if (activeDoc.kind === "json") add("format-json", "Format JSON", "Document", r("format-json"), { icon: Braces });
      }
      add("find", "Find in document", "Document", r("find"), { icon: Search, kbd: "⌘F" });
      add("copy", "Copy contents", "Document", r("copy"), { icon: Copy });
      if (!isUntitled(activeDoc.path)) add("copy-path", "Copy path", "Document", r("copy-path"), { keywords: "clipboard" });
      if (IS_TAURI && !isVirtual(activeDoc.path))
        add("reveal", "Reveal in Finder", "Document", r("reveal"), { icon: Eye, kbd: "⌥⌘R" });
      if (activeDoc.kind === "json" && !editing) {
        add("json-expand", "Expand all", "Document", r("json-expand"), { icon: ChevronsUpDown });
        add("json-collapse", "Collapse all", "Document", r("json-collapse"), { icon: ChevronsDownUp });
      }
      add("close-doc", "Close document", "Document", r("close-doc"), { icon: X, kbd: "⌘W" });
      if (docs.length > 1) add("close-others", "Close other documents", "Document", r("close-others"));
    }
    add("open", "Open file…", "Folio", r("open"), { icon: FolderOpen, kbd: "⌘O" });
    add("new-md", "New Markdown", "Folio", r("new-md"), { icon: FileText, kbd: "⌘N" });
    add("new-json", "New JSON", "Folio", r("new-json"), { icon: Braces, kbd: "⇧⌘N" });
    if (docs.length) add("sidebar", sidebarOpen ? "Hide sidebar" : "Show sidebar", "View", r("sidebar"), { icon: PanelLeft, kbd: "⌘\\" });
    if (canOutline) add("outline", outlineOpen ? "Hide outline" : "Show outline", "View", r("outline"), { icon: ListTree, kbd: "⇧⌘O" });
    add("zoom-in", "Zoom in", "View", r("zoom-in"), { icon: ZoomIn, kbd: "⌘+" });
    add("zoom-out", "Zoom out", "View", r("zoom-out"), { icon: ZoomOut, kbd: "⌘−" });
    add("zoom-reset", "Actual size", "View", r("zoom-reset"), { kbd: "⌘0" });
    add("theme-light", "Light appearance", "Appearance", r("theme-light"), { icon: Sun });
    add("theme-dark", "Dark appearance", "Appearance", r("theme-dark"), { icon: Moon });
    add("theme-system", "Match system appearance", "Appearance", r("theme-system"), { icon: Monitor });
    for (const d of docs)
      if (d.path !== active)
        add(`doc:${d.path}`, d.name, "Open files", r("select-doc", d.path), { icon: KIND[d.kind].icon, sub: dirOf(d.path), keywords: "switch go to" });
    for (const rc of recents)
      if (!docs.some((d) => d.path === rc.path))
        add(`recent:${rc.path}`, rc.name, "Recent", r("open-recent", rc.path), { icon: KIND[rc.kind].icon, sub: dirOf(rc.path), keywords: "recent" });
    return list;
  }, [activeDoc, editing, mdMode, docs, active, sidebarOpen, outlineOpen, canOutline, recents]);

  /* ---- render ----------------------------------------------------------- */
  const hasDocs = docs.length > 0;
  const appStyle = { "--scale": zoom, "--sb-w": `${sidebarWidth}px` } as CSSProperties;
  const viewKey = activeDoc ? `${activeDoc.path}:${editing ? `edit-${mdMode}` : "read"}` : "";
  const findKey = activeDoc ? `${viewKey}:${activeDoc.content.length}` : "";
  const richEditing = editing && activeDoc?.kind === "markdown" && mdMode === "rich";
  const showGhost = richEditing && !editorReady;
  const ghost = usePresence(showGhost, 240);

  // A new view: restore the carried scroll position. The rich editor and the
  // code editor restore their own once they have mounted.
  useLayoutEffect(() => {
    setEditorReady(false);
    if (!activeDoc) return;
    if (richEditing) {
      applyScroll(ghostRef.current, "prose", false);
      return;
    }
    if (!editing || activeDoc.kind === "csv") {
      applyScroll(scrollerRef.current, layoutOf(editing, mdMode, activeDoc.kind), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  return (
    <div className={`app${sidebarOpen ? "" : " sb-closed"}${hasDocs ? "" : " no-docs"}`} style={appStyle}>
      {hasDocs && (
        <Sidebar
          docs={docs}
          active={active}
          dirtyPath={dirty && activeDoc ? activeDoc.path : null}
          open={sidebarOpen}
          width={sidebarWidth}
          onWidth={setSidebarWidth}
          theme={theme}
          onTheme={changeTheme}
          run={run}
        />
      )}

      <main className="main">
        {!activeDoc ? (
          <Welcome recents={recents} theme={theme} onTheme={changeTheme} run={run} />
        ) : (
          <>
            <Toolbar
              doc={activeDoc}
              editing={editing}
              dirty={dirty}
              mdMode={mdMode}
              outlineOpen={outlineOpen}
              canOutline={canOutline}
              sidebarOpen={sidebarOpen}
              run={run}
            />

            <div className="view" key={viewKey} ref={viewRef}>
              {editing ? (
                activeDoc.kind === "csv" ? (
                  <div className="pane" ref={scrollerRef as RefObject<HTMLDivElement>}>
                    <CsvEditor content={draft} onChange={updateDraft} />
                  </div>
                ) : richEditing ? (
                  <div className="edit-stack">
                    <NotionEditor
                      value={draft}
                      onChange={updateDraft}
                      scrollRef={scrollerRef}
                      onReady={() => {
                        applyScroll(scrollerRef.current, "prose", true);
                        setEditorReady(true);
                      }}
                    />
                    {(showGhost || ghost.mounted) && (
                      <div className={`pane ghost${ghost.exiting ? " exit" : ""}`} ref={ghostRef} aria-hidden="true">
                        <div className="prose-wrap">
                          <MarkdownView content={draftRef.current} proseRef={ghostProseRef} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Editor
                    ref={editorRef}
                    value={draft}
                    language={activeDoc.kind === "json" ? "json" : activeDoc.kind === "markdown" ? "markdown" : "text"}
                    onChange={updateDraft}
                    scrollRef={scrollerRef}
                    onReady={() => applyScroll(scrollerRef.current, "other", true)}
                  />
                )
              ) : activeDoc.error ? (
                <ErrorState title={`Couldn't open ${activeDoc.name}`} detail={activeDoc.error} />
              ) : activeDoc.kind === "markdown" ? (
                <div className="reading">
                  <div className="pane" ref={scrollerRef as RefObject<HTMLDivElement>}>
                    <div className="prose-wrap">
                      <MarkdownView content={activeDoc.content} proseRef={proseRef} />
                    </div>
                  </div>
                  <Outline headings={headings} activeId={activeId} onJump={jumpTo} open={canOutline && outlineOpen} />
                </div>
              ) : activeDoc.kind === "json" ? (
                <div className="pane json-pane" ref={scrollerRef as RefObject<HTMLDivElement>}>
                  <JsonView key={`${activeDoc.path}:${jsonDepth}`} content={activeDoc.content} openDepth={jsonDepth} />
                </div>
              ) : activeDoc.kind === "csv" ? (
                <div className="pane" ref={scrollerRef as RefObject<HTMLDivElement>}>
                  <CsvTable content={activeDoc.content} />
                </div>
              ) : (
                <div className="pane" ref={scrollerRef as RefObject<HTMLDivElement>}>
                  <pre className="raw selectable">{activeDoc.content}</pre>
                </div>
              )}
            </div>

            <FindBar
              open={findOpen}
              onClose={() => setFindOpen(false)}
              getRoot={() => viewRef.current}
              getScroller={() => scrollerRef.current}
              resetKey={findKey}
            />
            <StatusBar doc={activeDoc} stats={stats} zoom={zoom} editing={editing} dirty={dirty} run={run} />
          </>
        )}

        <Toasts />
        {dragging && (
          <div className="drop" aria-hidden="true">
            <div className="drop-label">
              <span className="ic">
                <FileDown size={22} strokeWidth={1.8} />
              </span>
              Drop to open
            </div>
          </div>
        )}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />
      <TooltipLayer />
    </div>
  );
}

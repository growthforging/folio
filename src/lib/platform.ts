/**
 * Everything that touches the host. Under Tauri this talks to the Rust side;
 * in a plain browser it degrades to file inputs and downloads so the UI can be
 * developed and previewed without the native shell.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { homeDir } from "@tauri-apps/api/path";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BROWSER, EXTS, baseName, kindFor, type Doc } from "./docs";

export const IS_TAURI = isTauri();

const FILTERS = [{ name: "Documents", extensions: EXTS }];

export async function readPaths(paths: string[]): Promise<Doc[]> {
  if (!IS_TAURI || !paths.length) return [];
  return invoke<Doc[]>("read_docs", { paths });
}

export async function filesToDocs(files: File[]): Promise<Doc[]> {
  return Promise.all(
    files.map(async (f) => ({
      path: BROWSER + f.name,
      name: f.name,
      kind: kindFor(f.name),
      content: await f.text(),
      error: null,
      size: f.size,
      modified: f.lastModified,
    }))
  );
}

export async function pickFiles(): Promise<Doc[]> {
  if (IS_TAURI) {
    const sel = await open({ multiple: true, filters: FILTERS });
    if (!sel) return [];
    return readPaths(Array.isArray(sel) ? sel : [sel]);
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = EXTS.map((e) => `.${e}`).join(",");
    input.onchange = () => void filesToDocs(Array.from(input.files ?? [])).then(resolve);
    input.click();
  });
}

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function writeDoc(path: string, content: string): Promise<void> {
  if (IS_TAURI) return invoke("write_file", { path, content });
  downloadText(baseName(path), content);
}

export async function pickSavePath(defaultName: string): Promise<string | null> {
  if (IS_TAURI) return save({ defaultPath: defaultName, filters: FILTERS });
  const name = window.prompt("Save as", defaultName);
  return name ? BROWSER + name : null;
}

export function revealInFinder(path: string) {
  if (IS_TAURI) void invoke("reveal_in_finder", { path }).catch(() => {});
}

export function openExternal(url: string) {
  if (IS_TAURI) void openUrl(url).catch(() => {});
  else window.open(url, "_blank", "noopener");
}

export async function confirmDialog(
  message: string,
  opts: { title?: string; ok?: string; cancel?: string } = {}
): Promise<boolean> {
  if (IS_TAURI) {
    return ask(message, {
      title: opts.title ?? "Folio",
      kind: "warning",
      okLabel: opts.ok ?? "OK",
      cancelLabel: opts.cancel ?? "Cancel",
    });
  }
  return window.confirm(message);
}

export interface DropHandlers {
  over: () => void;
  leave: () => void;
  drop: (docs: Promise<Doc[]>) => void;
}

export function onFileDrop(h: DropHandlers): () => void {
  if (IS_TAURI) {
    let un: (() => void) | undefined;
    let dead = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const t = event.payload.type;
        if (t === "enter" || t === "over") h.over();
        else if (t === "drop") {
          h.leave();
          h.drop(readPaths(event.payload.paths));
        } else h.leave();
      })
      .then((u) => {
        if (dead) u();
        else un = u;
      })
      .catch(() => {});
    return () => {
      dead = true;
      un?.();
    };
  }
  let depth = 0;
  const enter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    depth++;
    h.over();
  };
  const over = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
  };
  const leave = () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) h.leave();
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    depth = 0;
    h.leave();
    h.drop(filesToDocs(Array.from(e.dataTransfer?.files ?? [])));
  };
  window.addEventListener("dragenter", enter);
  window.addEventListener("dragover", over);
  window.addEventListener("dragleave", leave);
  window.addEventListener("drop", drop);
  return () => {
    window.removeEventListener("dragenter", enter);
    window.removeEventListener("dragover", over);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", drop);
  };
}

export async function takePending(): Promise<string[]> {
  if (!IS_TAURI) return [];
  return invoke<string[]>("take_pending").catch(() => []);
}

function subscribe<T>(name: string, cb: (payload: T) => void): () => void {
  if (!IS_TAURI) return () => {};
  let un: (() => void) | undefined;
  let dead = false;
  listen<T>(name, (e) => cb(e.payload))
    .then((u) => {
      if (dead) u();
      else un = u;
    })
    .catch(() => {});
  return () => {
    dead = true;
    un?.();
  };
}

/** Files opened via Finder while the app is already running. */
export const onOpenFiles = (cb: (paths: string[]) => void) => subscribe<string[]>("open-files", cb);
/** Native menu bar actions (macOS). */
export const onMenu = (cb: (id: string) => void) => subscribe<string>("menu", cb);

export function setWindowTheme(theme: "light" | "dark") {
  if (IS_TAURI) void getCurrentWindow().setTheme(theme).catch(() => {});
}

export function setWindowTitle(title: string) {
  if (IS_TAURI) void getCurrentWindow().setTitle(title).catch(() => {});
}

export function onWindowFocus(cb: (focused: boolean) => void): () => void {
  const onFocus = () => cb(true);
  const onBlur = () => cb(false);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  let un: (() => void) | undefined;
  let dead = false;
  if (IS_TAURI) {
    getCurrentWindow()
      .onFocusChanged(({ payload }) => cb(payload))
      .then((u) => {
        if (dead) u();
        else un = u;
      })
      .catch(() => {});
  }
  return () => {
    dead = true;
    un?.();
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
  };
}

export async function getHome(): Promise<string | null> {
  if (!IS_TAURI) return null;
  return homeDir().catch(() => null);
}

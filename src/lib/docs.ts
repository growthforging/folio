import { Braces, FileText, FileType, Table, type LucideIcon } from "lucide-react";

export type DocKind = "markdown" | "json" | "csv" | "text";

export interface Doc {
  path: string;
  name: string;
  kind: DocKind;
  content: string;
  error: string | null;
  modified?: number | null;
  size?: number | null;
}

export interface Recent {
  path: string;
  name: string;
  kind: DocKind;
  at: number;
}

export const UNTITLED = "untitled://";
export const BROWSER = "browser://";
export const isUntitled = (p: string) => p.startsWith(UNTITLED);
export const isVirtual = (p: string) => isUntitled(p) || p.startsWith(BROWSER);

export const EXTS = ["md", "markdown", "mdx", "mdown", "json", "jsonc", "geojson", "csv", "tsv", "txt"];

export function kindFor(name: string): DocKind {
  const l = name.toLowerCase();
  if (/\.(md|markdown|mdx|mdown)$/.test(l)) return "markdown";
  if (/\.(json|jsonc|geojson)$/.test(l)) return "json";
  if (/\.(csv|tsv)$/.test(l)) return "csv";
  return "text";
}

export const KIND: Record<DocKind, { label: string; short: string; icon: LucideIcon; color: string }> = {
  markdown: { label: "Markdown", short: "MD", icon: FileText, color: "var(--k-md)" },
  json: { label: "JSON", short: "JSON", icon: Braces, color: "var(--k-json)" },
  csv: { label: "CSV", short: "CSV", icon: Table, color: "var(--k-csv)" },
  text: { label: "Plain text", short: "TXT", icon: FileType, color: "var(--k-txt)" },
};

export function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Human-readable stats for the status bar, as separate parts. */
export function docStats(doc: Doc): string[] {
  const size = prettySize(doc.size ?? byteLength(doc.content));
  if (doc.kind === "markdown" || doc.kind === "text") {
    const words = (doc.content.match(/\S+/g) || []).length;
    const parts = [`${words.toLocaleString()} words`];
    if (doc.kind === "markdown") parts.push(`${Math.max(1, Math.round(words / 220))} min read`);
    else parts.push(`${doc.content.split("\n").length.toLocaleString()} lines`);
    parts.push(size);
    return parts;
  }
  if (doc.kind === "json") {
    try {
      const p: unknown = JSON.parse(doc.content);
      const n =
        p && typeof p === "object"
          ? Array.isArray(p)
            ? `${p.length.toLocaleString()} items`
            : `${Object.keys(p).length.toLocaleString()} keys`
          : "single value";
      return [n, size];
    } catch {
      return ["Invalid JSON", size];
    }
  }
  const lines = doc.content.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const first = lines[0] ?? "";
  const delim = first.split("\t").length > first.split(",").length ? "\t" : ",";
  const cols = first ? first.split(delim).length : 0;
  return [`${Math.max(0, lines.length - 1).toLocaleString()} rows`, `${cols} columns`, size];
}

let HOME: string | null = null;
export function setHome(h: string | null) {
  HOME = h ? h.replace(/\/$/, "") : null;
}

export function displayPath(path: string): string {
  if (isUntitled(path)) return "Unsaved draft";
  if (path.startsWith(BROWSER)) return "Loaded from this browser";
  return HOME && path.startsWith(HOME) ? "~" + path.slice(HOME.length) : path;
}

export function dirOf(path: string): string {
  const d = displayPath(path);
  const i = d.lastIndexOf("/");
  return i > 0 ? d.slice(0, i) : d;
}

export function baseName(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

export function middleTruncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = Math.max(4, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

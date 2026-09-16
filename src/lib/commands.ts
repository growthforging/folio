export type Cmd =
  | "open"
  | "new-md"
  | "new-json"
  | "close-doc"
  | "close-others"
  | "close-all"
  | "save"
  | "save-as"
  | "reveal"
  | "copy"
  | "copy-path"
  | "find"
  | "edit"
  | "done"
  | "sidebar"
  | "outline"
  | "palette"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | "format-json"
  | "json-expand"
  | "json-collapse"
  | "md-rich"
  | "md-source"
  | "md-toggle"
  | "theme-light"
  | "theme-dark"
  | "theme-system"
  | "select-doc"
  | "open-recent"
  | "remove-recent";

const CMDS = new Set<string>([
  "open", "new-md", "new-json", "close-doc", "close-others", "close-all", "save", "save-as",
  "reveal", "copy", "copy-path", "find", "edit", "done", "sidebar", "outline", "palette",
  "zoom-in", "zoom-out", "zoom-reset", "format-json", "json-expand", "json-collapse",
  "md-rich", "md-source", "md-toggle", "theme-light", "theme-dark", "theme-system",
  "select-doc", "open-recent", "remove-recent",
]);

export const isCmd = (s: string): s is Cmd => CMDS.has(s);

export type Run = (cmd: Cmd, arg?: string) => void;
export type ThemePref = "light" | "dark" | "system";
export type MdMode = "rich" | "source";

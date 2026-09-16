import welcome from "./welcome.md?raw";
import workspace from "./workspace.json?raw";
import expenses from "./expenses.csv?raw";
import { BROWSER, byteLength, type Doc, type DocKind } from "../lib/docs";

/** Sample documents shown when Folio runs in a plain browser (no native shell). */
export function demoDocs(): Doc[] {
  const mk = (name: string, kind: DocKind, content: string, ageHours: number): Doc => ({
    path: BROWSER + name,
    name,
    kind,
    content,
    error: null,
    size: byteLength(content),
    modified: Date.now() - ageHours * 3600_000,
  });
  return [
    mk("welcome.md", "markdown", welcome, 1),
    mk("workspace.json", "json", workspace, 5),
    mk("expenses.csv", "csv", expenses, 26),
  ];
}

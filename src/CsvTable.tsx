import { useMemo, useState } from "react";

const MAX_ROWS = 2000;

function sniffDelim(text: string): string {
  const nl = text.indexOf("\n");
  const first = nl >= 0 ? text.slice(0, nl) : text;
  return first.split("\t").length > first.split(",").length ? "\t" : ",";
}

/** Minimal RFC-4180-ish parser: handles quoted fields, "" escapes, and CRLF. */
export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function CsvTable({ content }: { content: string }) {
  const { head, body } = useMemo(() => {
    const rows = parseDelimited(content, sniffDelim(content)).filter(
      (r) => r.length > 1 || (r[0] ?? "").trim() !== ""
    );
    const [h, ...b] = rows;
    return { head: h ?? [], body: b };
  }, [content]);

  if (!head.length) return <div className="csv-empty">Empty file</div>;

  const shown = body.slice(0, MAX_ROWS);
  const cols = head.map((_, i) => i);

  return (
    <div className="csv-wrap">
      <table className="csv">
        <thead>
          <tr>
            <th className="csv-rownum" />
            {head.map((h, i) => (
              <th key={i} title={h}>
                {h || <span className="csv-blank">col {i + 1}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, ri) => (
            <tr key={ri}>
              <td className="csv-rownum">{ri + 1}</td>
              {cols.map((ci) => (
                <td key={ci} title={r[ci] ?? ""}>
                  {r[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {body.length > MAX_ROWS && (
        <div className="csv-more">
          Showing first {MAX_ROWS.toLocaleString()} of {body.length.toLocaleString()} rows.
        </div>
      )}
    </div>
  );
}

/** Serialize a grid back to delimited text, quoting fields that need it. */
function serializeCsv(rows: string[][], delim: string): string {
  const esc = (c: string) =>
    c.includes(delim) || /[\n\r"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
  return rows.map((r) => r.map(esc).join(delim)).join("\n") + "\n";
}

/** Spreadsheet-style editor: edit values in the cells; Save writes proper CSV/TSV. */
export function CsvEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (csv: string) => void;
}) {
  const [delim] = useState(() => sniffDelim(content));
  const [rows, setRows] = useState<string[][]>(() => {
    const parsed = parseDelimited(content, delim).filter(
      (r) => r.length > 1 || (r[0] ?? "").trim() !== ""
    );
    const cols = Math.max(1, ...parsed.map((r) => r.length));
    return parsed.length
      ? parsed.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""))
      : [[""]];
  });

  const colCount = rows[0]?.length ?? 1;

  const commit = (next: string[][]) => {
    setRows(next);
    onChange(serializeCsv(next, delim));
  };
  const setCell = (r: number, c: number, v: string) =>
    commit(rows.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));
  const addRow = () => commit([...rows, Array.from({ length: colCount }, () => "")]);
  const addCol = () => commit(rows.map((row) => [...row, ""]));
  const delRow = (r: number) =>
    commit(
      rows.length > 1
        ? rows.filter((_, ri) => ri !== r)
        : [Array.from({ length: colCount }, () => "")]
    );

  const [head, ...body] = rows;

  return (
    <div className="csv-wrap csv-edit">
      <table className="csv">
        <thead>
          <tr>
            <th className="csv-rownum" />
            {head.map((h, c) => (
              <th key={c}>
                <input
                  value={h}
                  placeholder={`col ${c + 1}`}
                  onChange={(e) => setCell(0, c, e.target.value)}
                />
              </th>
            ))}
            <th className="csv-tool">
              <button onClick={addCol} title="Add column">
                ＋
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {body.map((row, bi) => {
            const r = bi + 1;
            return (
              <tr key={r}>
                <td className="csv-rownum">
                  <span className="csv-n">{r}</span>
                  <button className="csv-delrow" title="Delete row" onClick={() => delRow(r)}>
                    ×
                  </button>
                </td>
                {Array.from({ length: colCount }, (_, c) => (
                  <td key={c}>
                    <input value={row[c] ?? ""} onChange={(e) => setCell(r, c, e.target.value)} />
                  </td>
                ))}
                <td className="csv-tool" />
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="csv-edit-actions">
        <button onClick={addRow}>＋ Add row</button>
        <span className="csv-edit-hint">
          Editing in the grid — Save writes back as {delim === "\t" ? "TSV" : "CSV"}
        </span>
      </div>
    </div>
  );
}

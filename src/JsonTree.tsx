import { useState } from "react";

export function JsonView({ content, openDepth = 2 }: { content: string; openDepth?: number }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return <div className="json-error">⚠ Invalid JSON — {(e as Error).message}</div>;
  }
  return (
    <div className="json">
      <JsonNode value={parsed} name={null} depth={0} openDepth={openDepth} />
    </div>
  );
}

function JsonLeaf({ value }: { value: unknown }) {
  if (value === null) return <span className="jnull">null</span>;
  switch (typeof value) {
    case "string":
      return <span className="jstr">"{value}"</span>;
    case "number":
      return <span className="jnum">{String(value)}</span>;
    case "boolean":
      return <span className="jbool">{String(value)}</span>;
    default:
      return <span>{String(value)}</span>;
  }
}

function JsonNode({
  value,
  name,
  depth,
  openDepth,
}: {
  value: unknown;
  name: string | null;
  depth: number;
  openDepth: number;
}) {
  const isObj = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < openDepth);

  const pad = { paddingLeft: 8 + depth * 14 };
  const key =
    name !== null ? (
      <>
        <span className="jkey">{name}</span>
        <span className="jpunct">: </span>
      </>
    ) : null;

  if (!isObj) {
    return (
      <div className="jrow" style={pad}>
        {key}
        <JsonLeaf value={value} />
      </div>
    );
  }

  const isArr = Array.isArray(value);
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i): [string, unknown] => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBr = isArr ? "[" : "{";
  const closeBr = isArr ? "]" : "}";

  return (
    <div className="jnode">
      <div className="jrow toggle" style={pad} onClick={() => setOpen((o) => !o)}>
        <span className={`caret ${open ? "open" : ""}`}>▸</span>
        {key}
        <span className="jpunct">{openBr}</span>
        {!open && (
          <span className="jcount">
            {" "}
            {entries.length} {isArr ? "items" : "keys"} <span className="jpunct">{closeBr}</span>
          </span>
        )}
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={k} value={v} name={k} depth={depth + 1} openDepth={openDepth} />
          ))}
          <div className="jrow" style={pad}>
            <span className="jpunct">{closeBr}</span>
          </div>
        </>
      )}
    </div>
  );
}

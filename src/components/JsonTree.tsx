import { useMemo, useState, type MouseEvent } from "react";
import { ChevronRight, Copy } from "lucide-react";
import { ErrorState } from "../ui/ErrorState";
import { toast } from "../ui/Toast";

export function JsonView({ content, openDepth = 2 }: { content: string; openDepth?: number }) {
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(content) as unknown };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [content]);
  if (!parsed.ok) return <ErrorState title="This file isn't valid JSON" detail={parsed.error} />;
  return (
    <div className="json selectable">
      <JsonNode value={parsed.value} name={null} depth={0} openDepth={openDepth} isIndex={false} />
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

function CopyButton({ value }: { value: unknown }) {
  const copy = (e: MouseEvent) => {
    e.stopPropagation();
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    void navigator.clipboard?.writeText(text).catch(() => {});
    toast("Copied");
  };
  return (
    <button type="button" className="jcopy" data-tip="Copy value" aria-label="Copy value" onClick={copy}>
      <Copy size={12} strokeWidth={1.9} />
    </button>
  );
}

function JsonNode({
  value,
  name,
  depth,
  openDepth,
  isIndex,
}: {
  value: unknown;
  name: string | null;
  depth: number;
  openDepth: number;
  isIndex: boolean;
}) {
  const isObj = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < openDepth);

  const key =
    name !== null ? (
      <>
        <span className={`jkey${isIndex ? " idx" : ""}`}>{name}</span>
        <span className="jpunct">: </span>
      </>
    ) : null;

  if (!isObj) {
    return (
      <div className="jrow">
        <span className="jcaret" />
        <span>
          {key}
          <JsonLeaf value={value} />
        </span>
        <CopyButton value={value} />
      </div>
    );
  }

  const isArr = Array.isArray(value);
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i): [string, unknown] => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBr = isArr ? "[" : "{";
  const closeBr = isArr ? "]" : "}";
  const n = entries.length;
  const noun = isArr ? (n === 1 ? "item" : "items") : n === 1 ? "key" : "keys";

  if (n === 0) {
    return (
      <div className="jrow">
        <span className="jcaret" />
        <span>
          {key}
          <span className="jpunct">
            {openBr}
            {closeBr}
          </span>
        </span>
        <CopyButton value={value} />
      </div>
    );
  }

  return (
    <div className="jnode">
      <div className="jrow toggle" onClick={() => setOpen((o) => !o)}>
        <span className={`jcaret${open ? " open" : ""}`}>
          <ChevronRight size={12} strokeWidth={2.2} />
        </span>
        <span>
          {key}
          <span className="jpunct">{openBr}</span>
          {!open && (
            <>
              <span className="jcount">
                {n} {noun}
              </span>
              <span className="jpunct">{closeBr}</span>
            </>
          )}
        </span>
        <CopyButton value={value} />
      </div>
      {open && (
        <>
          <div className="jkids">
            {entries.map(([k, v]) => (
              <JsonNode key={k} value={v} name={k} depth={depth + 1} openDepth={openDepth} isIndex={isArr} />
            ))}
          </div>
          <div className="jrow">
            <span className="jcaret" />
            <span className="jpunct">{closeBr}</span>
          </div>
        </>
      )}
    </div>
  );
}

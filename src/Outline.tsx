export interface Heading {
  id: string;
  text: string;
  level: number;
}

export function Outline({
  headings,
  activeId,
  onJump,
}: {
  headings: Heading[];
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  if (headings.length < 2) return null;
  const minLevel = Math.min(...headings.map((h) => h.level));
  return (
    <aside className="outline">
      <div className="outline-head">Outline</div>
      <ul className="outline-list">
        {headings.map((h, i) => (
          <li
            key={`${h.id}-${i}`}
            className={`outline-item${activeId === h.id ? " active" : ""}`}
            style={{ paddingLeft: 12 + (h.level - minLevel) * 13 }}
            onClick={() => onJump(h.id)}
            title={h.text}
          >
            {h.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

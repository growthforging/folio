import { TriangleAlert } from "lucide-react";

export function ErrorState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="err">
      <div className="err-card">
        <span className="ic">
          <TriangleAlert size={18} strokeWidth={1.9} />
        </span>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
    </div>
  );
}

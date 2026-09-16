import type { CSSProperties } from "react";
import { Braces, FileText, FolderOpen, X } from "lucide-react";
import { KIND, dirOf, relTime, type Recent } from "../lib/docs";
import type { Run, ThemePref } from "../lib/commands";
import { Button, Kbd } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { ThemeButton } from "../ui/ThemeButton";

const idx = (i: number) => ({ "--i": i } as CSSProperties);

interface Props {
  recents: Recent[];
  theme: ThemePref;
  onTheme: (t: ThemePref, origin: { x: number; y: number }) => void;
  run: Run;
}

export function Welcome({ recents, theme, onTheme, run }: Props) {
  return (
    <div className="welcome">
      <div className="wl-top" data-tauri-drag-region>
        <ThemeButton theme={theme} onChange={onTheme} />
      </div>
      <div className="wl-body">
        <div className="wl-card">
          <div className="wl-mark" style={idx(0)}>
            <Logo size={64} />
          </div>
          <h1 className="wl-title" style={idx(1)}>
            Folio
          </h1>
          <p className="wl-sub" style={idx(2)}>
            A quiet place to read and edit Markdown, JSON, and CSV.
          </p>
          <div className="wl-actions" style={idx(3)}>
            <Button size="lg" variant="primary" icon={FolderOpen} onClick={() => run("open")}>
              Open file <Kbd>⌘O</Kbd>
            </Button>
            <Button size="lg" icon={FileText} onClick={() => run("new-md")}>
              New Markdown <Kbd>⌘N</Kbd>
            </Button>
            <Button size="lg" icon={Braces} onClick={() => run("new-json")}>
              New JSON <Kbd>⇧⌘N</Kbd>
            </Button>
          </div>

          {recents.length > 0 && (
            <div className="wl-recent" style={idx(4)}>
              <h3>Recent</h3>
              <ul>
                {recents.slice(0, 6).map((r) => {
                  const k = KIND[r.kind];
                  const Icon = k.icon;
                  return (
                    <li key={r.path} className="wl-rec" onClick={() => run("open-recent", r.path)}>
                      <Icon className="ico" size={16} strokeWidth={1.8} style={{ color: k.color }} />
                      <span className="name">{r.name}</span>
                      <time>{relTime(r.at)}</time>
                      <button
                        type="button"
                        className="rm"
                        data-tip="Remove from recents"
                        aria-label={`Remove ${r.name} from recents`}
                        onClick={(e) => {
                          e.stopPropagation();
                          run("remove-recent", r.path);
                        }}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                      <span className="sub">{dirOf(r.path)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="wl-hints" style={idx(recents.length ? 5 : 4)}>
            <span>
              <Kbd>⌘K</Kbd> commands
            </span>
            <span>
              <Kbd>⌘F</Kbd> find
            </span>
            <span>Drop files anywhere to open them</span>
          </div>
        </div>
      </div>
    </div>
  );
}

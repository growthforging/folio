import { isValidElement, useRef, useState, type ComponentProps, type RefObject } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { Check, Copy } from "lucide-react";
import { openExternal } from "../lib/platform";

function CodeBlock({ children, ...rest }: ComponentProps<"pre">) {
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const child = isValidElement<{ className?: string }>(children) ? children : null;
  const lang = /language-([\w+#.-]+)/.exec(child?.props.className ?? "")?.[1];
  const copy = () => {
    const text = pre.current?.innerText ?? "";
    void navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="code">
      <div className="code-head">
        <span className="lang">{lang ?? "code"}</span>
        <button
          type="button"
          className={`code-copy${copied ? " done" : ""}`}
          data-tip={copied ? "Copied" : "Copy code"}
          aria-label="Copy code"
          onClick={copy}
        >
          {copied ? <Check key="ok" size={13} strokeWidth={2.2} /> : <Copy key="cp" size={13} strokeWidth={1.9} />}
        </button>
      </div>
      <pre ref={pre} {...rest}>
        {children}
      </pre>
    </div>
  );
}

const components: Components = {
  pre: ({ node, ...rest }) => {
    void node;
    return <CodeBlock {...rest} />;
  },
  a: ({ node, href, children, ...rest }) => {
    void node;
    return (
      <a
        href={href}
        {...rest}
        onClick={(e) => {
          e.preventDefault();
          if (!href) return;
          if (href.startsWith("#")) {
            document
              .getElementById(decodeURIComponent(href.slice(1)))
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (/^(https?:|mailto:)/i.test(href)) openExternal(href);
        }}
      >
        {children}
      </a>
    );
  },
  table: ({ node, ...rest }) => {
    void node;
    return (
      <div className="table-wrap">
        <table {...rest} />
      </div>
    );
  },
  img: ({ node, ...rest }) => {
    void node;
    return <img loading="lazy" {...rest} />;
  },
};

export function MarkdownView({
  content,
  proseRef,
}: {
  content: string;
  proseRef: RefObject<HTMLElement | null>;
}) {
  return (
    <article className="prose selectable" ref={proseRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

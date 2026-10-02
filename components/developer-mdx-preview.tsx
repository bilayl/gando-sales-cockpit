"use client";

import { useEffect, useMemo, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Loader2 } from "lucide-react";

type DesignerEdit = { type: "h1" | "h2" | "h3" | "p" | "blockquote"; previousText: string; nextText: string };

function Editable({ tag, type, children, enabled, onEdit }: { tag: "h1" | "h2" | "h3" | "p" | "blockquote"; type: DesignerEdit["type"]; children: ReactNode; enabled: boolean; onEdit?: (edit: DesignerEdit) => void }) {
  const Tag = tag;
  if (!enabled) return <Tag>{children}</Tag>;
  return <Tag className="gando-designer-editable" contentEditable suppressContentEditableWarning onBlur={event => { const nextText = event.currentTarget.innerText.trim(); const previousText = typeof children === "string" ? children.trim() : event.currentTarget.getAttribute("data-designer-text") || ""; if (nextText && nextText !== previousText) onEdit?.({ type, previousText, nextText }); }} data-designer-text={typeof children === "string" ? children : ""}>{children}</Tag>;
}

function ApiEndpoint({ method, path }: { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string }) {
  return <div className="gando-guide-endpoint not-prose"><span data-method={method}>{method}</span><code>{path}</code></div>;
}

function GuideCode({ title, children }: { title?: string; children?: string }) {
  return <CodeBlock className="gando-doc-codeblock" title={title}><Pre><code>{children}</code></Pre></CodeBlock>;
}

function DocTabs({ items, children }: { items: string; children: ReactNode }) {
  const values = items.split("|").map(item => item.trim()).filter(Boolean);
  return <Tabs items={values}>{children}</Tabs>;
}
function DocTab({ value, children }: { value: string; children: ReactNode }) { return <Tab value={value}>{children}</Tab>; }

function DocImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const rawSrc = typeof props.src === "string" ? props.src : "";
  const src = rawSrc.startsWith("/developer-docs-assets/") ? "/api/developer-docs/assets?path=" + encodeURIComponent("public" + rawSrc) : rawSrc;
  return <img {...props} src={src} className="my-6 max-h-[620px] w-auto max-w-full rounded-xl border border-border object-contain shadow-sm" loading="lazy" />;
}

const components = { ...defaultMdxComponents, Callout, CodeBlock, Pre, Tabs, Tab, Steps, Step, ApiEndpoint, GuideCode, DocTabs, DocTab, img: DocImage };

function withoutDuplicateTitle(source: string, title: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const firstContent = lines.findIndex(line => line.trim().length > 0);
  if (firstContent < 0) return source;
  const expected = "# " + title.trim();
  if (lines[firstContent].trim() === expected) { lines.splice(firstContent, 1); while (lines[firstContent]?.trim() === "") lines.splice(firstContent, 1); }
  return lines.join("\n");
}

export function DeveloperMdxPreview({ source, title, designer = false, onDesignerEdit }: { source: string; title: string; designer?: boolean; onDesignerEdit?: (edit: DesignerEdit) => void }) {
  const cleanedSource = useMemo(() => withoutDuplicateTitle(source, title), [source, title]);
  const [compiled, setCompiled] = useState<MDXRemoteSerializeResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch("/api/developer-docs/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: cleanedSource || " " }), signal: controller.signal });
        const body = await response.json().catch(() => ({})) as { source?: MDXRemoteSerializeResult; error?: string };
        if (!response.ok || !body.source) throw new Error(body.error || "Le contenu MDX n’a pas pu être compilé.");
        setCompiled(body.source);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Le contenu MDX n’a pas pu être compilé.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 220);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [cleanedSource]);

  if (loading && !compiled) return <div className="flex min-h-40 items-center justify-center text-fd-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error) return <Callout type="warn" title="MDX à corriger">{error}</Callout>;
  if (!compiled) return null;

  const designerComponents = designer ? {
    ...components,
    h1: (props: { children?: ReactNode }) => <Editable tag="h1" type="h1" enabled onEdit={onDesignerEdit}>{props.children}</Editable>,
    h2: (props: { children?: ReactNode }) => <Editable tag="h2" type="h2" enabled onEdit={onDesignerEdit}>{props.children}</Editable>,
    h3: (props: { children?: ReactNode }) => <Editable tag="h3" type="h3" enabled onEdit={onDesignerEdit}>{props.children}</Editable>,
    p: (props: { children?: ReactNode }) => <Editable tag="p" type="p" enabled onEdit={onDesignerEdit}>{props.children}</Editable>,
    blockquote: (props: { children?: ReactNode }) => <Editable tag="blockquote" type="blockquote" enabled onEdit={onDesignerEdit}>{props.children}</Editable>,
  } : components;

  return <DocsBody className={designer ? "gando-designer-docs-body" : undefined}>{designer ? <div className="gando-designer-hint">Cliquez directement sur un titre ou un paragraphe pour modifier le contenu</div> : null}<MDXRemote {...compiled} components={designerComponents} /></DocsBody>;
}
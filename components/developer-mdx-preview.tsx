"use client";

import { useEffect, useMemo, useState } from "react";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Loader2 } from "lucide-react";

function ApiEndpoint({
  method,
  path,
}: {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
}) {
  return (
    <div className="gando-guide-endpoint not-prose">
      <span data-method={method}>{method}</span>
      <code>{path}</code>
    </div>
  );
}

function GuideCode({ title, children }: { title?: string; children?: string }) {
  return (
    <CodeBlock className="gando-doc-codeblock" title={title}>
      <Pre>
        <code>{children}</code>
      </Pre>
    </CodeBlock>
  );
}

const components = {
  ...defaultMdxComponents,
  Callout,
  CodeBlock,
  Pre,
  Tabs,
  Tab,
  Steps,
  Step,
  ApiEndpoint,
  GuideCode,
};

function withoutDuplicateTitle(source: string, title: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const firstContent = lines.findIndex(line => line.trim().length > 0);
  if (firstContent < 0) return source;

  const expected = `# ${title.trim()}`;
  if (lines[firstContent].trim() === expected) {
    lines.splice(firstContent, 1);
    while (lines[firstContent]?.trim() === "") lines.splice(firstContent, 1);
  }
  return lines.join("\n");
}

export function DeveloperMdxPreview({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  const cleanedSource = useMemo(() => withoutDuplicateTitle(source, title), [source, title]);
  const [compiled, setCompiled] = useState<MDXRemoteSerializeResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/developer-docs/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: cleanedSource || " " }),
          signal: controller.signal,
        });

        const body = await response.json().catch(() => ({})) as {
          source?: MDXRemoteSerializeResult;
          error?: string;
        };

        if (!response.ok || !body.source) {
          throw new Error(body.error || "Le contenu MDX n’a pas pu être compilé.");
        }

        setCompiled(body.source);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Le contenu MDX n’a pas pu être compilé.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cleanedSource]);

  if (loading && !compiled) {
    return (
      <div className="flex min-h-40 items-center justify-center text-fd-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Callout type="warn" title="MDX à corriger">
        {error}
      </Callout>
    );
  }

  if (!compiled) return null;

  return (
    <DocsBody>
      <MDXRemote {...compiled} components={components} />
    </DocsBody>
  );
}

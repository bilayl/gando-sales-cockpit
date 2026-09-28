"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  GitBranch,
  Github,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GandoMark } from "@/components/gando-mark";
import { cn } from "@/lib/utils";

type DocStatus = "draft" | "published";
type EditorMode = "edit" | "preview";

type DocPage = {
  id: string;
  path: string;
  sha: string;
  title: string;
  slug: string;
  section: string;
  description: string;
  body: string;
  status: DocStatus;
  order: number;
  updatedAt: string | null;
};

type DocsConnection = {
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
  tokenSource: "server" | "browser" | "none";
  hasToken: boolean;
  connected: boolean;
  writable: boolean;
  private?: boolean;
  defaultBranch?: string | null;
  branchProtected?: boolean;
  repoUrl: string;
  reason?: string | null;
};

type ConnectionResponse = {
  connection: DocsConnection;
  canConfigure: boolean;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatRelativeDate(value?: string | null) {
  if (!value) return "Non enregistrée";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non enregistrée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function inlineMarkdown(text: string): ReactNode[] {
  const chunks = text.split(/(\*\*[^*]+\*\*|\`[^\`]+\`|\[[^\]]+\]\([^)]+\))/g);
  return chunks.map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-md bg-[#f1f1f4] px-1.5 py-0.5 font-mono text-[0.9em] text-[#6758e7] dark:bg-muted"
        >
          {chunk.slice(1, -1)}
        </code>
      );
    }
    const link = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#6556e8] underline decoration-[#c7c1ff] underline-offset-4"
        >
          {link[1]}
        </a>
      );
    }
    return chunk;
  });
}

function headingId(value: string) {
  return slugify(value.replace(/\*\*/g, "").replace(/`/g, ""));
}

function MarkdownPreview({ source }: { source: string }) {
  const lines = source.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      nodes.push(
        <div key={`code-${index}`} className="my-6 overflow-hidden rounded-2xl border border-[#24262d] bg-[#111217]">
          <div className="flex h-9 items-center justify-between border-b border-white/10 px-4 text-[10px] text-white/45">
            <span>{language || "code"}</span>
            <span>Gando</span>
          </div>
          <pre className="overflow-x-auto p-4 text-[12px] leading-6 text-[#f7f7fa]">
            <code>{code.join("\n")}</code>
          </pre>
        </div>,
      );
      index += 1;
      continue;
    }

    if (/^- /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^- /.test(lines[index])) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${index}`} className="my-5 list-disc space-y-2 pl-5 text-[14px] leading-7 text-[#51545d] dark:text-muted-foreground">
          {items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}
        </ul>,
      );
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\. /, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`ol-${index}`} className="my-5 list-decimal space-y-2 pl-5 text-[14px] leading-7 text-[#51545d] dark:text-muted-foreground">
          {items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}
        </ol>,
      );
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      const rows = tableLines
        .filter(row => !/^\|\s*[-:]+/.test(row))
        .map(row => row.split("|").slice(1, -1).map(cell => cell.trim()));
      nodes.push(
        <div key={`table-${index}`} className="my-6 overflow-hidden rounded-xl border border-[#e8e8ee] dark:border-border">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                "grid gap-3 px-3 py-2.5 text-[12px]",
                rowIndex === 0
                  ? "bg-[#f6f6f8] font-semibold dark:bg-muted"
                  : "border-t border-[#ededf1] dark:border-border",
              )}
              style={{ gridTemplateColumns: `repeat(${Math.max(row.length, 1)}, minmax(0, 1fr))` }}
            >
              {row.map((cell, cellIndex) => <div key={cellIndex}>{inlineMarkdown(cell)}</div>)}
            </div>
          ))}
        </div>,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      const title = line.slice(4);
      nodes.push(
        <h3 id={headingId(title)} key={index} className="scroll-mt-24 mb-2 mt-8 text-[18px] font-semibold tracking-[-0.02em]">
          {inlineMarkdown(title)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      const title = line.slice(3);
      nodes.push(
        <h2 id={headingId(title)} key={index} className="scroll-mt-24 mb-3 mt-10 border-t border-[#efeff2] pt-8 text-[23px] font-semibold tracking-[-0.03em] dark:border-border">
          {inlineMarkdown(title)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      const title = line.slice(2);
      nodes.push(
        <h1 id={headingId(title)} key={index} className="scroll-mt-24 mb-4 mt-1 text-[34px] font-semibold leading-tight tracking-[-0.045em]">
          {inlineMarkdown(title)}
        </h1>,
      );
    } else if (line.startsWith("> ")) {
      nodes.push(
        <blockquote
          key={index}
          className="my-6 rounded-xl border border-[#dedafc] bg-[#f8f7ff] px-4 py-3 text-[13px] leading-6 text-[#55506d] dark:border-border dark:bg-muted/40 dark:text-muted-foreground"
        >
          {inlineMarkdown(line.slice(2))}
        </blockquote>,
      );
    } else if (line.trim()) {
      nodes.push(
        <p key={index} className="my-3 text-[14px] leading-7 text-[#51545d] dark:text-muted-foreground">
          {inlineMarkdown(line)}
        </p>,
      );
    }

    index += 1;
  }

  return <>{nodes}</>;
}

function StatusBadge({ status }: { status: DocStatus }) {
  const published = status === "published";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
        published
          ? "bg-[#eaf7ef] text-[#33724a] dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-[#f1f2f4] text-[#747780] dark:bg-muted dark:text-muted-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", published ? "bg-[#4ea56a]" : "bg-[#9a9da5]")} />
      {published ? "Publié" : "Brouillon"}
    </span>
  );
}

function ConnectionModal({
  open,
  connection,
  canConfigure,
  onClose,
  onSaved,
}: {
  open: boolean;
  connection: DocsConnection | null;
  canConfigure: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [owner, setOwner] = useState(connection?.owner || "bilayl");
  const [repo, setRepo] = useState(connection?.repo || "gando-app");
  const [branch, setBranch] = useState(connection?.branch || "master");
  const [basePath, setBasePath] = useState(connection?.basePath || "docs/developer-portal");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOwner(connection?.owner || "bilayl");
    setRepo(connection?.repo || "gando-app");
    setBranch(connection?.branch || "master");
    setBasePath(connection?.basePath || "docs/developer-portal");
    setToken("");
    setError("");
  }, [open, connection]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/developer-docs/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, basePath, token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Connexion GitHub impossible.");
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion GitHub impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#e3e4e8] bg-white shadow-2xl dark:border-border dark:bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-[#ececf0] px-5 py-4 dark:border-border">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Github className="h-4 w-4" />
              Connexion de la documentation
            </div>
            <p className="mt-1 max-w-md text-[11px] leading-5 text-muted-foreground">
              Les pages sont lues et écrites directement dans GitHub. Le token n’est jamais renvoyé au navigateur après enregistrement.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Propriétaire</span>
              <input value={owner} onChange={event => setOwner(event.target.value)} disabled={!canConfigure} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dépôt</span>
              <input value={repo} onChange={event => setRepo(event.target.value)} disabled={!canConfigure} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Branche</span>
              <input value={branch} onChange={event => setBranch(event.target.value)} disabled={!canConfigure} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dossier docs</span>
              <input value={basePath} onChange={event => setBasePath(event.target.value)} disabled={!canConfigure} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20" />
            </label>
          </div>

          {connection?.tokenSource === "server" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Token partagé configuré côté serveur</div>
              <div className="mt-1 opacity-80">La variable <code>GITHUB_DOCS_TOKEN</code> est utilisée pour l’équipe.</div>
            </div>
          ) : (
            <label className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Token GitHub finement ciblé</span>
              <input
                value={token}
                onChange={event => setToken(event.target.value)}
                type="password"
                disabled={!canConfigure}
                placeholder={connection?.hasToken ? "Token déjà enregistré — laissez vide pour le conserver" : "github_pat_…"}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20"
              />
              <span className="block text-[10px] leading-5 text-muted-foreground">
                Donnez uniquement l’accès au dépôt <strong>{owner}/{repo}</strong> avec Contents en lecture/écriture. Le token est chiffré avec la session Cockpit.
              </span>
            </label>
          )}

          {error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">{error}</div> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#ececf0] bg-[#fafafd] px-5 py-3 dark:border-border dark:bg-muted/20">
          <div className="text-[10px] text-muted-foreground">
            Source : <span className="font-mono">{owner}/{repo}@{branch}/{basePath}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-8 rounded-lg border border-border bg-background px-3 text-[11px] font-medium hover:bg-muted">
              Annuler
            </button>
            {canConfigure ? (
              <button type="button" onClick={save} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#17181c] px-3 text-[11px] font-semibold text-white hover:bg-[#2b2d33] disabled:opacity-60 dark:bg-white dark:text-black">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                Tester & connecter
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeveloperDocsEditor({ canEdit }: { canEdit: boolean }) {
  const [connection, setConnection] = useState<DocsConnection | null>(null);
  const [canConfigure, setCanConfigure] = useState(false);
  const [pages, setPages] = useState<DocPage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<EditorMode>("preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const connectionResponse = await fetch("/api/developer-docs/connection", { cache: "no-store" });
      const connectionBody = await connectionResponse.json().catch(() => ({})) as Partial<ConnectionResponse> & { error?: string };
      if (!connectionResponse.ok) throw new Error(connectionBody.error || "Connexion GitHub indisponible.");

      const nextConnection = connectionBody.connection || null;
      setConnection(nextConnection);
      setCanConfigure(Boolean(connectionBody.canConfigure));

      if (!nextConnection?.connected) {
        setPages([]);
        setSelectedId("");
        return;
      }

      const pagesResponse = await fetch("/api/developer-docs/pages", { cache: "no-store" });
      const pagesBody = await pagesResponse.json().catch(() => ({})) as { pages?: DocPage[]; error?: string };
      if (!pagesResponse.ok) throw new Error(pagesBody.error || "Documentation GitHub indisponible.");

      const nextPages = Array.isArray(pagesBody.pages) ? pagesBody.pages : [];
      setPages(nextPages);
      setSelectedId(current => nextPages.some(page => page.id === current) ? current : nextPages[0]?.id || "");
      setDirty(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Documentation GitHub indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const currentPage = pages.find(page => page.id === selectedId) ?? null;

  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? pages.filter(page => `${page.title} ${page.slug} ${page.section} ${page.description}`.toLowerCase().includes(query))
      : pages;

    return Array.from(new Set(filtered.map(page => page.section))).map(section => ({
      section,
      pages: filtered.filter(page => page.section === section),
    }));
  }, [pages, search]);

  const toc = useMemo(() => {
    if (!currentPage) return [];
    return currentPage.body
      .split("\n")
      .map(line => {
        const match = line.match(/^(##|###)\s+(.+)$/);
        if (!match) return null;
        return {
          depth: match[1] === "##" ? 2 : 3,
          title: match[2].replace(/\*\*/g, "").replace(/`/g, ""),
          id: headingId(match[2]),
        };
      })
      .filter((item): item is { depth: number; title: string; id: string } => Boolean(item));
  }, [currentPage]);

  const sourceUrl = currentPage?.path && connection
    ? `https://github.com/${connection.owner}/${connection.repo}/blob/${connection.branch}/${currentPage.path}`
    : connection?.repoUrl || "#";

  function choosePage(id: string) {
    if (dirty && !window.confirm("Cette page contient des modifications non enregistrées. Continuer sans enregistrer ?")) return;
    setSelectedId(id);
    setDirty(false);
    setMessage("");
    setError("");
  }

  function updateCurrent(patch: Partial<DocPage>) {
    if (!currentPage || !canEdit) return;
    setPages(items => items.map(page => page.id === currentPage.id ? { ...page, ...patch } : page));
    setDirty(true);
    setMessage("");
  }

  function createPage() {
    if (!canEdit) return;
    if (dirty && !window.confirm("Cette page contient des modifications non enregistrées. Continuer ?")) return;

    const id = `new-${Date.now()}`;
    const next: DocPage = {
      id,
      path: "",
      sha: "",
      title: "Nouvelle page",
      slug: `nouvelle-page-${pages.length + 1}`,
      section: "Guides",
      description: "",
      body: "# Nouvelle page\n\nCommencez à rédiger votre documentation ici.\n\n## Première section\n\nAjoutez votre contenu.",
      status: "draft",
      order: pages.length + 1,
      updatedAt: null,
    };
    setPages(items => [...items, next]);
    setSelectedId(id);
    setMode("edit");
    setDirty(true);
  }

  async function savePage(status: DocStatus) {
    if (!currentPage || !canEdit) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/developer-docs/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentPage, status }),
      });
      const body = await response.json().catch(() => ({})) as { page?: DocPage; error?: string };
      if (!response.ok || !body.page) throw new Error(body.error || "Enregistrement impossible.");

      const previousId = currentPage.id;
      setPages(items => items.map(page => page.id === previousId ? body.page as DocPage : page));
      setSelectedId(body.page.id);
      setDirty(false);
      setMessage(status === "published" ? "Page publiée dans GitHub." : "Brouillon enregistré dans GitHub.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePage() {
    if (!currentPage || !canEdit) return;
    if (!window.confirm(`Supprimer « ${currentPage.title} » ?`)) return;

    if (!currentPage.path || !currentPage.sha) {
      setPages(items => items.filter(page => page.id !== currentPage.id));
      setSelectedId(pages.find(page => page.id !== currentPage.id)?.id || "");
      setDirty(false);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/developer-docs/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPage.path, sha: currentPage.sha, title: currentPage.title }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Suppression impossible.");

      const remaining = pages.filter(page => page.id !== currentPage.id);
      setPages(remaining);
      setSelectedId(remaining[0]?.id || "");
      setDirty(false);
      setMessage("Page supprimée du dépôt.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  function insertMarkdown(before: string, after = before, placeholder = "texte") {
    const textarea = textareaRef.current;
    if (!textarea || !currentPage || !canEdit) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentPage.body.slice(start, end) || placeholder;
    const nextBody = `${currentPage.body.slice(0, start)}${before}${selected}${after}${currentPage.body.slice(end)}`;
    updateCurrent({ body: nextBody });
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  const connectionLabel = connection?.connected
    ? `${connection.owner}/${connection.repo}`
    : "Connecter GitHub";

  return (
    <div className="flex h-screen min-h-[680px] flex-col overflow-hidden bg-[#fbfbfc] text-[#17181c] dark:bg-background dark:text-foreground">
      <ConnectionModal
        open={connectionOpen}
        connection={connection}
        canConfigure={canConfigure && canEdit}
        onClose={() => setConnectionOpen(false)}
        onSaved={load}
      />

      <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-[#e8e9ed] bg-white px-4 dark:border-border dark:bg-background">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#735DF3]">
          <GandoMark className="h-8 w-8 transition-transform group-hover:scale-[1.04]" />
          <div className="hidden sm:block">
            <div className="text-[13px] font-semibold tracking-[-0.02em]">Gando Developers</div>
            <div className="text-[9px] text-muted-foreground">Documentation</div>
          </div>
        </Link>

        <div className="mx-1 hidden h-5 w-px bg-[#e7e8eb] lg:block dark:bg-border" />

        <div className="relative hidden min-w-[220px] max-w-[460px] flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#92959d]" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Rechercher dans la documentation…"
            className="h-9 w-full rounded-xl border border-[#e1e2e6] bg-[#fafafd] pl-9 pr-14 text-[11px] outline-none transition focus:border-[#bbb5f3] focus:bg-white focus:ring-2 focus:ring-[#735DF3]/10 dark:border-border dark:bg-muted/30"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#dedfe4] bg-white px-1.5 py-0.5 text-[9px] text-[#8d9098] dark:border-border dark:bg-background">⌘ K</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConnectionOpen(true)}
            className={cn(
              "hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-medium transition sm:inline-flex",
              connection?.connected
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-[#e2e3e7] bg-white text-[#60636b] hover:bg-[#f5f5f7] dark:border-border dark:bg-background dark:text-foreground",
            )}
          >
            <Github className="h-3.5 w-3.5" />
            <span className="max-w-[150px] truncate">{connectionLabel}</span>
          </button>

          <div className="flex h-8 items-center rounded-lg border border-[#e2e3e7] bg-[#f7f7f9] p-0.5 dark:border-border dark:bg-muted/40">
            <button type="button" onClick={() => setMode("preview")} className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium", mode === "preview" ? "bg-white shadow-sm dark:bg-background" : "text-muted-foreground")}>
              <Eye className="h-3 w-3" /> Aperçu
            </button>
            <button type="button" onClick={() => setMode("edit")} disabled={!canEdit} className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium disabled:opacity-40", mode === "edit" ? "bg-white shadow-sm dark:bg-background" : "text-muted-foreground")}>
              <Pencil className="h-3 w-3" /> Éditer
            </button>
          </div>

          {canEdit && currentPage ? (
            <>
              <button type="button" onClick={() => void savePage("draft")} disabled={saving || !dirty} className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#dedfe4] bg-white px-2.5 text-[10px] font-semibold transition hover:bg-[#f5f5f7] disabled:opacity-40 md:inline-flex dark:border-border dark:bg-background">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
              </button>
              <button type="button" onClick={() => void savePage("published")} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#17181c] px-3 text-[10px] font-semibold text-white transition hover:bg-[#2b2d33] disabled:opacity-50 dark:bg-white dark:text-black">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publier
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[244px_minmax(0,1fr)_220px]">
        <aside className="hidden min-h-0 flex-col border-r border-[#e9eaed] bg-[#fafafd] dark:border-border dark:bg-muted/10 md:flex">
          <div className="p-3 lg:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9699a1]" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher" className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-[11px] outline-none" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#94969e]">Documentation</span>
              <button type="button" onClick={() => void load()} className="rounded-md p-1 text-[#9799a1] hover:bg-[#eeeeF2] dark:hover:bg-muted" title="Synchroniser avec GitHub">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-2 px-2">
                {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-7 animate-pulse rounded-lg bg-[#eeeeF2] dark:bg-muted" />)}
              </div>
            ) : (
              <div className="space-y-5">
                {sections.map(({ section, pages: sectionPages }) => (
                  <div key={section}>
                    <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-medium text-[#878a92]">
                      <ChevronDown className="h-3 w-3" />
                      <span className="truncate">{section}</span>
                    </div>
                    <div className="space-y-0.5">
                      {sectionPages.map(page => {
                        const active = page.id === currentPage?.id;
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => choosePage(page.id)}
                            className={cn(
                              "flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition",
                              active
                                ? "bg-[#ececf2] font-medium text-[#24252a] dark:bg-muted dark:text-foreground"
                                : "text-[#62656d] hover:bg-[#f0f0f3] hover:text-[#24252a] dark:text-muted-foreground dark:hover:bg-muted",
                            )}
                          >
                            {page.slug === "accueil" ? <BookOpen className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                            <span className="min-w-0 flex-1 truncate">{page.title}</span>
                            {page.status === "published" ? <span className="h-1.5 w-1.5 rounded-full bg-[#55a970]" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-[#e6e7ea] p-2.5 dark:border-border">
            {canEdit ? (
              <button type="button" onClick={createPage} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#dedfe4] bg-white text-[11px] font-medium transition hover:bg-[#f4f4f6] dark:border-border dark:bg-background dark:hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> Nouvelle page
              </button>
            ) : null}
            <button type="button" onClick={() => setConnectionOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-muted-foreground hover:bg-[#f1f1f4] dark:hover:bg-muted">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{connection?.owner || "bilayl"}/{connection?.repo || "gando-app"}</span>
                <span className="block truncate">{connection?.branch || "master"} · {connection?.basePath || "docs/developer-portal"}</span>
              </span>
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-white dark:bg-background">
          {!connection?.connected ? (
            <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center px-6 py-12">
              <div className="w-full rounded-3xl border border-[#e6e6eb] bg-[#fcfcfd] p-8 text-center dark:border-border dark:bg-muted/10">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6556e8]"><Github className="h-6 w-6" /></div>
                <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Connecter la documentation à gando-app</h1>
                <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
                  Les pages seront stockées en Markdown/MDX directement dans le dépôt GitHub privé, versionnées avec le code et modifiables depuis le Cockpit.
                </p>
                {connection?.reason ? <div className="mx-auto mt-4 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">{connection.reason}</div> : null}
                <button type="button" onClick={() => setConnectionOpen(true)} className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-[#17181c] px-4 text-xs font-semibold text-white dark:bg-white dark:text-black">
                  <GitBranch className="h-4 w-4" /> Paramétrer la connexion
                </button>
              </div>
            </div>
          ) : !currentPage ? (
            <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center px-6 py-12">
              <div className="w-full rounded-3xl border border-dashed border-[#dcdde2] p-8 text-center dark:border-border">
                <Folder className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-semibold">Aucune page dans {connection.basePath}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Créez la première page ; elle sera ajoutée directement au dépôt GitHub.</p>
                {canEdit ? <button type="button" onClick={createPage} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#17181c] px-4 text-xs font-semibold text-white dark:bg-white dark:text-black"><Plus className="h-4 w-4" /> Créer une page</button> : null}
              </div>
            </div>
          ) : mode === "edit" && canEdit ? (
            <div className="flex min-h-full flex-col">
              <div className="shrink-0 border-b border-[#ececf0] px-5 py-4 dark:border-border lg:px-8">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
                    <Code2 className="h-3.5 w-3.5" />
                    <span className="font-mono">{currentPage.path || `${connection.basePath}/${currentPage.slug}.mdx`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dirty ? <span className="text-[10px] text-amber-600">Modifications non enregistrées</span> : <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700"><Check className="h-3 w-3" /> Synchronisé</span>}
                    <StatusBadge status={currentPage.status} />
                  </div>
                </div>

                <input
                  value={currentPage.title}
                  onChange={event => {
                    const title = event.target.value;
                    const previousAutoSlug = slugify(currentPage.title);
                    updateCurrent({
                      title,
                      slug: !currentPage.slug || currentPage.slug === previousAutoSlug ? slugify(title) : currentPage.slug,
                    });
                  }}
                  className="w-full bg-transparent text-[28px] font-semibold tracking-[-0.04em] outline-none placeholder:text-[#bbbcc2]"
                  placeholder="Titre de la page"
                />
                <input value={currentPage.description} onChange={event => updateCurrent({ description: event.target.value })} className="mt-1 w-full bg-transparent text-[12px] leading-5 text-muted-foreground outline-none" placeholder="Description courte…" />

                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_90px]">
                  <label className="flex h-8 items-center rounded-lg border border-[#e5e5e9] bg-[#fafafd] px-2.5 text-[10px] text-muted-foreground dark:border-border dark:bg-muted/30">
                    <span className="mr-2">Slug</span>
                    <input value={currentPage.slug} onChange={event => updateCurrent({ slug: slugify(event.target.value) })} className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-foreground outline-none" />
                  </label>
                  <label className="flex h-8 items-center rounded-lg border border-[#e5e5e9] bg-[#fafafd] px-2.5 text-[10px] text-muted-foreground dark:border-border dark:bg-muted/30">
                    <span className="mr-2">Section</span>
                    <input value={currentPage.section} onChange={event => updateCurrent({ section: event.target.value })} className="min-w-0 flex-1 bg-transparent text-[10px] text-foreground outline-none" />
                  </label>
                  <label className="flex h-8 items-center rounded-lg border border-[#e5e5e9] bg-[#fafafd] px-2.5 text-[10px] text-muted-foreground dark:border-border dark:bg-muted/30">
                    <span className="mr-2">Ordre</span>
                    <input type="number" min={0} value={currentPage.order} onChange={event => updateCurrent({ order: Number(event.target.value) || 0 })} className="w-full bg-transparent text-right text-[10px] text-foreground outline-none" />
                  </label>
                </div>
              </div>

              <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[#ececf0] px-5 dark:border-border lg:px-8">
                <button type="button" onClick={() => insertMarkdown("# ", "", "Titre")} className="rounded px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted">H1</button>
                <button type="button" onClick={() => insertMarkdown("## ", "", "Sous-titre")} className="rounded px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted">H2</button>
                <button type="button" onClick={() => insertMarkdown("### ", "", "Section")} className="rounded px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted">H3</button>
                <div className="mx-1 h-4 w-px bg-border" />
                <button type="button" onClick={() => insertMarkdown("**", "**", "gras")} className="rounded px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted">B</button>
                <button type="button" onClick={() => insertMarkdown("`", "`", "code")} className="rounded px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-muted">&lt;/&gt;</button>
                <button type="button" onClick={() => insertMarkdown("- ", "", "élément")} className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">• Liste</button>
                <button type="button" onClick={() => insertMarkdown("> ", "", "Information importante")} className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">Citation</button>
                <button type="button" onClick={() => void deletePage()} className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20" title="Supprimer la page"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>

              <textarea
                ref={textareaRef}
                value={currentPage.body}
                onChange={event => updateCurrent({ body: event.target.value })}
                spellCheck
                className="min-h-[520px] flex-1 resize-none bg-white px-5 py-6 font-mono text-[12px] leading-6 text-[#34363d] outline-none dark:bg-background dark:text-foreground lg:px-8"
                placeholder="Rédigez votre documentation…"
              />

              <div className="flex h-9 shrink-0 items-center justify-between border-t border-[#ececf0] px-5 text-[9px] text-muted-foreground dark:border-border lg:px-8">
                <span>Dernière synchro · {formatRelativeDate(currentPage.updatedAt)}</span>
                <span>{currentPage.body.length.toLocaleString("fr-FR")} caractères</span>
              </div>
            </div>
          ) : (
            <article className="mx-auto w-full max-w-[860px] px-6 pb-24 pt-10 lg:px-10 lg:pt-14">
              <div className="mb-8 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Gando Developers</span><span>/</span><span>{currentPage.section}</span>
              </div>
              <div className="mb-8">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={currentPage.status} />
                  {currentPage.path ? <span className="font-mono text-[9px] text-muted-foreground">{currentPage.path}</span> : null}
                </div>
                {currentPage.description ? <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground">{currentPage.description}</p> : null}
              </div>
              <MarkdownPreview source={currentPage.body} />

              <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[#ececf0] pt-5 dark:border-border">
                <span className="text-[10px] text-muted-foreground">Dernière mise à jour · {formatRelativeDate(currentPage.updatedAt)}</span>
                {currentPage.path ? (
                  <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#6255dd] hover:underline">
                    Modifier sur GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </article>
          )}

          {(error || message) ? (
            <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
              <div className={cn("rounded-xl border px-4 py-2.5 text-[11px] shadow-lg backdrop-blur", error ? "border-red-200 bg-red-50/95 text-red-800 dark:border-red-900 dark:bg-red-950/90 dark:text-red-200" : "border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200")}>
                {error || message}
              </div>
            </div>
          ) : null}
        </main>

        <aside className="hidden min-h-0 border-l border-[#e9eaed] bg-[#fcfcfd] xl:block dark:border-border dark:bg-muted/5">
          <div className="sticky top-0 p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#8c8f97]">Sur cette page</div>
            <nav className="mt-3 space-y-1">
              {toc.length ? toc.map(item => (
                <a key={item.id} href={`#${item.id}`} className={cn("block py-1 text-[10px] leading-4 text-muted-foreground transition hover:text-foreground", item.depth === 3 && "pl-3")}>
                  {item.title}
                </a>
              )) : <div className="text-[10px] leading-5 text-muted-foreground">Ajoutez des titres H2/H3 pour générer automatiquement la table des matières.</div>}
            </nav>

            <div className="mt-7 border-t border-[#ececf0] pt-5 dark:border-border">
              <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#8c8f97]">Source</div>
              <div className="mt-3 rounded-xl border border-[#e5e6ea] bg-white p-3 dark:border-border dark:bg-background">
                <div className="flex items-center gap-2 text-[10px] font-semibold"><Github className="h-3.5 w-3.5" /> {connection?.owner}/{connection?.repo}</div>
                <div className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{connection?.branch}</div>
                <div className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{connection?.basePath}</div>
                <div className="mt-3 flex items-center gap-1.5 text-[9px]">
                  <span className={cn("h-1.5 w-1.5 rounded-full", connection?.writable ? "bg-emerald-500" : "bg-amber-500")} />
                  <span className="text-muted-foreground">{connection?.writable ? "Lecture + écriture" : "Lecture seule"}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

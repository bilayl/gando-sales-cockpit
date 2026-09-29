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
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DocsDescription, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { DeveloperMdxPreview } from "@/components/developer-mdx-preview";
import { DeveloperEditorSidebar } from "@/components/developer-editor-sidebar";
import { DEVELOPER_SLASH_COMMANDS, DeveloperSlashMenu, type SlashCommandId } from "@/components/developer-slash-menu";
import { GandoSidebarMark } from "@/components/cockpit-sidebar-shared";
import { DeveloperSiteSettings } from "@/components/developer-site-settings";

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
  oauthAvailable?: boolean;
};

type RepositoryOption = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  writable: boolean;
  updatedAt: string | null;
  url: string;
};

type RepositoryOptions = {
  repository: {
    owner: string;
    name: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
    writable: boolean;
    url: string;
  };
  branches: Array<{ name: string; protected: boolean }>;
  directories: string[];
  selectedBranch: string;
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
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [repositorySearch, setRepositorySearch] = useState("");
  const [owner, setOwner] = useState(connection?.owner || "");
  const [repo, setRepo] = useState(connection?.repo || "");
  const [branch, setBranch] = useState(connection?.branch || "");
  const [basePath, setBasePath] = useState(connection?.basePath || "docs/developer-portal");
  const [branches, setBranches] = useState<Array<{ name: string; protected: boolean }>>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const githubAuthenticated = Boolean(connection?.hasToken);

  const loadRepositories = useCallback(async (query = "") => {
    if (!connection?.hasToken) return;
    setLoadingRepositories(true);
    setError("");
    try {
      const response = await fetch(`/api/developer-docs/repositories?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { repositories?: RepositoryOption[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Impossible de charger les dépôts GitHub.");
      setRepositories(Array.isArray(body.repositories) ? body.repositories : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les dépôts GitHub.");
    } finally {
      setLoadingRepositories(false);
    }
  }, [connection?.hasToken]);

  const loadRepositoryOptions = useCallback(async (nextOwner: string, nextRepo: string, nextBranch?: string) => {
    if (!nextOwner || !nextRepo) return;
    setLoadingOptions(true);
    setError("");
    try {
      const params = new URLSearchParams({ owner: nextOwner, repo: nextRepo });
      if (nextBranch) params.set("branch", nextBranch);
      const response = await fetch(`/api/developer-docs/repository-options?${params.toString()}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as Partial<RepositoryOptions> & { error?: string };
      if (!response.ok || !body.repository) throw new Error(body.error || "Impossible de charger le dépôt GitHub.");

      const nextBranches = Array.isArray(body.branches) ? body.branches : [];
      const nextDirectories = Array.isArray(body.directories) ? body.directories : [];
      const selected = body.selectedBranch || body.repository.defaultBranch || nextBranches[0]?.name || "main";

      setOwner(body.repository.owner);
      setRepo(body.repository.name);
      setBranch(selected);
      setBranches(nextBranches);
      setDirectories(nextDirectories);

      const currentPathExists = nextDirectories.includes(basePath);
      if (!currentPathExists) {
        const suggested = nextDirectories.find(path => /(^|\/)(docs?|documentation)(\/|$)/i.test(path))
          || nextDirectories.find(path => /docs?/i.test(path))
          || "docs";
        setBasePath(suggested);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger le dépôt GitHub.");
    } finally {
      setLoadingOptions(false);
    }
  }, [basePath]);

  useEffect(() => {
    if (!open) return;
    setOwner(connection?.owner || "");
    setRepo(connection?.repo || "");
    setBranch(connection?.branch || "");
    setBasePath(connection?.basePath || "docs/developer-portal");
    setToken("");
    setRepositorySearch("");
    setError("");

    if (connection?.hasToken) {
      void loadRepositories();
      if (connection.owner && connection.repo) {
        void loadRepositoryOptions(connection.owner, connection.repo, connection.branch);
      }
    }
  }, [open, connection, loadRepositories, loadRepositoryOptions]);

  useEffect(() => {
    if (!open || !connection?.hasToken) return;
    const timeout = window.setTimeout(() => {
      void loadRepositories(repositorySearch);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [repositorySearch, open, connection?.hasToken, loadRepositories]);

  if (!open) return null;

  async function save() {
    if (!owner || !repo) {
      setError("Choisissez d’abord un repository.");
      return;
    }
    if (!branch) {
      setError("Choisissez une branche.");
      return;
    }
    if (!basePath.trim()) {
      setError("Choisissez le dossier qui contiendra la documentation.");
      return;
    }

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

  async function connectWithToken() {
    if (!token.trim()) {
      setError("Ajoutez un token GitHub.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const fallbackOwner = owner || connection?.owner || "bilayl";
      const fallbackRepo = repo || connection?.repo || "gando-app";
      const fallbackBranch = branch || connection?.branch || "master";
      const response = await fetch("/api/developer-docs/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: fallbackOwner,
          repo: fallbackRepo,
          branch: fallbackBranch,
          basePath: basePath || "docs/developer-portal",
          token,
          authenticateOnly: true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Connexion GitHub impossible.");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion GitHub impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/developer-docs/connection", { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Déconnexion impossible.");
      }
      setRepositories([]);
      setBranches([]);
      setDirectories([]);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Déconnexion impossible.");
    } finally {
      setSaving(false);
    }
  }

  const selectedRepository = repositories.find(item => item.owner === owner && item.name === repo);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[#e3e4e8] bg-white shadow-2xl dark:border-border dark:bg-background">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ececf0] px-5 py-4 dark:border-border">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Github className="h-4 w-4" />
              Connecteur GitHub
            </div>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-muted-foreground">
              Connectez un compte GitHub, choisissez le repository, la branche et le dossier à utiliser comme source de la documentation. Aucun repository n’est imposé.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!githubAuthenticated ? (
            <div className="mx-auto max-w-lg py-4">
              <div className="rounded-2xl border border-[#e5e6ea] bg-[#fafafd] p-5 text-center dark:border-border dark:bg-muted/10">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17181c] text-white dark:bg-white dark:text-black">
                  <Github className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-semibold">Connecter GitHub</div>
                <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-muted-foreground">
                  Une fois connecté, le Cockpit affichera automatiquement les repositories auxquels ce compte a accès.
                </p>

                {connection?.oauthAvailable ? (
                  <a
                    href="/api/developer-docs/github/start"
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-[#17181c] px-4 text-xs font-semibold text-white transition hover:bg-[#2b2d33] dark:bg-white dark:text-black"
                  >
                    <Github className="h-4 w-4" />
                    Continuer avec GitHub
                  </a>
                ) : null}

                <div className="my-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.09em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {connection?.oauthAvailable ? "ou connexion avancée" : "connexion"}
                  <span className="h-px flex-1 bg-border" />
                </div>

                <label className="block space-y-1.5 text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Token GitHub</span>
                  <input
                    value={token}
                    onChange={event => setToken(event.target.value)}
                    type="password"
                    disabled={!canConfigure}
                    placeholder="github_pat_…"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20"
                  />
                  <span className="block text-[10px] leading-5 text-muted-foreground">
                    Alternative pour une connexion interne : token avec accès aux repositories concernés.
                  </span>
                </label>
                {canConfigure ? (
                  <button
                    type="button"
                    onClick={connectWithToken}
                    disabled={saving}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white text-xs font-semibold transition hover:bg-muted disabled:opacity-60 dark:bg-background"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                    Connecter avec ce token
                  </button>
                ) : null}
              </div>
              {error ? <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">{error}</div> : null}
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">1 · Repository</div>
                    <div className="mt-0.5 text-xs font-semibold">Choisir la source</div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> GitHub connecté
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={repositorySearch}
                    onChange={event => setRepositorySearch(event.target.value)}
                    placeholder="Rechercher un repository…"
                    className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20"
                  />
                </div>

                <div className="max-h-[340px] space-y-1 overflow-y-auto rounded-xl border border-border bg-[#fafafd] p-1.5 dark:bg-muted/10">
                  {loadingRepositories ? (
                    <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : repositories.length ? repositories.map(item => {
                    const active = item.owner === owner && item.name === repo;
                    return (
                      <button
                        key={item.fullName}
                        type="button"
                        onClick={() => {
                          setOwner(item.owner);
                          setRepo(item.name);
                          setBranch(item.defaultBranch);
                          void loadRepositoryOptions(item.owner, item.name, item.defaultBranch);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                          active
                            ? "border-[#bcb5f5] bg-[#f4f2ff] dark:border-[#6255dd] dark:bg-[#6255dd]/10"
                            : "border-transparent hover:border-border hover:bg-white dark:hover:bg-background",
                        )}
                      >
                        <Github className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold">{item.fullName}</span>
                          <span className="mt-0.5 block text-[9px] text-muted-foreground">
                            {item.private ? "Privé" : "Public"} · {item.defaultBranch}
                          </span>
                        </span>
                        <span className={cn("h-2 w-2 rounded-full", item.writable ? "bg-emerald-500" : "bg-amber-500")} title={item.writable ? "Lecture + écriture" : "Lecture seule"} />
                      </button>
                    );
                  }) : (
                    <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">Aucun repository trouvé.</div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">2 · Emplacement</div>
                  <div className="mt-0.5 text-xs font-semibold">Branche et dossier</div>
                </div>

                {owner && repo ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-[#fafafd] p-3 dark:bg-muted/10">
                      <div className="flex items-start gap-2">
                        <Github className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-semibold">{owner}/{repo}</div>
                          <div className="mt-0.5 text-[9px] text-muted-foreground">
                            {selectedRepository?.private ? "Repository privé" : "Repository"} · {selectedRepository?.writable === false ? "lecture seule" : "écriture autorisée"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Branche</span>
                      <div className="relative">
                        {loadingOptions ? <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
                        <select
                          value={branch}
                          onChange={event => {
                            const nextBranch = event.target.value;
                            setBranch(nextBranch);
                            void loadRepositoryOptions(owner, repo, nextBranch);
                          }}
                          disabled={loadingOptions}
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 pr-8 text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20"
                        >
                          {branches.length ? branches.map(item => (
                            <option key={item.name} value={item.name}>{item.name}{item.protected ? " · protégée" : ""}</option>
                          )) : <option value={branch}>{branch || "main"}</option>}
                        </select>
                      </div>
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dossier de documentation</span>
                      <input
                        value={basePath}
                        onChange={event => setBasePath(event.target.value)}
                        list="developer-docs-directory-options"
                        placeholder="docs/developer-portal"
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[#735DF3]/20"
                      />
                      <datalist id="developer-docs-directory-options">
                        {directories.map(path => <option key={path} value={path} />)}
                      </datalist>
                      <span className="block text-[9px] leading-4 text-muted-foreground">
                        Vous pouvez choisir un dossier existant ou saisir un nouveau chemin. Il sera créé à la première page enregistrée.
                      </span>
                    </label>

                    <div className="rounded-xl border border-[#e6e6eb] bg-white p-3 text-[10px] dark:border-border dark:bg-background">
                      <div className="text-muted-foreground">Source sélectionnée</div>
                      <div className="mt-1 break-all font-mono font-medium">{owner}/{repo}@{branch}/{basePath}</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[11px] text-muted-foreground">
                    Sélectionnez un repository à gauche.
                  </div>
                )}
              </section>

              {error ? <div className="lg:col-span-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">{error}</div> : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#ececf0] bg-[#fafafd] px-5 py-3 dark:border-border dark:bg-muted/20">
          <div className="min-w-0 text-[10px] text-muted-foreground">
            {githubAuthenticated
              ? <>GitHub connecté · <span className="font-mono">{owner && repo ? `${owner}/${repo}` : "aucun repo sélectionné"}</span></>
              : "Connectez GitHub pour afficher vos repositories."}
          </div>
          <div className="flex items-center gap-2">
            {githubAuthenticated && canConfigure ? (
              <button type="button" onClick={disconnect} disabled={saving} className="h-8 rounded-lg px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                Déconnecter
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="h-8 rounded-lg border border-border bg-background px-3 text-[11px] font-medium hover:bg-muted">
              Fermer
            </button>
            {githubAuthenticated && canConfigure ? (
              <button type="button" onClick={save} disabled={saving || !owner || !repo || !branch || !basePath.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#17181c] px-3 text-[11px] font-semibold text-white hover:bg-[#2b2d33] disabled:opacity-50 dark:bg-white dark:text-black">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                Utiliser ce repository
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
  const [siteSettingsOpen, setSiteSettingsOpen] = useState(false);
  const [siteCategories, setSiteCategories] = useState<string[]>([]);
  const [pageSettingsId, setPageSettingsId] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashStart, setSlashStart] = useState(0);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageInsertAtRef = useRef<number | null>(null);

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

      const [pagesResponse, settingsResponse] = await Promise.all([
        fetch("/api/developer-docs/pages", { cache: "no-store" }),
        fetch("/api/developer-docs/settings", { cache: "no-store" }),
      ]);
      const pagesBody = await pagesResponse.json().catch(() => ({})) as { pages?: DocPage[]; error?: string };
      if (!pagesResponse.ok) throw new Error(pagesBody.error || "Documentation GitHub indisponible.");

      const settingsBody = await settingsResponse.json().catch(() => ({})) as {
        settings?: { navigation?: { categories?: string[] } };
      };
      if (settingsResponse.ok) {
        setSiteCategories(Array.isArray(settingsBody.settings?.navigation?.categories)
          ? settingsBody.settings?.navigation?.categories || []
          : []);
      }

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
    const params = new URLSearchParams(window.location.search);
    const github = params.get("github");
    if (!github) return;

    if (github === "connected") {
      setConnectionOpen(true);
      setMessage("GitHub est connecté. Choisissez maintenant le repository à utiliser.");
    } else if (github === "oauth_missing") {
      setError("Le connecteur OAuth GitHub doit être configuré côté serveur.");
      setConnectionOpen(true);
    } else if (github === "state_error") {
      setError("La connexion GitHub a expiré. Relancez la connexion.");
      setConnectionOpen(true);
    } else {
      setError("La connexion GitHub n’a pas pu être finalisée.");
      setConnectionOpen(true);
    }

    params.delete("github");
    const next = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
  }, []);

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

  function createPage(section = siteCategories[0] || "Guides") {
    if (!canEdit) return;
    if (dirty && !window.confirm("Cette page contient des modifications non enregistrées. Continuer ?")) return;

    const id = `new-${Date.now()}`;
    const next: DocPage = {
      id,
      path: "",
      sha: "",
      title: "Nouvelle page",
      slug: `nouvelle-page-${pages.length + 1}`,
      section,
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

  function handleEditorBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    const caret = event.target.selectionStart;
    updateCurrent({ body: value });

    const beforeCaret = value.slice(0, caret);
    const lineStart = beforeCaret.lastIndexOf("\n") + 1;
    const slashIndex = beforeCaret.lastIndexOf("/");
    const query = slashIndex >= 0 ? beforeCaret.slice(slashIndex + 1) : "";

    const slashIsOnCurrentLine = slashIndex >= lineStart;
    const onlyWhitespaceBeforeSlash = slashIsOnCurrentLine
      && beforeCaret.slice(lineStart, slashIndex).trim().length === 0;
    const queryIsValid = !/[\s/]/.test(query);

    if (slashIsOnCurrentLine && onlyWhitespaceBeforeSlash && queryIsValid) {
      setSlashOpen(true);
      setSlashStart(slashIndex);
      setSlashQuery(query);
      setSlashSelectedIndex(0);
    } else {
      setSlashOpen(false);
      setSlashQuery("");
    }
  }

  function slashInsertion(id: SlashCommandId) {
    const tick = String.fromCharCode(96);
    const blocks: Record<SlashCommandId, string> = {
      text: "",
      h1: "# ",
      h2: "## ",
      h3: "### ",
      h4: "#### ",
      blockquote: "> ",
      "unordered-list": "- ",
      "ordered-list": "1. ",
      table: "| Colonne 1 | Colonne 2 |\n| --- | --- |\n| Valeur | Valeur |",
      code: `${tick}${tick}${tick}ts\n\n${tick}${tick}${tick}`,
      image: "",
      callout: '<Callout title="Information">\n\nAjoutez votre contenu ici.\n\n</Callout>',
      tabs: '<DocTabs items="Tab 1|Tab 2">\n<DocTab value="Tab 1">\n\nContenu du premier onglet.\n\n</DocTab>\n<DocTab value="Tab 2">\n\nContenu du second onglet.\n\n</DocTab>\n</DocTabs>',
      steps: '<Steps>\n<Step>\n\n## Étape 1\n\nDécrivez cette étape.\n\n</Step>\n<Step>\n\n## Étape 2\n\nDécrivez cette étape.\n\n</Step>\n</Steps>',
    };
    return blocks[id];
  }

  function applySlashCommand(id: SlashCommandId) {
    const textarea = textareaRef.current;
    if (!textarea || !currentPage) return;

    const end = textarea.selectionStart;
    if (id === "image") {
      imageInsertAtRef.current = slashStart;
      setSlashOpen(false);
      setSlashQuery("");
      imageInputRef.current?.click();
      return;
    }

    const insertion = slashInsertion(id);
    const nextBody = `${currentPage.body.slice(0, slashStart)}${insertion}${currentPage.body.slice(end)}`;
    updateCurrent({ body: nextBody });
    setSlashOpen(false);
    setSlashQuery("");

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = slashStart + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  const filteredSlashCommands = DEVELOPER_SLASH_COMMANDS.filter(command => {
    const query = slashQuery.trim().toLowerCase();
    return !query
      || command.label.toLowerCase().includes(query)
      || command.id.includes(query);
  });

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!slashOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setSlashOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSlashSelectedIndex(index => filteredSlashCommands.length ? (index + 1) % filteredSlashCommands.length : 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSlashSelectedIndex(index => filteredSlashCommands.length ? (index - 1 + filteredSlashCommands.length) % filteredSlashCommands.length : 0);
      return;
    }

    if (event.key === "Enter" && filteredSlashCommands.length) {
      event.preventDefault();
      applySlashCommand(filteredSlashCommands[Math.min(slashSelectedIndex, filteredSlashCommands.length - 1)].id);
    }
  }

  async function persistSiteCategories(categories: string[]) {
    const normalized = Array.from(new Set(categories.map(item => item.trim()).filter(Boolean)));
    setSiteCategories(normalized);
    try {
      const response = await fetch("/api/developer-docs/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { navigation: { categories: normalized } } }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer la navigation.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la navigation.");
    }
  }

  function addCategory() {
    const name = window.prompt("Nom de la nouvelle catégorie");
    if (!name?.trim()) return;
    if (siteCategories.some(item => item.toLowerCase() === name.trim().toLowerCase())) return;
    void persistSiteCategories([...siteCategories, name.trim()]);
  }

  async function savePageObject(page: DocPage, patch: Partial<DocPage> = {}) {
    const next = { ...page, ...patch };
    const response = await fetch("/api/developer-docs/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const body = await response.json().catch(() => ({})) as { page?: DocPage; error?: string };
    if (!response.ok || !body.page) throw new Error(body.error || "Enregistrement impossible.");
    setPages(items => items.map(item => item.id === page.id ? body.page as DocPage : item));
    if (selectedId === page.id) setSelectedId(body.page.id);
    return body.page;
  }

  async function renameCategory(section: string) {
    const nextName = window.prompt("Nouveau nom de la catégorie", section)?.trim();
    if (!nextName || nextName === section) return;
    if (dirty && pages.some(page => page.id === selectedId && page.section === section)) {
      setError("Enregistrez d’abord la page en cours avant de renommer sa catégorie.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const affected = pages.filter(page => page.section === section);
      for (const page of affected) {
        if (page.path || page.sha) await savePageObject(page, { section: nextName });
        else setPages(items => items.map(item => item.id === page.id ? { ...item, section: nextName } : item));
      }
      await persistSiteCategories(siteCategories.map(item => item === section ? nextName : item));
      setMessage(`Catégorie « ${section} » renommée.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de renommer la catégorie.");
    } finally {
      setSaving(false);
    }
  }

  function renamePageAction(page: DocPage) {
    const title = window.prompt("Nouveau titre de la page", page.title)?.trim();
    if (!title || title === page.title) return;
    if (page.id === selectedId) {
      setPages(items => items.map(item => item.id === page.id ? { ...item, title } : item));
      setDirty(true);
      return;
    }
    setSaving(true);
    void savePageObject(page, { title })
      .then(() => setMessage("Page renommée."))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Impossible de renommer la page."))
      .finally(() => setSaving(false));
  }

  function duplicatePageAction(page: DocPage) {
    const id = `new-${Date.now()}`;
    const copy: DocPage = {
      ...page,
      id,
      path: "",
      sha: "",
      title: `${page.title} copie`,
      slug: `${page.slug}-copie`,
      status: "draft",
      order: page.order + 1,
      updatedAt: null,
    };
    setPages(items => [...items, copy]);
    setSelectedId(id);
    setMode("edit");
    setDirty(true);
    setMessage("Copie créée en brouillon.");
  }

  function movePageAction(page: DocPage, section: string) {
    if (page.id === selectedId) {
      setPages(items => items.map(item => item.id === page.id ? { ...item, section } : item));
      setDirty(true);
      if (!siteCategories.includes(section)) void persistSiteCategories([...siteCategories, section]);
      return;
    }
    setSaving(true);
    void savePageObject(page, { section })
      .then(() => {
        if (!siteCategories.includes(section)) void persistSiteCategories([...siteCategories, section]);
        setMessage(`Page déplacée vers « ${section} ».`);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Impossible de déplacer la page."))
      .finally(() => setSaving(false));
  }

  async function deletePageAction(page: DocPage) {
    if (page.id === selectedId) {
      await deletePage();
      return;
    }
    if (!window.confirm(`Supprimer « ${page.title} » ?`)) return;
    if (!page.path || !page.sha) {
      setPages(items => items.filter(item => item.id !== page.id));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/developer-docs/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: page.path, sha: page.sha, title: page.title }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Suppression impossible.");
      setPages(items => items.filter(item => item.id !== page.id));
      setMessage("Page déplacée vers la corbeille.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentPage) return;

    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/developer-docs/assets", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({})) as { src?: string; error?: string };
      if (!response.ok || !body.src) throw new Error(body.error || "Impossible d’envoyer l’image.");

      const insertAt = imageInsertAtRef.current ?? textareaRef.current?.selectionStart ?? currentPage.body.length;
      const cursorEnd = textareaRef.current?.selectionStart ?? insertAt;
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      const markdown = `![${alt}](${body.src})`;
      const nextBody = `${currentPage.body.slice(0, insertAt)}${markdown}${currentPage.body.slice(cursorEnd)}`;
      updateCurrent({ body: nextBody });
      imageInsertAtRef.current = null;
      setMessage("Image ajoutée au repository et insérée dans le MDX.");

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const cursor = insertAt + markdown.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’envoyer l’image.");
    } finally {
      setSaving(false);
    }
  }

  const connectionLabel = connection?.connected
    ? `${connection.owner}/${connection.repo}`
    : "Connecter GitHub";
  const editorActive = mode === "edit" && canEdit && Boolean(connection?.connected) && Boolean(currentPage);

  return (
    <div className="gando-developer-root flex h-screen min-h-[680px] flex-col overflow-hidden">
      <ConnectionModal
        open={connectionOpen}
        connection={connection}
        canConfigure={canConfigure && canEdit}
        onClose={() => setConnectionOpen(false)}
        onSaved={load}
      />

      {!editorActive ? (
      <header className="gando-stripe-header">
        <Link href="/" className="gando-stripe-brand" aria-label="Retour au Cockpit Gando">
          <GandoSidebarMark />
          <span className="ml-2.5 grid leading-tight">
            <span className="text-[15px] font-semibold tracking-[-0.025em] text-[#202435] dark:text-white">Gando</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Developers</span>
          </span>
        </Link>

        <div className="gando-stripe-search-wrap">
          <Search className="gando-stripe-search-icon" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Rechercher dans la documentation…"
            className="gando-stripe-search"
          />
          <span className="gando-stripe-search-kbd">⌘K</span>
        </div>

        <div className="gando-stripe-actions">
          <button
            type="button"
            onClick={() => setConnectionOpen(true)}
            className="gando-stripe-action repo-label"
          >
            <Github className="h-4 w-4" />
            <span className="max-w-[170px] truncate">{connectionLabel}</span>
          </button>

          <div className="gando-stripe-segment">
            <button type="button" data-active={mode === "preview"} onClick={() => setMode("preview")}>
              <Eye className="h-3.5 w-3.5" /> Aperçu
            </button>
            <button type="button" data-active={mode === "edit"} onClick={() => setMode("edit")} disabled={!canEdit}>
              <Pencil className="h-3.5 w-3.5" /> Éditer
            </button>
          </div>

          {canEdit && currentPage ? (
            <>
              <button
                type="button"
                onClick={() => void savePage("draft")}
                disabled={saving || !dirty}
                className="gando-stripe-action hidden lg:inline-flex disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => void savePage("published")}
                disabled={saving}
                className="gando-stripe-action-primary disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publier
              </button>
            </>
          ) : null}
        </div>
      </header>
      ) : null}

      <div className={cn("min-h-0 flex-1", editorActive ? "mint-editor-shell" : "gando-docs-shell")}>
        {editorActive && currentPage && connection ? (
          <DeveloperEditorSidebar
            pages={pages}
            selectedId={currentPage.id}
            workspaceLabel={connection.repo}
            sourceLabel={connection.basePath}
            onSelectPage={choosePage}
            onNewPage={createPage}
            onSettings={() => setConnectionOpen(true)}
          />
        ) : (
        <aside className="gando-docs-sidebar">
          <div className="gando-docs-sidebar-scroll">
            <div className="mb-3 flex items-center justify-between px-[10px]">
              <span className="text-[12px] font-semibold text-[#878d9b]">Documentation</span>
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
                    <div className="gando-docs-sidebar-section">{section}</div>
                    <div className="space-y-0.5">
                      {sectionPages.map(page => {
                        const active = page.id === currentPage?.id;
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => choosePage(page.id)}
                            className="gando-docs-sidebar-item"
                            data-active={active}
                          >
                            <span className="min-w-0 flex-1 truncate">{page.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="gando-docs-sidebar-footer space-y-2">
            {canEdit ? (
              <button type="button" onClick={createPage} className="flex items-center justify-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nouvelle page
              </button>
            ) : null}
            <button type="button" onClick={() => setConnectionOpen(true)} className="flex items-center gap-2 px-2 text-left">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{connection?.owner || "bilayl"}/{connection?.repo || "gando-app"}</span>
                <span className="block truncate">{connection?.branch || "master"} · {connection?.basePath || "docs/developer-portal"}</span>
              </span>
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
        )}

        <main className={cn("gando-docs-main min-h-0", editorActive && "mint-editor-main")}>
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
            <div className="mint-editor-stage">
              <header className="mint-editor-topbar">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate font-medium text-foreground">{currentPage.title}</span>
                    <span>·</span>
                    <span className="truncate font-mono">{currentPage.path || `${connection.basePath}/${currentPage.slug}.mdx`}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {dirty ? (
                      <span className="text-amber-600">Modifications non enregistrées</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check className="h-3 w-3" /> Synchronisé
                      </span>
                    )}
                    <StatusBadge status={currentPage.status} />
                  </div>
                </div>

                <div className="mint-editor-topbar-actions">
                  <button type="button" className="mint-editor-topbar-button" onClick={() => setMode("preview")}>
                    <Eye className="size-4" /> Preview
                  </button>
                  <button
                    type="button"
                    className="mint-editor-topbar-button"
                    onClick={() => void savePage("draft")}
                    disabled={saving || !dirty}
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    className="mint-editor-publish-button"
                    onClick={() => void savePage("published")}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Publish
                  </button>
                </div>
              </header>

              <div className="mint-editor-canvas-scroll">
                <div className="mint-editor-canvas">
                  <div className="mint-editor-document-head">
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
                      className="mint-editor-title-input"
                      placeholder="Titre de la page"
                    />
                    <input
                      value={currentPage.description}
                      onChange={event => updateCurrent({ description: event.target.value })}
                      className="mint-editor-description-input"
                      placeholder="Description courte…"
                    />

                    <div className="mint-editor-meta-grid">
                      <label>
                        <span>Slug</span>
                        <input value={currentPage.slug} onChange={event => updateCurrent({ slug: slugify(event.target.value) })} />
                      </label>
                      <label>
                        <span>Section</span>
                        <input value={currentPage.section} onChange={event => updateCurrent({ section: event.target.value })} />
                      </label>
                      <label>
                        <span>Ordre</span>
                        <input type="number" min={0} value={currentPage.order} onChange={event => updateCurrent({ order: Number(event.target.value) || 0 })} />
                      </label>
                    </div>
                  </div>

                  <div className="mint-editor-formatbar">
                    <button type="button" onClick={() => insertMarkdown("**", "**", "gras")}><strong>B</strong></button>
                    <button type="button" onClick={() => insertMarkdown("_", "_", "italique")}><em>I</em></button>
                    <button type="button" onClick={() => insertMarkdown("`", "`", "code")}><Code2 className="size-4" /></button>
                    <span className="mint-editor-format-divider" />
                    <button type="button" onClick={() => insertMarkdown("## ", "", "Sous-titre")}>H2</button>
                    <button type="button" onClick={() => insertMarkdown("- ", "", "élément")}>• List</button>
                    <button type="button" onClick={() => insertMarkdown("> ", "", "Information importante")}>Quote</button>
                    <span className="ml-auto text-[11px] text-muted-foreground">Tapez <kbd>/</kbd> pour insérer un composant</span>
                    <button type="button" onClick={() => void deletePage()} className="is-danger" title="Supprimer la page">
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mint-editor-body-wrap">
                    {slashOpen ? (
                      <DeveloperSlashMenu
                        query={slashQuery}
                        selectedIndex={slashSelectedIndex}
                        onSelectedIndexChange={setSlashSelectedIndex}
                        onSelect={applySlashCommand}
                      />
                    ) : null}

                    <textarea
                      ref={textareaRef}
                      value={currentPage.body}
                      onChange={handleEditorBodyChange}
                      onKeyDown={handleEditorKeyDown}
                      spellCheck
                      className="mint-editor-textarea"
                      placeholder="Commencez à écrire… Tapez / pour ajouter un bloc"
                    />
                  </div>

                  <div className="mint-editor-statusbar">
                    <span>Dernière synchro · {formatRelativeDate(currentPage.updatedAt)}</span>
                    <span>{currentPage.body.length.toLocaleString("fr-FR")} caractères</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <article className="gando-docs-article">
              <div className="gando-docs-breadcrumb flex items-center gap-2">
                <span>Gando Developers</span><span>/</span><span>{currentPage.section}</span>
              </div>

              <div className="gando-docs-meta">
                <StatusBadge status={currentPage.status} />
                {currentPage.path ? <span className="font-mono text-[9px] text-muted-foreground">{currentPage.path}</span> : null}
              </div>

              <DocsTitle>{currentPage.title}</DocsTitle>
              {currentPage.description ? (
                <DocsDescription className="gando-docs-description">
                  {currentPage.description}
                </DocsDescription>
              ) : null}

              <DeveloperMdxPreview source={currentPage.body} title={currentPage.title} />

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

        {!editorActive ? (
          <aside className="gando-docs-toc">
            <div>
              <div className="gando-docs-toc-title">Sur cette page</div>
              <nav>
                {toc.length ? toc.map(item => (
                  <a key={item.id} href={`#${item.id}`} className="block" data-depth={item.depth}>
                    {item.title}
                  </a>
                )) : <div className="text-[10px] leading-5 text-muted-foreground">Ajoutez des titres H2/H3 pour générer automatiquement la table des matières.</div>}
              </nav>

              <div className="gando-docs-source">
                <div className="text-[12px] font-semibold text-[#878d9b]">Source</div>
                <div className="gando-docs-source-card">
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
        ) : null}
      </div>
    </div>
  );
}

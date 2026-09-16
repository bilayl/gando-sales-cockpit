"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Eye,
  FileCode2,
  FileText,
  Folder,
  MoreHorizontal,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DocStatus = "draft" | "published";

type DocPage = {
  id: string;
  title: string;
  slug: string;
  section: string;
  description: string;
  body: string;
  status: DocStatus;
  updatedAt: string;
  publishedAt?: string;
};

const STORAGE_KEY = "gando-developer-docs-editor-v1";

const DEFAULT_PAGES: DocPage[] = [
  {
    id: "welcome",
    title: "Accueil",
    slug: "accueil",
    section: "Premiers pas",
    description: "Point d’entrée de la documentation développeur Gando.",
    status: "published",
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    body: `# Documentation développeur Gando

Bienvenue dans l’espace de documentation technique Gando.

Utilisez cette page pour présenter rapidement l’intégration, les prérequis et les principaux parcours disponibles pour vos partenaires.

## Commencer

- Présenter le parcours d’intégration
- Documenter l’authentification
- Expliquer la création et le suivi d’une caution
- Ajouter les webhooks et les cas d’erreur

> Les contenus de cet éditeur peuvent être préparés en brouillon avant publication.`,
  },
  {
    id: "authentication",
    title: "Authentification",
    slug: "authentification",
    section: "Premiers pas",
    description: "Décrire la manière dont un partenaire s’authentifie auprès de l’API.",
    status: "draft",
    updatedAt: new Date().toISOString(),
    body: `# Authentification

Décrivez ici les prérequis d’authentification pour accéder à l’API Gando.

## Clés et environnements

Documentez les environnements disponibles et la manière de stocker les identifiants en sécurité.

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\``,
  },
  {
    id: "deposits",
    title: "Cautions",
    slug: "cautions",
    section: "Guides",
    description: "Documenter le cycle de vie d’une caution Gando.",
    status: "draft",
    updatedAt: new Date().toISOString(),
    body: `# Cautions

Cette page peut détailler le cycle de vie d’une caution : création, activation, suivi et demande d’encaissement.

## Exemple de parcours

1. Le partenaire crée une demande.
2. Le locataire complète le parcours sécurisé.
3. Le statut est suivi depuis l’intégration.
4. Le partenaire déclenche les actions prévues lorsque nécessaire.`,
  },
  {
    id: "webhooks",
    title: "Webhooks",
    slug: "webhooks",
    section: "Guides",
    description: "Centraliser les événements envoyés vers les intégrations partenaires.",
    status: "draft",
    updatedAt: new Date().toISOString(),
    body: `# Webhooks

Listez ici les événements utiles aux partenaires et le comportement attendu à la réception.

## Bonnes pratiques

- Vérifier la signature des événements
- Répondre rapidement au serveur
- Rendre le traitement idempotent
- Journaliser les erreurs de traitement`,
  },
  {
    id: "errors",
    title: "Erreurs",
    slug: "erreurs",
    section: "Référence",
    description: "Référence des erreurs et recommandations de traitement.",
    status: "draft",
    updatedAt: new Date().toISOString(),
    body: `# Erreurs

Utilisez cette page comme référence pour les erreurs retournées par l’intégration.

| Code | Signification | Action |
| --- | --- | --- |
| À définir | À documenter | À documenter |`,
  },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "à l’instant";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function inlineMarkdown(text: string): ReactNode[] {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return chunks.map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-[#f0f1f3] px-1.5 py-0.5 font-mono text-[0.9em] text-[#5d4fd7] dark:bg-muted">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    const link = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-[#6556e8] underline underline-offset-4">
          {link[1]}
        </a>
      );
    }
    return chunk;
  });
}

function MarkdownPreview({ source }: { source: string }) {
  const lines = source.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      nodes.push(
        <pre key={`code-${index}`} className="my-5 overflow-x-auto rounded-2xl border border-[#e9e9ef] bg-[#111217] p-4 text-[12px] leading-6 text-[#f7f7fa] dark:border-border">
          <code>{code.join("\n")}</code>
        </pre>,
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
        <ul key={`ul-${index}`} className="my-4 list-disc space-y-2 pl-5 text-[14px] leading-7 text-[#51545d] dark:text-muted-foreground">
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
        <ol key={`ol-${index}`} className="my-4 list-decimal space-y-2 pl-5 text-[14px] leading-7 text-[#51545d] dark:text-muted-foreground">
          {items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}
        </ol>,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(<h3 key={index} className="mb-2 mt-7 text-[18px] font-semibold tracking-[-0.02em]">{inlineMarkdown(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      nodes.push(<h2 key={index} className="mb-3 mt-9 text-[22px] font-semibold tracking-[-0.025em]">{inlineMarkdown(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      nodes.push(<h1 key={index} className="mb-4 mt-1 text-[32px] font-semibold leading-tight tracking-[-0.04em]">{inlineMarkdown(line.slice(2))}</h1>);
    } else if (line.startsWith("> ")) {
      nodes.push(
        <blockquote key={index} className="my-5 rounded-r-xl border-l-2 border-[#7061ef] bg-[#f7f6ff] px-4 py-3 text-[13px] leading-6 text-[#55506d] dark:bg-muted/40 dark:text-muted-foreground">
          {inlineMarkdown(line.slice(2))}
        </blockquote>,
      );
    } else if (/^\|.*\|$/.test(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      const rows = tableLines
        .filter(row => !/^\|\s*[-:]+/.test(row))
        .map(row => row.split("|").slice(1, -1).map(cell => cell.trim()));
      nodes.push(
        <div key={`table-${index}`} className="my-5 overflow-hidden rounded-xl border border-[#e8e8ee] dark:border-border">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={cn("grid gap-3 px-3 py-2.5 text-[12px]", rowIndex === 0 ? "bg-[#f6f6f8] font-semibold dark:bg-muted" : "border-t border-[#ededf1] dark:border-border")} style={{ gridTemplateColumns: `repeat(${Math.max(row.length, 1)}, minmax(0, 1fr))` }}>
              {row.map((cell, cellIndex) => <div key={cellIndex}>{inlineMarkdown(cell)}</div>)}
            </div>
          ))}
        </div>,
      );
      continue;
    } else if (line.trim()) {
      nodes.push(<p key={index} className="my-3 text-[14px] leading-7 text-[#51545d] dark:text-muted-foreground">{inlineMarkdown(line)}</p>);
    }

    index += 1;
  }

  return <>{nodes}</>;
}

function StatusBadge({ status }: { status: DocStatus }) {
  const published = status === "published";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
      published ? "bg-[#eaf7ef] text-[#33724a] dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[#f1f2f4] text-[#747780] dark:bg-muted dark:text-muted-foreground",
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", published ? "bg-[#4ea56a]" : "bg-[#9a9da5]")} />
      {published ? "Publié" : "Brouillon"}
    </span>
  );
}

export function DeveloperDocsEditor() {
  const [pages, setPages] = useState<DocPage[]>(DEFAULT_PAGES);
  const [selectedId, setSelectedId] = useState(DEFAULT_PAGES[0].id);
  const [search, setSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(true);
  const [previewOnMobile, setPreviewOnMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { pages?: DocPage[]; selectedId?: string };
        if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          setPages(parsed.pages);
          if (parsed.selectedId && parsed.pages.some(page => page.id === parsed.selectedId)) {
            setSelectedId(parsed.selectedId);
          }
        }
      }
    } catch {
      // If local data is invalid, keep the starter documentation.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaved(false);
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages, selectedId }));
      setSaved(true);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [pages, selectedId, hydrated]);

  const currentPage = pages.find(page => page.id === selectedId) ?? pages[0];

  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? pages.filter(page => `${page.title} ${page.slug} ${page.section}`.toLowerCase().includes(query))
      : pages;

    return Array.from(new Set(filtered.map(page => page.section))).map(section => ({
      section,
      pages: filtered.filter(page => page.section === section),
    }));
  }, [pages, search]);

  function updateCurrent(patch: Partial<DocPage>) {
    setPages(items => items.map(page => page.id === currentPage.id
      ? { ...page, ...patch, updatedAt: new Date().toISOString() }
      : page));
  }

  function createPage() {
    const id = `doc-${Date.now()}`;
    const page: DocPage = {
      id,
      title: "Nouvelle page",
      slug: `nouvelle-page-${pages.length + 1}`,
      section: "Brouillons",
      description: "",
      body: "# Nouvelle page\n\nCommencez à rédiger votre documentation ici.",
      status: "draft",
      updatedAt: new Date().toISOString(),
    };
    setPages(items => [...items, page]);
    setSelectedId(id);
    setPreviewOnMobile(false);
  }

  function publishPage() {
    updateCurrent({
      status: "published",
      publishedAt: new Date().toISOString(),
    });
  }

  function insertMarkdown(before: string, after = before, placeholder = "texte") {
    const textarea = textareaRef.current;
    if (!textarea) return;
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

  if (!currentPage) return null;

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-[#fcfcfd] text-[#17181c] dark:bg-background dark:text-foreground">
      <header className="flex h-[58px] shrink-0 items-center justify-between gap-3 border-b border-[#e9eaed] bg-white px-4 dark:border-border dark:bg-background md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#7061ef] text-white shadow-sm">
            <Code2 className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-[-0.02em]">Portail développeur</div>
            <div className="truncate text-[10px] text-[#858891] dark:text-muted-foreground">Documentation Gando</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 text-[10px] text-[#8a8d95] dark:text-muted-foreground sm:flex">
            {saved ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8d82ef]" />}
            {saved ? "Enregistré" : "Enregistrement…"}
          </div>
          <button
            type="button"
            onClick={() => setPreviewOnMobile(value => !value)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e4e5e9] bg-white px-2.5 text-[11px] font-medium text-[#555861] transition hover:bg-[#f7f7f9] dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted xl:hidden"
          >
            <Eye className="h-3.5 w-3.5" />
            {previewOnMobile ? "Éditer" : "Aperçu"}
          </button>
          <button
            type="button"
            onClick={publishPage}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#17181c] px-3 text-[11px] font-semibold text-white transition hover:bg-[#2b2d33] dark:bg-white dark:text-black"
          >
            <Send className="h-3.5 w-3.5" />
            Publier
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[224px_minmax(0,1fr)_minmax(340px,0.82fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-[#ececf0] bg-[#f8f8fa] dark:border-border dark:bg-muted/20 md:flex">
          <div className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9699a1]" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher"
                className="h-8 w-full rounded-lg border border-[#e2e3e7] bg-white pl-8 pr-2 text-[11px] outline-none transition placeholder:text-[#a6a8af] focus:border-[#b6b0ee] focus:ring-2 focus:ring-[#7061ef]/10 dark:border-border dark:bg-background"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-[10px] font-medium text-[#7f828a]">Navigation</span>
              <button type="button" className="rounded p-1 text-[#9699a1] hover:bg-[#ededf1] dark:hover:bg-muted" aria-label="Options de navigation">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {sections.map(({ section, pages: sectionPages }) => (
                <div key={section}>
                  <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-medium text-[#888b93]">
                    <ChevronDown className="h-3 w-3" />
                    <Folder className="h-3 w-3" />
                    <span className="truncate">{section}</span>
                  </div>
                  <div className="space-y-0.5">
                    {sectionPages.map(page => {
                      const active = page.id === currentPage.id;
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(page.id);
                            setPreviewOnMobile(false);
                          }}
                          className={cn(
                            "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[11px] transition",
                            active
                              ? "bg-[#e9e9ee] font-medium text-[#25262b] dark:bg-muted dark:text-foreground"
                              : "text-[#676a72] hover:bg-[#efeff2] hover:text-[#25262b] dark:text-muted-foreground dark:hover:bg-muted",
                          )}
                        >
                          {page.slug === "accueil" ? <BookOpen className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                          <span className="min-w-0 flex-1 truncate">{page.title}</span>
                          {page.status === "published" && <span className="h-1.5 w-1.5 rounded-full bg-[#4ea56a]" title="Publié" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#e6e7ea] p-2.5 dark:border-border">
            <button
              type="button"
              onClick={createPage}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#dedfe4] bg-white text-[11px] font-medium transition hover:bg-[#f4f4f6] dark:border-border dark:bg-background dark:hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle page
            </button>
          </div>
        </aside>

        <main className={cn("min-h-0 flex-col bg-white dark:bg-background", previewOnMobile ? "hidden xl:flex" : "flex")}>
          <div className="shrink-0 border-b border-[#ececf0] px-5 py-4 dark:border-border lg:px-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode2 className="h-4 w-4 shrink-0 text-[#777b84]" />
                <span className="truncate text-[11px] text-[#858891]">/{currentPage.slug || "sans-slug"}</span>
              </div>
              <StatusBadge status={currentPage.status} />
            </div>

            <input
              value={currentPage.title}
              onChange={event => {
                const title = event.target.value;
                const oldAutoSlug = slugify(currentPage.title);
                updateCurrent({
                  title,
                  slug: !currentPage.slug || currentPage.slug === oldAutoSlug ? slugify(title) : currentPage.slug,
                });
              }}
              className="w-full bg-transparent text-[25px] font-semibold tracking-[-0.035em] outline-none placeholder:text-[#bbbcc2]"
              placeholder="Titre de la page"
            />
            <input
              value={currentPage.description}
              onChange={event => updateCurrent({ description: event.target.value })}
              className="mt-1.5 w-full bg-transparent text-[12px] leading-5 text-[#777a83] outline-none placeholder:text-[#b1b3ba] dark:text-muted-foreground"
              placeholder="Ajoutez une courte description…"
            />

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex h-8 items-center rounded-lg border border-[#e5e5e9] bg-[#fafafd] px-2.5 text-[10px] text-[#81848d] dark:border-border dark:bg-muted/30">
                <span className="mr-2 shrink-0">Slug</span>
                <input
                  value={currentPage.slug}
                  onChange={event => updateCurrent({ slug: slugify(event.target.value) })}
                  className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-[#4f525a] outline-none dark:text-foreground"
                />
              </label>
              <label className="flex h-8 items-center rounded-lg border border-[#e5e5e9] bg-[#fafafd] px-2.5 text-[10px] text-[#81848d] dark:border-border dark:bg-muted/30">
                <span className="mr-2 shrink-0">Section</span>
                <input
                  value={currentPage.section}
                  onChange={event => updateCurrent({ section: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-[#4f525a] outline-none dark:text-foreground"
                />
              </label>
            </div>
          </div>

          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[#ececf0] px-4 dark:border-border lg:px-6">
            <button type="button" onClick={() => insertMarkdown("# ", "", "Titre")} className="rounded px-2 py-1 text-[10px] font-semibold text-[#676a72] hover:bg-[#f1f1f4] dark:hover:bg-muted">H1</button>
            <button type="button" onClick={() => insertMarkdown("## ", "", "Sous-titre")} className="rounded px-2 py-1 text-[10px] font-semibold text-[#676a72] hover:bg-[#f1f1f4] dark:hover:bg-muted">H2</button>
            <div className="mx-1 h-4 w-px bg-[#e2e3e7] dark:bg-border" />
            <button type="button" onClick={() => insertMarkdown("**", "**", "gras")} className="rounded px-2 py-1 text-[11px] font-bold text-[#676a72] hover:bg-[#f1f1f4] dark:hover:bg-muted">B</button>
            <button type="button" onClick={() => insertMarkdown("`", "`", "code")} className="rounded px-2 py-1 font-mono text-[10px] text-[#676a72] hover:bg-[#f1f1f4] dark:hover:bg-muted">&lt;/&gt;</button>
            <button type="button" onClick={() => insertMarkdown("- ", "", "élément")} className="rounded px-2 py-1 text-[10px] text-[#676a72] hover:bg-[#f1f1f4] dark:hover:bg-muted">• Liste</button>
            <span className="ml-auto hidden text-[9px] text-[#a0a2a9] lg:inline">Markdown</span>
          </div>

          <textarea
            ref={textareaRef}
            value={currentPage.body}
            onChange={event => updateCurrent({ body: event.target.value })}
            spellCheck
            className="min-h-0 flex-1 resize-none bg-white px-5 py-5 font-mono text-[12px] leading-6 text-[#34363d] outline-none dark:bg-background dark:text-foreground lg:px-7"
            placeholder="Rédigez votre documentation…"
          />

          <div className="flex h-9 shrink-0 items-center justify-between border-t border-[#ececf0] px-5 text-[9px] text-[#9699a1] dark:border-border lg:px-7">
            <span>Dernière modification · {formatRelativeDate(currentPage.updatedAt)}</span>
            <span>{currentPage.body.length.toLocaleString("fr-FR")} caractères</span>
          </div>
        </main>

        <section className={cn(
          "min-h-0 flex-col border-l border-[#ececf0] bg-[#fafafd] dark:border-border dark:bg-muted/10 xl:flex",
          previewOnMobile ? "flex md:col-start-2" : "hidden",
        )}>
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#ececf0] px-4 dark:border-border">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#696c74] dark:text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Aperçu
            </div>
            <span className="text-[9px] text-[#a0a2a9]">docs.gando.app</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <article className="mx-auto min-h-[520px] w-full max-w-[720px] rounded-[18px] border border-[#e8e8ed] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(20,20,30,0.03)] dark:border-border dark:bg-background lg:px-8">
              <div className="mb-8 flex items-center gap-2 border-b border-[#efeff2] pb-4 text-[10px] text-[#8d9098] dark:border-border">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#7061ef] text-white">
                  <Code2 className="h-3.5 w-3.5" />
                </div>
                <span>Gando Developers</span>
                <span className="text-[#c1c2c7]">/</span>
                <span className="truncate">{currentPage.section}</span>
              </div>

              {currentPage.description && (
                <p className="mb-5 text-[13px] leading-6 text-[#777a83] dark:text-muted-foreground">{currentPage.description}</p>
              )}
              <MarkdownPreview source={currentPage.body} />
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

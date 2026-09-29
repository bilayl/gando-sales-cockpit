"use client";

import Link from "next/link";
import {
  Copy,
  FileInput,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  Home,
  Link2,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { GandoSidebarMark } from "@/components/cockpit-sidebar-shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type EditorPage = {
  id: string;
  path: string;
  title: string;
  section: string;
  slug: string;
  status: "draft" | "published";
};

export function DeveloperEditorSidebar({
  pages,
  categories,
  selectedId,
  workspaceLabel,
  sourceLabel,
  onSelectPage,
  onNewPage,
  onSettings,
  onAddCategory,
  onRenameCategory,
  onRenamePage,
  onDuplicatePage,
  onMovePage,
  onPageSettings,
  onDeletePage,
}: {
  pages: EditorPage[];
  categories: string[];
  selectedId: string;
  workspaceLabel: string;
  sourceLabel: string;
  onSelectPage: (id: string) => void;
  onNewPage: (section?: string) => void;
  onSettings: () => void;
  onAddCategory: () => void;
  onRenameCategory: (section: string) => void;
  onRenamePage: (page: EditorPage) => void;
  onDuplicatePage: (page: EditorPage) => void;
  onMovePage: (page: EditorPage, section: string) => void;
  onPageSettings: (page: EditorPage) => void;
  onDeletePage: (page: EditorPage) => void;
}) {
  const allSections = Array.from(new Set([
    ...categories,
    ...pages.map(page => page.section),
  ].filter(Boolean)));

  const sections = allSections.map(section => ({
    section,
    pages: pages
      .filter(page => page.section === section)
      .sort((a, b) => a.title.localeCompare(b.title, "fr")),
  }));

  const fileRoots = Array.from(new Set(
    pages
      .map(page => page.path.split("/").slice(0, -1).join("/"))
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  async function copyPageLink(page: EditorPage) {
    const url = `${window.location.origin}/developer?page=${encodeURIComponent(page.slug)}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  return (
    <aside className="mint-editor-sidebar">
      <div className="mint-editor-sidebar-top">
        <div className="mint-editor-workspace-row">
          <Link href="/" className="mint-editor-brand" title="Retour au Cockpit">
            <GandoSidebarMark />
            <span className="mint-editor-brand-name">gando</span>
          </Link>

          <div className="mint-editor-sidebar-icons">
            <button type="button" title="Rechercher">
              <Search className="size-4" />
            </button>
            <button type="button" title="Paramètres du site" onClick={onSettings}>
              <Settings2 className="size-4" />
            </button>
            <button type="button" title="Réduire la sidebar">
              <PanelLeftClose className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mint-editor-sidebar-scroll">
        <section className="mint-editor-sidebar-section">
          <div className="mint-editor-sidebar-heading-row">
            <div className="mint-editor-sidebar-heading">Navigation</div>
            <button type="button" className="mint-editor-add-category" onClick={onAddCategory} title="Ajouter une catégorie">
              <Plus className="size-3.5" />
              Catégorie
            </button>
          </div>

          <div className="mint-editor-navigation-tree">
            {sections.map(({ section, pages: sectionPages }, sectionIndex) => (
              <div key={section} className="mint-editor-tree-group">
                <div className="mint-editor-tree-parent">
                  <FolderOpen className="size-[17px]" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate">{section}</span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="mint-editor-row-menu" title="Options de la catégorie">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-48 rounded-xl p-1.5">
                      <DropdownMenuItem onSelect={() => onRenameCategory(section)} className="rounded-lg">
                        <Pencil className="size-4" />
                        Renommer la catégorie
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onNewPage(section)} className="rounded-lg">
                        <Plus className="size-4" />
                        Ajouter une page
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mint-editor-tree-children">
                  {sectionPages.map((page, pageIndex) => {
                    const active = page.id === selectedId;
                    return (
                      <div key={page.id} className={cn("mint-editor-tree-page-wrap", active && "is-active")}>
                        <button
                          type="button"
                          onClick={() => onSelectPage(page.id)}
                          className={cn("mint-editor-tree-page", active && "is-active")}
                        >
                          {sectionIndex === 0 && pageIndex === 0 ? (
                            <Home className="size-[17px]" strokeWidth={1.8} />
                          ) : (
                            <FileText className="size-[17px]" strokeWidth={1.8} />
                          )}
                          <span className="min-w-0 flex-1 truncate">{page.title}</span>
                          {page.status === "draft" ? <span className="mint-editor-draft-dot" title="Brouillon" /> : null}
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="mint-editor-page-menu" title="Options de la page">
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start" className="w-56 rounded-xl p-1.5">
                            <DropdownMenuItem onSelect={() => void copyPageLink(page)} className="rounded-lg">
                              <Link2 className="size-4" />
                              Copier le lien
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onPageSettings(page)} className="rounded-lg">
                              <Settings2 className="size-4" />
                              Paramètres de la page
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onRenamePage(page)} className="rounded-lg">
                              <Pencil className="size-4" />
                              Renommer
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDuplicatePage(page)} className="rounded-lg">
                              <Copy className="size-4" />
                              Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="rounded-lg">
                                <FileInput className="size-4" />
                                Déplacer vers…
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-52 rounded-xl p-1.5">
                                {allSections.filter(item => item !== page.section).map(item => (
                                  <DropdownMenuItem key={item} onSelect={() => onMovePage(page, item)} className="rounded-lg">
                                    <Folder className="size-4" />
                                    {item}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={onAddCategory} className="rounded-lg">
                                  <Plus className="size-4" />
                                  Nouvelle catégorie
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem onSelect={() => onMovePage(page, "Files")} className="rounded-lg">
                              <FolderInput className="size-4" />
                              Déplacer vers Files
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => onDeletePage(page)} className="rounded-lg text-red-600 focus:text-red-600">
                              <Trash2 className="size-4" />
                              Déplacer vers la corbeille
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                  {!sectionPages.length ? (
                    <button type="button" onClick={() => onNewPage(section)} className="mint-editor-empty-category">
                      <Plus className="size-3.5" /> Ajouter une page
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mint-editor-sidebar-section">
          <div className="mint-editor-sidebar-heading">Files</div>
          <div className="mint-editor-files">
            {fileRoots.length ? fileRoots.map(root => (
              <div key={root} className="mint-editor-file-row">
                <Folder className="size-[17px]" strokeWidth={1.8} />
                <span className="truncate">{root}</span>
              </div>
            )) : (
              <div className="mint-editor-file-row">
                <Folder className="size-[17px]" strokeWidth={1.8} />
                <span>{sourceLabel}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mint-editor-sidebar-footer">
        <div className="mint-editor-source-caption" title={sourceLabel}>
          {workspaceLabel}
        </div>
        <button type="button" className="mint-editor-settings-button" onClick={onSettings}>
          <Settings2 className="size-4" />
          Site settings
        </button>
        <button type="button" className="mint-editor-new-page-button" onClick={() => onNewPage()}>
          <Plus className="size-4" />
          New page
        </button>
      </div>
    </aside>
  );
}

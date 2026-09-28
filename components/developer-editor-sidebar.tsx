"use client";

import Link from "next/link";
import {
  ChevronsUpDown,
  FileText,
  Folder,
  FolderOpen,
  Globe2,
  Home,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { GandoSidebarMark } from "@/components/cockpit-sidebar-shared";
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
  selectedId,
  workspaceLabel,
  sourceLabel,
  onSelectPage,
  onNewPage,
  onSettings,
}: {
  pages: EditorPage[];
  selectedId: string;
  workspaceLabel: string;
  sourceLabel: string;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onSettings: () => void;
}) {
  const sections = Array.from(new Set(pages.map(page => page.section))).map(section => ({
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

  return (
    <aside className="mint-editor-sidebar">
      <div className="mint-editor-sidebar-top">
        <div className="mint-editor-workspace-row">
          <Link href="/" className="mint-editor-brand" title="Retour au Cockpit">
            <GandoSidebarMark />
            <span className="mint-editor-brand-name">gando</span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Link>

          <div className="mint-editor-sidebar-icons">
            <button type="button" title="Rechercher">
              <Search className="size-4" />
            </button>
            <button type="button" title="Paramètres" onClick={onSettings}>
              <Settings2 className="size-4" />
            </button>
            <button type="button" title="Réduire la sidebar">
              <PanelLeftClose className="size-4" />
            </button>
          </div>
        </div>

        <div className="mint-editor-view-switch">
          <button type="button" className="mint-editor-view-option">
            <Home className="size-4" />
            Workspace
          </button>
          <button type="button" className="mint-editor-view-option is-active">
            <Globe2 className="size-4" />
            Site
          </button>
        </div>
      </div>

      <div className="mint-editor-sidebar-scroll">
        <section className="mint-editor-sidebar-section">
          <div className="mint-editor-sidebar-heading">Navigation</div>

          <div className="mint-editor-navigation-tree">
            {sections.map(({ section, pages: sectionPages }, sectionIndex) => (
              <div key={section} className="mint-editor-tree-group">
                <div className="mint-editor-tree-parent">
                  <FolderOpen className="size-[17px]" strokeWidth={1.8} />
                  <span>{section}</span>
                </div>

                <div className="mint-editor-tree-children">
                  {sectionPages.map((page, pageIndex) => {
                    const active = page.id === selectedId;
                    return (
                      <button
                        key={page.id}
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
                    );
                  })}
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
        <button type="button" className="mint-editor-new-page-button" onClick={onNewPage}>
          <Plus className="size-4" />
          New page
        </button>
      </div>
    </aside>
  );
}

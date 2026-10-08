"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Eye, FileText, LayoutTemplate, Palette, Save, Settings2, Sparkles, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeveloperMdxPreview } from "@/components/developer-mdx-preview";

type DesignerEdit = { type: "h1" | "h2" | "h3" | "p" | "blockquote"; previousText: string; nextText: string };

function blocksFromMarkdown(source: string) {
  return source.replace(/\r\n/g, "\n").split("\n").map((line, index) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) return { id: "line-" + index, type: ("h" + match[1].length) as "h1" | "h2" | "h3", label: match[2].replace(/\*\*/g, "").replace(/`/g, "") };
    if (line.startsWith("> ")) return { id: "line-" + index, type: "blockquote" as const, label: line.slice(2) };
    if (line.trim() && !line.startsWith("```") && !line.startsWith("|") && !line.startsWith("- ")) return { id: "line-" + index, type: "p" as const, label: line.trim() };
    return null;
  }).filter(Boolean) as Array<{ id: string; type: "h1" | "h2" | "h3" | "p" | "blockquote"; label: string }>;
}

export function DeveloperVisualDesigner({ title, description, source, onChange, onSave, saving, dirty }: {
  title: string; description: string; source: string; onChange: (source: string) => void; onSave: () => void; saving: boolean; dirty: boolean;
}) {
  const [activePanel, setActivePanel] = useState<"content" | "style" | "settings">("content");
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const blocks = useMemo(() => blocksFromMarkdown(source), [source]);

  function applyEdit(edit: DesignerEdit) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const index = lines.findIndex(line => line.replace(/^#{1,3}\s+/, "").replace(/^>\s+/, "").trim() === edit.previousText.trim());
    if (index < 0) return;
    const prefix = edit.type === "h1" ? "# " : edit.type === "h2" ? "## " : edit.type === "h3" ? "### " : edit.type === "blockquote" ? "> " : "";
    lines[index] = prefix + edit.nextText;
    onChange(lines.join("\n"));
  }

  return (
    <div className="gando-designer-shell">
      <header className="gando-designer-toolbar">
        <div className="gando-designer-toolbar-title"><div className="gando-designer-icon"><LayoutTemplate className="size-4" /></div><div><div className="text-[12px] font-semibold">Designer</div><div className="text-[10px] text-muted-foreground">Vue publique · édition visuelle</div></div></div>
        <div className="gando-designer-toolbar-center"><span className="gando-designer-live"><span /> Public preview</span><span className="gando-designer-separator" /><span className="text-[10px] text-muted-foreground">Les changements restent en brouillon jusqu’à publication.</span></div>
        <button type="button" className="gando-designer-save" onClick={onSave} disabled={saving || !dirty}>{saving ? <Save className="size-3.5 animate-pulse" /> : <Check className="size-3.5" />}{dirty ? "Publier les changements" : "Publié"}</button>
      </header>

      <div className="gando-designer-layout">
        <aside className="gando-designer-inspector">
          <div className="gando-designer-tabs">
            <button type="button" data-active={activePanel === "content"} onClick={() => setActivePanel("content")}><Type className="size-3.5" /> Contenu</button>
            <button type="button" data-active={activePanel === "style"} onClick={() => setActivePanel("style")}><Palette className="size-3.5" /> Style</button>
            <button type="button" data-active={activePanel === "settings"} onClick={() => setActivePanel("settings")}><Settings2 className="size-3.5" /> Page</button>
          </div>

          {activePanel === "content" ? (
            <div className="gando-designer-panel">
              <div className="gando-designer-panel-heading"><span>Blocs</span><span>{blocks.length}</span></div>
              <div className="gando-designer-block-list">{blocks.map(block => <button key={block.id} type="button" className={cn("gando-designer-block", selectedBlock === block.id && "is-selected")} onClick={() => setSelectedBlock(block.id)}><span className="gando-designer-block-type">{block.type.toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-left">{block.label}</span><ChevronRight className="size-3 opacity-40" /></button>)}</div>
              {selectedBlock ? <div className="gando-designer-edit-card">{(() => { const block = blocks.find(item => item.id === selectedBlock); if (!block) return null; return <><div className="gando-designer-field-label">{block.type.toUpperCase()}</div><textarea defaultValue={block.label} key={block.id + block.label} onBlur={event => applyEdit({ type: block.type, previousText: block.label, nextText: event.target.value })} className="gando-designer-textarea" /><div className="text-[9px] leading-4 text-muted-foreground">Cliquez ailleurs pour appliquer. Le rendu public se met à jour immédiatement.</div></>; })()}</div> : <div className="gando-designer-empty"><Sparkles className="size-4" /><span>Sélectionnez un bloc pour l’éditer.</span></div>}
            </div>
          ) : activePanel === "style" ? (
            <div className="gando-designer-panel space-y-3"><div className="gando-designer-section-title">Système visuel</div>{[["Typographie", "Inter / système"], ["Rayon", "12 px"], ["Largeur contenu", "720 px"], ["Accent", "Gando violet"]].map(([label, value]) => <div key={label} className="gando-designer-setting-row"><span>{label}</span><strong>{value}</strong></div>)}<div className="rounded-xl border border-dashed border-border p-3 text-[10px] leading-5 text-muted-foreground">Les tokens de marque et composants publics sont centralisés ici pour éviter les variations page par page.</div></div>
          ) : (
            <div className="gando-designer-panel space-y-4"><div><div className="gando-designer-section-title">Page</div><div className="mt-2 rounded-xl border border-border p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Titre</div><div className="mt-1 text-[12px] font-semibold">{title}</div><div className="mt-3 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Description</div><div className="mt-1 text-[10px] leading-4 text-muted-foreground">{description || "Aucune description"}</div></div></div><div className="gando-designer-setting-row"><span>Statut</span><strong>{dirty ? "Brouillon" : "Synchronisé"}</strong></div><div className="gando-designer-setting-row"><span>Source</span><strong>GitHub / MDX</strong></div><div className="gando-designer-setting-row"><span>Publication</span><strong>Manuelle</strong></div></div>
          )}
        </aside>

        <main className="gando-designer-preview">
          <div className="gando-designer-browser">
            <div className="gando-designer-browser-bar"><div className="gando-designer-dots"><span /><span /><span /></div><div className="gando-designer-url">docs.gando.app / {title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</div><Eye className="size-3.5 text-muted-foreground" /></div>
            <div className="gando-designer-public-page">
              <div className="gando-designer-public-header"><div className="flex items-center gap-2 text-[10px] font-semibold"><FileText className="size-3.5" /> Gando Developers</div><div className="text-[9px] text-muted-foreground">API · Guides · Changelog</div></div>
              <div className="gando-designer-public-body"><DeveloperMdxPreview source={source} title={title} designer onDesignerEdit={edit => { setSelectedBlock(null); applyEdit(edit); }} /></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
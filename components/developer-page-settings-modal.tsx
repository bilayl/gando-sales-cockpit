"use client";

import { X } from "lucide-react";

type PageSettingsPage = {
  id: string;
  title: string;
  slug: string;
  section: string;
  description: string;
  order: number;
};

export function DeveloperPageSettingsModal({
  page,
  open,
  onClose,
  onChange,
}: {
  page: PageSettingsPage | null;
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<PageSettingsPage>) => void;
}) {
  if (!open || !page) return null;

  return (
    <div className="developer-page-settings-backdrop">
      <div className="developer-page-settings-dialog">
        <div className="developer-page-settings-header">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">Page settings</div>
            <div className="mt-1 text-lg font-semibold tracking-[-0.03em]">{page.title}</div>
          </div>
          <button type="button" onClick={onClose} className="developer-page-settings-close">
            <X className="size-4" />
          </button>
        </div>

        <div className="developer-page-settings-body">
          <label>
            <span>Titre</span>
            <input value={page.title} onChange={event => onChange({ title: event.target.value })} />
          </label>
          <label>
            <span>Slug</span>
            <input value={page.slug} onChange={event => onChange({ slug: event.target.value })} />
          </label>
          <label>
            <span>Catégorie</span>
            <input value={page.section} onChange={event => onChange({ section: event.target.value })} />
          </label>
          <label>
            <span>Description</span>
            <textarea value={page.description} onChange={event => onChange({ description: event.target.value })} rows={4} />
          </label>
          <label>
            <span>Ordre</span>
            <input type="number" min={0} value={page.order} onChange={event => onChange({ order: Number(event.target.value) || 0 })} />
          </label>
        </div>

        <div className="developer-page-settings-footer">
          <span>Les modifications seront enregistrées avec la page.</span>
          <button type="button" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

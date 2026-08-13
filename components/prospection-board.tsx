"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleDot, Loader2, Pencil, Phone, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, initials } from "@/lib/utils";

type Contact = { id: string; properties: Record<string, string | null | undefined> };

type Props = {
  contacts: Contact[];
  segmentId: string;
  loading?: boolean;
  onOpenContact: (id: string) => void;
  onStatusChange: (contactId: string, status: string) => void;
  onError: (message: string) => void;
};

const DEFAULT_COLUMNS = ["À prospecter", "En prospection", "Conversation", "RDV booké", "À recycler", "Non qualifié", "Perdu"];
const KEY_PREFIX = "gando.board.columns.";
const OTHER_COLUMN = "Autres";
const COLORS = ["bg-slate-400", "bg-amber-400", "bg-sky-400", "bg-emerald-400", "bg-orange-400", "bg-rose-400", "bg-violet-400", "bg-teal-400", "bg-indigo-400", "bg-pink-400"];

function loadColumns(segmentId: string): string[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + (segmentId || "all"));
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : parsed?.columns;
      if (Array.isArray(arr)) {
        const cols = arr.filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0).map(s => s.trim());
        if (cols.length) return cols;
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_COLUMNS];
}

export function ProspectionBoard({ contacts, segmentId, loading, onOpenContact, onStatusChange, onError }: Props) {
  const [columns, setColumns] = useState<string[]>(() => loadColumns(segmentId));
  const [adding, setAdding] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setColumns(loadColumns(segmentId));
    setAdding(false);
    setEditing(null);
    setNewCol("");
  }, [segmentId]);

  useEffect(() => {
    try { localStorage.setItem(KEY_PREFIX + (segmentId || "all"), JSON.stringify(columns)); } catch { /* ignore */ }
  }, [columns, segmentId]);

  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const col of columns) map.set(col, []);
    const rest: Contact[] = [];
    for (const c of contacts) {
      const status = c.properties.statut_prospection?.trim() || "";
      if (map.has(status)) map.get(status)!.push(c);
      else rest.push(c);
    }
    return { map, rest };
  }, [contacts, columns]);

  function commitAdd() {
    const label = newCol.trim();
    if (!label) return;
    setColumns(prev => (prev.some(c => c.toLowerCase() === label.toLowerCase()) ? prev : [...prev, label]));
    setNewCol("");
    setAdding(false);
  }

  function commitRename() {
    if (!editing) return;
    const label = editing.value.trim();
    if (!label || label.toLowerCase() === columns[editing.index].toLowerCase()) { setEditing(null); return; }
    setColumns(prev => prev.map((c, i) => (i === editing.index ? label : c)));
    setEditing(null);
  }

  function removeColumn(index: number) {
    setColumns(prev => prev.filter((_, i) => i !== index));
    if (editing?.index === index) setEditing(null);
  }

  async function move(contact: Contact, column: string) {
    setSaving(true);
    const value = column === OTHER_COLUMN ? "" : column;
    try {
      const r = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { statut_prospection: value } }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "HubSpot a rejeté ce statut");
      }
      onStatusChange(contact.id, value);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Impossible de déplacer le contact");
    } finally {
      setSaving(false);
      setDragId(null);
      setDragOver(null);
    }
  }

  function renderColumn(col: string, cards: Contact[], index?: number, other = false) {
    const isEditing = editing?.index === index && !other;
    const isOver = dragOver === col;
    return (
      <div key={other ? OTHER_COLUMN : col} onDragOver={e => { if (dragId) { e.preventDefault(); setDragOver(col); } }} onDragLeave={() => setDragOver(prev => (prev === col ? null : prev))} onDrop={e => { e.preventDefault(); const c = contacts.find(x => x.id === dragId); if (c) move(c, col); }}
        className={`flex w-64 shrink-0 flex-col rounded-xl border ${isOver ? "border-violet-400/60 bg-violet-400/[0.06] shadow-glow" : "border-border bg-muted/30"} max-h-full`}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          {!other ? <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[(index ?? 0) % COLORS.length]}`} /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-500" />}
          {isEditing
            ? <>
                <Input autoFocus value={editing?.value ?? ""} onChange={e => setEditing({ index: editing!.index, value: e.target.value })} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(null); }} className="h-7 px-2 text-sm" />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commitRename}><Check size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(null)}><X size={14} /></Button>
              </>
            : <>
                <span className="truncate text-sm font-semibold">{col}</span>
                <Badge variant="secondary" className="ml-auto px-1.5 text-[10px]">{cards.length}</Badge>
                {!other ? <>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setEditing({ index: index!, value: col })}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeColumn(index!)}><Trash2 size={13} /></Button>
                </> : null}
              </>}
        </div>
        <div className="max-h-[calc(100vh-300px)] min-h-[140px] flex-1 space-y-2 overflow-y-auto px-3 pb-3 minari-scrollbar">
          {cards.map(c => {
            const p = c.properties;
            const full = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Sans nom";
            return (
              <div key={c.id} draggable onDragStart={e => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragId(null)}
                className={`cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-violet-400/30 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] active:cursor-grabbing ${dragId === c.id ? "opacity-50" : ""} ${saving && dragId === c.id ? "opacity-40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpenContact(c.id)} className="inline-flex min-w-0 items-center gap-1.5 text-left text-sm font-medium text-violet-300 hover:underline">
                    <Avatar className="h-5 w-5 shrink-0 bg-accent"><AvatarFallback className="bg-accent text-[8px] font-bold text-violet-300">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                    <span className="truncate">{full}</span>
                  </button>
                </div>
                <div className="mt-1.5 truncate text-xs text-muted-foreground">{p.jobtitle || "—"}</div>
                <div className="mt-0.5 truncate text-xs font-semibold">{p.company || "—"}</div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <a href={p.phone ? `tel:${p.phone}` : "#"} className="inline-flex items-center gap-1 rounded-md bg-violet-400/5 px-1.5 py-0.5 font-mono text-[11px] text-violet-200/90 hover:text-violet-100"><Phone size={11} />{p.phone || p.mobilephone || "—"}</a>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDate(p.hs_last_sales_activity_timestamp)}</span>
                </div>
              </div>
            );
          })}
          {!cards.length ? <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Aucun contact</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
      {loading ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-violet-300" /></div>
        : <div className="flex h-full items-start gap-3 overflow-x-auto p-4">
            {columns.map((col, i) => renderColumn(col, groups.map.get(col) || [], i))}
            {groups.rest.length ? renderColumn(OTHER_COLUMN, groups.rest) : null}
            <div className="flex w-64 shrink-0 flex-col">
              {adding ? (
                <div className="rounded-xl border border-border bg-muted/40 p-2">
                  <Input autoFocus ref={addInput} value={newCol} onChange={e => setNewCol(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }} placeholder="Nom de la colonne" className="h-8 px-2 text-sm" />
                  <div className="mt-2 flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 flex-1" onClick={commitAdd} disabled={!newCol.trim()}><Check size={13} /> Ajouter</Button>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => { setAdding(false); setNewCol(""); }}><X size={13} /></Button>
                  </div>
                </div>
              ) : <Button variant="outline" size="sm" className="h-9 justify-start gap-2 border-dashed text-muted-foreground hover:text-violet-200" onClick={() => setAdding(true)}><Plus size={15} /> Ajouter une colonne</Button>}
            </div>
          </div>}
    </div>
  );
}

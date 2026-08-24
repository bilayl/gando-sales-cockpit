"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Eye,
  EyeOff,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PROSPECTION_SEGMENT_PREFS_EVENT,
  readProspectionSegmentPreferences,
  writeProspectionSegmentPreferences,
  type ProspectionSegmentPreferences,
} from "@/lib/prospection-segment-preferences";

type SegmentObjectType = "0-1" | "0-2";

type Segment = {
  listId: string;
  name: string;
  objectTypeId: SegmentObjectType;
  processingType?: string;
  size?: number;
};

function orderedIds(
  segments: Segment[],
  preferences: ProspectionSegmentPreferences,
  objectTypeId: SegmentObjectType,
) {
  return segments
    .filter(segment => segment.objectTypeId === objectTypeId)
    .map((segment, sourceIndex) => ({
      id: segment.listId,
      order: preferences[segment.listId]?.order ?? 10_000 + sourceIndex,
    }))
    .sort((a, b) => a.order - b.order)
    .map(item => item.id);
}

export function SegmentsView() {
  const [lists, setLists] = useState<Segment[]>([]);
  const [preferences, setPreferences] = useState<ProspectionSegmentPreferences>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<SegmentObjectType>("0-2");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/segments", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger les segments");
      setLists((data.lists || []).filter((segment: Segment) => segment.objectTypeId === "0-1" || segment.objectTypeId === "0-2"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPreferences(readProspectionSegmentPreferences());
    void load();
    const refreshPreferences = () => setPreferences(readProspectionSegmentPreferences());
    window.addEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
    window.addEventListener("storage", refreshPreferences);
    return () => {
      window.removeEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
      window.removeEventListener("storage", refreshPreferences);
    };
  }, [load]);

  const filteredLists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return lists;
    return lists.filter(segment => segment.name.toLowerCase().includes(normalized));
  }, [lists, query]);

  const orderedIdsByType = useMemo<Record<SegmentObjectType, string[]>>(() => ({
    "0-1": orderedIds(lists, preferences, "0-1"),
    "0-2": orderedIds(lists, preferences, "0-2"),
  }), [lists, preferences]);

  function savePreferences(next: ProspectionSegmentPreferences) {
    setPreferences(next);
    writeProspectionSegmentPreferences(next);
  }

  function toggleProspection(segment: Segment) {
    const visible = preferences[segment.listId]?.visible !== false;
    savePreferences({
      ...preferences,
      [segment.listId]: { ...preferences[segment.listId], visible: !visible },
    });
    toast.success(!visible
      ? `« ${segment.name} » est visible dans Prospection.`
      : `« ${segment.name} » est masqué dans Prospection.`);
  }

  function moveSegment(segment: Segment, direction: -1 | 1) {
    const ids = orderedIdsByType[segment.objectTypeId];
    const index = ids.indexOf(segment.listId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ids.length) return;

    const reordered = [...ids];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const next = { ...preferences };
    reordered.forEach((id, order) => {
      next[id] = { ...next[id], order };
    });
    savePreferences(next);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, objectTypeId: type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de créer le segment");
      setName("");
      setNotice("Le segment a été créé dans HubSpot.");
      await load();
      toast.success(`Segment « ${data.name || name} » créé dans HubSpot.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erreur lors de la création";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function rename(segment: Segment) {
    const nextName = editingName.trim();
    if (!nextName || nextName === segment.name) {
      setEditingId("");
      setEditingName("");
      return;
    }
    setRenamingId(segment.listId);
    setError("");
    try {
      const response = await fetch(`/api/segments/${encodeURIComponent(segment.listId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de renommer le segment");
      setLists(current => current.map(item => item.listId === segment.listId
        ? { ...item, name: data.name || nextName }
        : item));
      setEditingId("");
      setEditingName("");
      toast.success(`Segment renommé « ${data.name || nextName} » dans HubSpot.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erreur lors du renommage";
      setError(message);
      toast.error(message);
    } finally {
      setRenamingId("");
    }
  }

  async function remove() {
    const segment = segmentToDelete;
    if (!segment) return;
    setDeletingId(segment.listId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/segments/${encodeURIComponent(segment.listId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de supprimer le segment");
      setLists(current => current.filter(item => item.listId !== segment.listId));
      if (preferences[segment.listId]) {
        const next = { ...preferences };
        delete next[segment.listId];
        savePreferences(next);
      }
      setNotice(`Le segment « ${segment.name} » a été supprimé de HubSpot.`);
      setSegmentToDelete(null);
      toast.success(`Segment « ${segment.name} » supprimé de HubSpot.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erreur lors de la suppression";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId("");
    }
  }

  const contactSegments = lists.filter(segment => segment.objectTypeId === "0-1");
  const companySegments = lists.filter(segment => segment.objectTypeId === "0-2");
  const visibleContactCount = contactSegments.filter(segment => preferences[segment.listId]?.visible !== false).length;
  const visibleCompanyCount = companySegments.filter(segment => preferences[segment.listId]?.visible !== false).length;

  return (
    <div className="page-shell min-h-screen minari-scrollbar">
      <div className="page-content space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary"><ListFilter size={14} /> Prospection / Segments</div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">Segments HubSpot</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choisissez les segments Contacts et Entreprises visibles dans Prospection, changez leur ordre et renommez-les directement dans HubSpot.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualiser</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-4"><div className="text-xs font-medium text-muted-foreground">Tous les segments</div><div className="mt-1 text-2xl font-bold">{lists.length}</div></Card>
          <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users size={14} /> Contacts</div><div className="mt-1 text-2xl font-bold">{contactSegments.length}</div><div className="mt-1 text-[11px] text-muted-foreground">{visibleContactCount} visibles</div></Card>
          <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Building2 size={14} /> Entreprises</div><div className="mt-1 text-2xl font-bold">{companySegments.length}</div><div className="mt-1 text-[11px] text-muted-foreground">{visibleCompanyCount} visibles</div></Card>
          <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Eye size={14} /> Dans Prospection</div><div className="mt-1 text-2xl font-bold">{visibleContactCount + visibleCompanyCount}</div><div className="mt-1 text-[11px] text-muted-foreground">Contacts + entreprises</div></Card>
        </div>

        <Card id="nouveau-segment">
          <CardHeader>
            <CardTitle className="text-base">Nouveau segment</CardTitle>
            <CardDescription>La liste sera créée directement dans HubSpot. Les segments Contacts et Entreprises sont visibles par défaut dans Prospection.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 md:grid-cols-[1fr_200px_auto]">
              <div className="space-y-1.5"><Label htmlFor="segment-name" className="text-xs text-muted-foreground">Nom</Label><Input id="segment-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Prospects Fleetee" /></div>
              <div className="space-y-1.5"><Label htmlFor="segment-type" className="text-xs text-muted-foreground">Type</Label><Select value={type} onValueChange={value => setType(value as SegmentObjectType)}><SelectTrigger id="segment-type" className="w-full"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="0-2">Entreprises</SelectItem><SelectItem value="0-1">Contacts</SelectItem></SelectContent></Select></div>
              <div className="flex items-end"><Button type="submit" disabled={saving || !name.trim()} className="h-9">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}{saving ? "Création…" : "Créer le segment"}</Button></div>
            </form>
          </CardContent>
        </Card>

        {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">{notice}</div> : null}

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div><h2 className="font-semibold">Segments disponibles</h2><p className="text-xs text-muted-foreground">Visible / Masqué et l’ordre s’appliquent immédiatement aux vues Prospection correspondantes.</p></div>
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un segment" className="h-9 w-64 pl-9" /></div>
          </div>
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Nom</TableHead><TableHead>Objet</TableHead><TableHead>Prospection</TableHead><TableHead>Ordre</TableHead><TableHead className="text-right">Taille</TableHead><TableHead className="w-24 text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow> : filteredLists.map(segment => {
                const isCompany = segment.objectTypeId === "0-2";
                const visible = preferences[segment.listId]?.visible !== false;
                const ids = orderedIdsByType[segment.objectTypeId];
                const orderIndex = ids.indexOf(segment.listId);
                const editing = editingId === segment.listId;
                return (
                  <TableRow key={segment.listId}>
                    <TableCell>
                      {editing ? (
                        <div className="flex max-w-sm items-center gap-2">
                          <Input autoFocus value={editingName} onChange={event => setEditingName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void rename(segment); } if (event.key === "Escape") { setEditingId(""); setEditingName(""); } }} className="h-8" />
                          <Button size="sm" className="h-8" disabled={renamingId === segment.listId} onClick={() => void rename(segment)}>{renamingId === segment.listId ? <Loader2 size={13} className="animate-spin" /> : "OK"}</Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(""); setEditingName(""); }}><X size={14} /></Button>
                        </div>
                      ) : (
                        <button className="group flex items-center gap-2 text-left font-semibold hover:text-primary" onClick={() => { setEditingId(segment.listId); setEditingName(segment.name); }} title="Renommer dans HubSpot"><ListFilter size={15} className="text-primary" /><span>{segment.name}</span><Pencil size={12} className="opacity-0 transition-opacity group-hover:opacity-100" /></button>
                      )}
                    </TableCell>
                    <TableCell><span className="flex items-center gap-2 text-muted-foreground">{isCompany ? <Building2 size={14} /> : <Users size={14} />} {isCompany ? "Entreprises" : "Contacts"}</span></TableCell>
                    <TableCell><Button variant={visible ? "secondary" : "outline"} size="sm" className="h-8 gap-1.5" onClick={() => toggleProspection(segment)}>{visible ? <Eye size={13} /> : <EyeOff size={13} />}{visible ? "Visible" : "Masqué"}</Button></TableCell>
                    <TableCell><div className="flex items-center gap-1"><Badge variant="outline">#{orderIndex + 1}</Badge><Button variant="ghost" size="icon" className="h-7 w-7" disabled={orderIndex <= 0} onClick={() => moveSegment(segment, -1)}><ArrowUp size={13} /></Button><Button variant="ghost" size="icon" className="h-7 w-7" disabled={orderIndex < 0 || orderIndex >= ids.length - 1} onClick={() => moveSegment(segment, 1)}><ArrowDown size={13} /></Button></div></TableCell>
                    <TableCell className="text-right font-semibold">{segment.size ?? "—"}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Supprimer ${segment.name}`} onClick={() => setSegmentToDelete(segment)}><Trash2 size={15} /></Button></TableCell>
                  </TableRow>
                );
              })}
              {!loading && filteredLists.length === 0 ? <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="h-40 text-center text-muted-foreground">{query ? "Aucun segment ne correspond à cette recherche." : "Aucun segment HubSpot disponible."}</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={Boolean(segmentToDelete)} onOpenChange={open => !open && !deletingId && setSegmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce segment ?</AlertDialogTitle>
            <AlertDialogDescription>Le segment « {segmentToDelete?.name} » sera supprimé de HubSpot. Les contacts et entreprises qu’il contient ne seront pas supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={Boolean(deletingId)} className={buttonVariants({ variant: "destructive" })} onClick={event => { event.preventDefault(); void remove(); }}>
              {deletingId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}{deletingId ? "Suppression…" : "Supprimer de HubSpot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

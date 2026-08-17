"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ListFilter, Loader2, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react";
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

type Segment = {
  listId: string;
  name: string;
  objectTypeId: string;
  processingType?: string;
  size?: number;
};

export function SegmentsView() {
  const [lists, setLists] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("0-1");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/segments");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger les segments");
      setLists(data.lists || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return lists;
    return lists.filter(segment => segment.name.toLowerCase().includes(normalized));
  }, [lists, query]);

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!segmentToDelete) return;
    setDeletingId(segmentToDelete.listId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/segments/${encodeURIComponent(segmentToDelete.listId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de supprimer le segment");
      setLists(current => current.filter(segment => segment.listId !== segmentToDelete.listId));
      setNotice(`Le segment « ${segmentToDelete.name} » a été supprimé de HubSpot.`);
      setSegmentToDelete(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors de la suppression");
    } finally {
      setDeletingId("");
    }
  }

  const contactCount = lists.filter(segment => segment.objectTypeId === "0-1").length;
  const companyCount = lists.filter(segment => segment.objectTypeId === "0-2").length;

  return (
    <div className="page-shell min-h-screen minari-scrollbar">
      <div className="page-content space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
              <ListFilter size={14} /> Prospection / Segments
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">Segments HubSpot</h1>
            <p className="mt-1 text-sm text-muted-foreground">Créez et organisez ici les listes utilisées dans Prospection.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualiser
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><div className="text-xs font-medium text-muted-foreground">Tous les segments</div><div className="mt-1 text-2xl font-bold">{lists.length}</div></Card>
          <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users size={14} /> Contacts</div><div className="mt-1 text-2xl font-bold">{contactCount}</div></Card>
          <Card className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Building2 size={14} /> Entreprises</div><div className="mt-1 text-2xl font-bold">{companyCount}</div></Card>
        </div>

        <Card id="nouveau-segment">
          <CardHeader>
            <CardTitle className="text-base">Nouveau segment</CardTitle>
            <CardDescription>La liste sera créée directement dans votre compte HubSpot.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 md:grid-cols-[1fr_200px_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="segment-name" className="text-xs text-muted-foreground">Nom</Label>
                <Input id="segment-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Prospects Fleetee" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="segment-type" className="text-xs text-muted-foreground">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="segment-type" className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1">Contacts</SelectItem>
                    <SelectItem value="0-2">Entreprises</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving || !name.trim()} className="h-9">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {saving ? "Création…" : "Créer le segment"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">{notice}</div> : null}

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Segments disponibles</h2>
              <p className="text-xs text-muted-foreground">{lists.length} segment{lists.length > 1 ? "s" : ""} synchronisé{lists.length > 1 ? "s" : ""}</p>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un segment" className="h-9 w-64 pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Taille</TableHead>
                <TableHead className="w-20 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow>
              ) : filteredLists.map(segment => (
                <TableRow key={segment.listId}>
                  <TableCell><span className="flex items-center gap-2 font-semibold"><ListFilter size={15} className="text-primary" />{segment.name}</span></TableCell>
                  <TableCell><span className="flex items-center gap-2 text-muted-foreground">{segment.objectTypeId === "0-1" ? <Users size={14} /> : <Building2 size={14} />} {segment.objectTypeId === "0-1" ? "Contacts" : "Entreprises"}</span></TableCell>
                  <TableCell><Badge variant="outline">{segment.processingType || "—"}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{segment.size ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Supprimer ${segment.name}`} onClick={() => setSegmentToDelete(segment)}>
                      <Trash2 size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredLists.length === 0 ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="h-40 text-center text-muted-foreground">{query ? "Aucun segment ne correspond à cette recherche." : "Aucun segment HubSpot disponible."}</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={Boolean(segmentToDelete)} onOpenChange={open => !open && !deletingId && setSegmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce segment ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le segment « {segmentToDelete?.name} » sera supprimé de HubSpot. Les contacts et entreprises qu’il contient ne seront pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingId)}
              className={buttonVariants({ variant: "destructive" })}
              onClick={event => { event.preventDefault(); void remove(); }}
            >
              {deletingId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {deletingId ? "Suppression…" : "Supprimer de HubSpot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

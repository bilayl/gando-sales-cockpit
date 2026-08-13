"use client";
import { useEffect, useState } from "react";
import { ListFilter, Plus, RefreshCw, Users, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SegmentsView() {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("0-1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/segments");
    const d = await r.json();
    if (r.ok) setLists(d.lists || []);
    else setError(d.error || "Erreur");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const r = await fetch("/api/segments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, objectTypeId: type }),
    });
    const d = await r.json();
    if (!r.ok) setError(d.error || "Erreur création");
    else { setName(""); await load(); }
    setSaving(false);
  }

  return <div className="min-h-[calc(100vh-24px)] p-6 minari-scrollbar">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(115,93,243,0.9)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">Audiences</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Segments HubSpot</h1>
        <p className="mt-1 text-sm text-muted-foreground">Créés ici, ils sont créés directement dans HubSpot.</p>
      </div>
      <Button variant="outline" onClick={load}><RefreshCw size={15} /> Actualiser</Button>
    </div>

    <Card className="mt-6">
      <CardHeader><CardTitle className="text-base">Nouveau segment</CardTitle><CardDescription>Créer une liste HubSpot (contacts ou entreprises).</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_200px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="segment-name" className="text-xs text-muted-foreground">Nom</Label>
          <Input id="segment-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nom du nouveau segment" />
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
          <Button onClick={create} disabled={saving} className="h-9"><Plus size={15} /> {saving ? "Création…" : "Créer dans HubSpot"}</Button>
        </div>
      </CardContent>
    </Card>

    {error ? <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

    <Card className="mt-6 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nom</TableHead>
            <TableHead>Objet</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Taille</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="mx-auto animate-spin text-violet-300" /></TableCell></TableRow>
            : lists.map(l => <TableRow key={l.listId}>
              <TableCell><span className="flex items-center gap-2 font-semibold"><ListFilter size={15} className="text-violet-300" />{l.name}</span></TableCell>
              <TableCell><span className="flex items-center gap-2 text-muted-foreground">{l.objectTypeId === "0-1" ? <Users size={14} /> : <Building2 size={14} />} {l.objectTypeId === "0-1" ? "Contacts" : "Entreprises"}</span></TableCell>
              <TableCell><Badge variant="outline">{l.processingType || "—"}</Badge></TableCell>
              <TableCell className="text-right font-semibold">{l.size ?? "—"}</TableCell>
            </TableRow>)}
        </TableBody>
      </Table>
    </Card>
  </div>;
}

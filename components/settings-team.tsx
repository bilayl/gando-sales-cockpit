"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TeamRole = "admin" | "member" | "commercial";
type TeamMember = {
  email: string;
  display_name: string | null;
  role: TeamRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type TeamResponse = { members?: TeamMember[]; canManage?: boolean; error?: string };

const ROLE_INFO: Array<{ role: TeamRole; title: string; description: string }> = [
  { role: "admin", title: "Administrateur", description: "Accès complet au Cockpit, à la Deal Room et à la gestion de l’équipe." },
  { role: "member", title: "Membre", description: "Accès au Cockpit et à la Deal Room, sans pouvoir administrer l’équipe." },
  { role: "commercial", title: "Commercial", description: "Accès aux outils commerciaux, mais aucun accès à la Deal Room." },
];

function roleLabel(role: TeamRole) {
  return ROLE_INFO.find(item => item.role === role)?.title || "Membre";
}

function roleBadge(role: TeamRole) {
  if (role === "admin") return "border-violet-500/30 bg-violet-500/10 text-violet-700";
  if (role === "commercial") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

export function SettingsTeam({ initialCanManage = false }: { initialCanManage?: boolean }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({ email: "", displayName: "", role: "member" as TeamRole, password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/team", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as TeamResponse;
      if (!response.ok) throw new Error(payload.error || "Chargement impossible");
      setMembers(payload.members || []);
      setCanManage(Boolean(payload.canManage));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger l’équipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function patchMember(email: string, patch: Partial<TeamMember>) {
    setMembers(current => current.map(item => item.email === email ? { ...item, ...patch } : item));
  }

  async function saveMember(member: TeamMember) {
    if (!canManage || savingEmail) return;
    setSavingEmail(member.email);
    try {
      const response = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: member.email,
          displayName: member.display_name || "",
          role: member.role,
          active: member.active,
        }),
      });
      const payload = await response.json().catch(() => ({})) as TeamResponse;
      if (!response.ok) throw new Error(payload.error || "Mise à jour impossible");
      setMembers(payload.members || []);
      toast.success("Membre mis à jour.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
      await load();
    } finally {
      setSavingEmail(null);
    }
  }

  async function createMember() {
    if (!canManage || creating) return;
    if (!newMember.email.trim() || !newMember.password) return toast.error("Email et mot de passe temporaire obligatoires.");
    setCreating(true);
    try {
      const response = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newMember, active: true }),
      });
      const payload = await response.json().catch(() => ({})) as TeamResponse;
      if (!response.ok) throw new Error(payload.error || "Création impossible");
      setMembers(payload.members || []);
      setNewMember({ email: "", displayName: "", role: "member", password: "" });
      toast.success("Membre ajouté à l’équipe.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible");
    } finally {
      setCreating(false);
    }
  }

  return <Card className="overflow-hidden p-0">
    <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Users className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-bold tracking-[-0.02em]">Équipe</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gérez les accès au Sales Cockpit et les permissions de la Deal Room.</p>
        </div>
      </div>
      {canManage ? <Badge variant="outline" className="sm:ml-auto"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Gestion administrateur</Badge> : null}
    </div>

    <div className="space-y-5 p-5">
      <div className="grid gap-3 md:grid-cols-3">
        {ROLE_INFO.map(item => <div key={item.role} className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2"><Badge variant="outline" className={roleBadge(item.role)}>{item.title}</Badge>{item.role === "commercial" ? <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">Sans Deal Room</span> : null}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
        </div>)}
      </div>

      {canManage ? <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.025] p-4">
        <div className="mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Ajouter un membre</h3></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1.25fr_180px_1fr_auto]">
          <Input value={newMember.displayName} onChange={event => setNewMember(current => ({ ...current, displayName: event.target.value }))} placeholder="Nom / prénom" />
          <Input type="email" value={newMember.email} onChange={event => setNewMember(current => ({ ...current, email: event.target.value }))} placeholder="email@gando.app" />
          <select value={newMember.role} onChange={event => setNewMember(current => ({ ...current, role: event.target.value as TeamRole }))} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            {ROLE_INFO.map(item => <option key={item.role} value={item.role}>{item.title}</option>)}
          </select>
          <Input type="password" value={newMember.password} onChange={event => setNewMember(current => ({ ...current, password: event.target.value }))} placeholder="Mot de passe temporaire" />
          <Button onClick={() => void createMember()} disabled={creating}>{creating ? "Ajout…" : "Ajouter"}</Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Le mot de passe temporaire doit contenir au moins 8 caractères.</p>
      </div> : null}

      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Membres de l’équipe</h3><span className="text-xs text-muted-foreground">{members.length} compte{members.length > 1 ? "s" : ""}</span></div>
        {loading ? <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">Chargement de l’équipe…</div> : members.length ? <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {members.map(member => <div key={member.email} className="grid gap-3 bg-background p-4 lg:grid-cols-[minmax(160px,1fr)_minmax(220px,1.2fr)_180px_130px_auto] lg:items-center">
            <div>
              {canManage ? <Input value={member.display_name || ""} onChange={event => patchMember(member.email, { display_name: event.target.value })} placeholder="Nom / prénom" /> : <div className="text-sm font-semibold">{member.display_name || "Sans nom"}</div>}
            </div>
            <div className="min-w-0"><div className="truncate text-sm font-medium">{member.email}</div><div className="mt-1 text-[11px] text-muted-foreground">{member.active ? "Compte actif" : "Compte désactivé"}</div></div>
            {canManage ? <select value={member.role} onChange={event => patchMember(member.email, { role: event.target.value as TeamRole })} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
              {ROLE_INFO.map(item => <option key={item.role} value={item.role}>{item.title}</option>)}
            </select> : <Badge variant="outline" className={`w-fit ${roleBadge(member.role)}`}>{roleLabel(member.role)}</Badge>}
            {canManage ? <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={member.active} onChange={event => patchMember(member.email, { active: event.target.checked })} className="h-4 w-4 accent-primary" /> Actif</label> : <span className="text-xs text-muted-foreground">{member.active ? "Actif" : "Désactivé"}</span>}
            {canManage ? <Button variant="outline" size="sm" onClick={() => void saveMember(member)} disabled={savingEmail === member.email}>{savingEmail === member.email ? "Enregistrement…" : "Enregistrer"}</Button> : null}
          </div>)}
        </div> : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aucun membre configuré.</div>}
      </div>
    </div>
  </Card>;
}

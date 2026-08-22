from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str):
    text = path.read_text(encoding="utf-8-sig")
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


# 1) Contract: tighten vertical rhythm while keeping legal text readable.
renderer = ROOT / "components/sd05-contract-renderer.tsx"
text = renderer.read_text(encoding="utf-8")
replacements = {
    'className="pt-1 text-[17px] font-black uppercase tracking-[0.02em]"': 'className="pt-0.5 text-[17px] font-black uppercase leading-[1.25] tracking-[0.02em]"',
    'className="pt-2 text-[16px] font-black uppercase tracking-[0.01em]"': 'className="pt-1 text-[16px] font-black uppercase leading-[1.25] tracking-[0.01em]"',
    'className="pt-1 text-[14px] font-black leading-5 text-[#333333]"': 'className="pt-0.5 text-[14px] font-black leading-[1.3] text-[#333333]"',
    'className="pt-1 text-[12px] font-bold uppercase tracking-[0.035em] text-[#333333]"': 'className="pt-0.5 text-[12px] font-bold uppercase leading-[1.3] tracking-[0.035em] text-[#333333]"',
    'className="pt-1 text-[13px] font-black leading-5 text-[#333333]"': 'className="pt-0.5 text-[13px] font-black leading-[1.35] text-[#333333]"',
    'className="whitespace-pre-line pl-5 text-[12px] leading-[1.65] text-[#333333]"': 'className="whitespace-pre-line pl-5 text-[12px] leading-[1.48] text-[#333333]"',
    'className="w-full border-collapse text-left text-[11px] leading-5 text-[#333333]"': 'className="w-full border-collapse text-left text-[11px] leading-[1.4] text-[#333333]"',
    'className="border-r border-slate-300 px-3 py-2.5 font-black last:border-r-0"': 'className="border-r border-slate-300 px-3 py-1.5 font-black last:border-r-0"',
    'className="border-r border-slate-200 px-3 py-2 align-top last:border-r-0"': 'className="border-r border-slate-200 px-3 py-1.5 align-top last:border-r-0"',
    'className="whitespace-pre-line text-[12px] leading-[1.7] text-[#333333]"': 'className="whitespace-pre-line text-[12px] leading-[1.5] text-[#333333]"',
    'className="space-y-4 pt-1"': 'className="space-y-2.5 pt-0.5"',
    'className="mt-3 text-[12px] leading-6 text-[#333333]"': 'className="mt-2.5 text-[12px] leading-[1.5] text-[#333333]"',
    'className="mt-3 max-w-2xl text-[12px] leading-6 text-slate-600"': 'className="mt-2.5 max-w-2xl text-[12px] leading-[1.5] text-slate-600"',
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
renderer.write_text(text, encoding="utf-8")


# 2) Analytics: HubSpot filterGroups are OR-ed. Put GTE + LTE in the SAME group and use millisecond timestamps.
analytics = ROOT / "app/api/analytics/route.ts"
text = analytics.read_text(encoding="utf-8-sig")
old = '''function rangeFilters(property: string, start: string, end: string) {
  return [
    { filters: [{ propertyName: property, operator: "GTE", value: start }] },
    { filters: [{ propertyName: property, operator: "LTE", value: end }] },
  ];
}'''
new = '''function rangeFilters(property: string, start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    throw Object.assign(new Error("Période de statistiques invalide."), { status: 400 });
  }
  return [{
    filters: [
      { propertyName: property, operator: "GTE", value: String(startMs) },
      { propertyName: property, operator: "LTE", value: String(endMs) },
    ],
  }];
}'''
if old not in text:
    raise SystemExit("analytics rangeFilters block not found")
text = text.replace(old, new, 1)
analytics.write_text(text, encoding="utf-8")


# 3) Company creation API.
companies_route = ROOT / "app/api/companies/route.ts"
text = companies_route.read_text(encoding="utf-8-sig")
if "export async function POST(request: NextRequest)" not in text:
    text += '''

const COMPANY_CREATE_ALLOWED = [
  "name", "domain", "phone", "website", "address", "address2", "city", "zip", "state", "country", "industry", "description", "hubspot_owner_id",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const props = Object.fromEntries(
      Object.entries(body.properties ?? {})
        .filter(([key, value]) => COMPANY_CREATE_ALLOWED.includes(key) && value !== undefined && value !== null && String(value).trim() !== "")
        .map(([key, value]) => [key, String(value).trim()]),
    );
    if (!props.name && !props.domain) {
      return NextResponse.json({ error: "Renseignez au moins un nom d’entreprise ou un domaine." }, { status: 400 });
    }

    const data = await hubspotJson("/crm/objects/2026-03/companies", {
      method: "POST",
      body: JSON.stringify({ properties: props }),
    });

    const row = {
      hubspot_id: String(data.id),
      name: props.name || props.domain || "Sans nom",
      domain: props.domain ?? null,
      phone: props.phone ?? null,
      website: props.website ?? null,
      city: props.city ?? null,
      postal_code: props.zip ?? null,
      country: props.country ?? null,
      owner_hubspot_id: props.hubspot_owner_id ?? null,
      raw_data: data,
      hubspot_updated_at: data.updatedAt || new Date().toISOString(),
    };
    const { error } = await getSupabaseAdmin().from("companies").upsert(row, { onConflict: "hubspot_id" });
    if (error) console.error("Supabase upsert company:", error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e }, { status: e.status || 500 });
  }
}
'''
companies_route.write_text(text, encoding="utf-8")


# 4) New company dialog, created directly in Cockpit and synchronized to HubSpot + Supabase.
new_company = ROOT / "components/new-company-dialog.tsx"
new_company.write_text('''"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void };

const EMPTY = { name: "", domain: "", phone: "", website: "", industry: "", city: "", zip: "", state: "", country: "", description: "" };
const FIELDS: Array<{ key: keyof typeof EMPTY; label: string; placeholder?: string }> = [
  { key: "name", label: "Nom de l’entreprise", placeholder: "ACME Location" },
  { key: "domain", label: "Domaine", placeholder: "acme.fr" },
  { key: "phone", label: "Téléphone" },
  { key: "website", label: "Site web", placeholder: "https://…" },
  { key: "industry", label: "Secteur" },
  { key: "city", label: "Ville" },
  { key: "zip", label: "Code postal" },
  { key: "state", label: "Région" },
  { key: "country", label: "Pays" },
];

export function NewCompanyDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY, value: string) { setForm(current => ({ ...current, [key]: value })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const properties = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    if (!properties.name && !properties.domain) {
      setError("Renseignez au moins le nom de l’entreprise ou son domaine.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ properties }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "HubSpot a rejeté la création de l’entreprise.");
      setForm(EMPTY);
      onOpenChange(false);
      onCreated();
      toast.success("Entreprise créée dans HubSpot.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de créer l’entreprise.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Nouvelle entreprise</DialogTitle><DialogDescription>Crée l’entreprise directement dans HubSpot et la rend disponible dans le Sales Cockpit.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(field => <div key={field.key} className="space-y-1.5"><Label className="text-xs text-muted-foreground">{field.label}</Label><Input value={form[field.key]} onChange={event => set(field.key, event.target.value)} placeholder={field.placeholder || field.label} /></div>)}</div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Description</Label><textarea value={form.description} onChange={event => set("description", event.target.value)} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Contexte ou description de l’entreprise" /></div>
        {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}Créer l’entreprise</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
''', encoding="utf-8")


# 5) Company-first prospection: expose creation for both objects.
company_view = ROOT / "components/company-first-prospection-view.tsx"
text = company_view.read_text(encoding="utf-8")
text = text.replace(
    'import { Building2, ListFilter, Loader2, MapPin, Play, RefreshCw, Search, SquareKanban, Table2, Users } from "lucide-react";',
    'import { Building2, ListFilter, Loader2, MapPin, Play, Plus, RefreshCw, Search, SquareKanban, Table2, Users } from "lucide-react";',
    1,
)
text = text.replace(
    'import { CompanyDrawer } from "@/components/company-drawer";',
    'import { CompanyDrawer } from "@/components/company-drawer";\nimport { NewCompanyDialog } from "@/components/new-company-dialog";\nimport { NewContactDialog } from "@/components/new-contact-dialog";',
    1,
)
text = text.replace(
    '  const [sessionOpen, setSessionOpen] = useState(false);',
    '  const [sessionOpen, setSessionOpen] = useState(false);\n  const [newCompanyOpen, setNewCompanyOpen] = useState(false);\n  const [newContactOpen, setNewContactOpen] = useState(false);',
    1,
)
old_actions = '''            <div className="flex items-center gap-2">
              <div className="hidden rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground xl:block"><strong className="text-primary">File sécurisée</strong> · pas intéressé, hors cible, RDV pris et relances futures sont retirés de la session</div>
              <Button disabled={loading || !actionableCompanies.length} onClick={() => setSessionOpen(true)} className="gap-2">'''
new_actions = '''            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground 2xl:block"><strong className="text-primary">File sécurisée</strong> · pas intéressé, hors cible, RDV pris et relances futures sont retirés de la session</div>
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><Plus size={14} /> Contact</Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setNewCompanyOpen(true)}><Building2 size={14} /> Entreprise</Button>
              <Button disabled={loading || !actionableCompanies.length} onClick={() => setSessionOpen(true)} className="gap-2">'''
if old_actions not in text:
    raise SystemExit("company view actions not found")
text = text.replace(old_actions, new_actions, 1)
old_bottom = '''      <ProspectionSession open={sessionOpen} onOpenChange={setSessionOpen} companies={actionableCompanies} onOpenCompany={setDrawerId} />
      <CompanyDrawer companyId={drawerId} open={Boolean(drawerId)} onOpenChange={open => !open && setDrawerId(null)} />'''
new_bottom = '''      <ProspectionSession open={sessionOpen} onOpenChange={setSessionOpen} companies={actionableCompanies} onOpenCompany={setDrawerId} />
      <CompanyDrawer companyId={drawerId} open={Boolean(drawerId)} onOpenChange={open => !open && setDrawerId(null)} />
      <NewCompanyDialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen} onCreated={() => void load(true)} />
      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => void load(true)} />'''
if old_bottom not in text:
    raise SystemExit("company view bottom not found")
text = text.replace(old_bottom, new_bottom, 1)
company_view.write_text(text, encoding="utf-8")


# 6) Contact-first: keep existing contact creation and add company creation beside it.
contact_view = ROOT / "components/contact-first-prospection-view.tsx"
text = contact_view.read_text(encoding="utf-8")
text = text.replace(
    'import { NewContactDialog } from "@/components/new-contact-dialog";',
    'import { NewCompanyDialog } from "@/components/new-company-dialog";\nimport { NewContactDialog } from "@/components/new-contact-dialog";',
    1,
)
text = text.replace(
    '  const [newContactOpen, setNewContactOpen] = useState(false);',
    '  const [newContactOpen, setNewContactOpen] = useState(false);\n  const [newCompanyOpen, setNewCompanyOpen] = useState(false);',
    1,
)
old_button = '<Button size="sm" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><Plus size={14} /> Nouveau contact</Button>'
new_button = '<Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setNewCompanyOpen(true)}><Building2 size={14} /> Entreprise</Button>\n              <Button size="sm" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><Plus size={14} /> Nouveau contact</Button>'
if old_button not in text:
    raise SystemExit("contact view create button not found")
text = text.replace(old_button, new_button, 1)
old_bottom = '<NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => void load(true, isRecommendationSegment)} />'
new_bottom = '<NewCompanyDialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen} onCreated={() => void load(true, isRecommendationSegment)} />\n      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => void load(true, isRecommendationSegment)} />'
if old_bottom not in text:
    raise SystemExit("contact view bottom not found")
text = text.replace(old_bottom, new_bottom, 1)
contact_view.write_text(text, encoding="utf-8")


# 7) Sidebar: exact same visual mark as app/icon.svg favicon.
sidebar = ROOT / "components/app-sidebar.tsx"
text = sidebar.read_text(encoding="utf-8")
old_mark = '<span className="brand-mark grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white">G</span>'
new_mark = '''<span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg" aria-hidden="true"><svg viewBox="0 0 128 128" className="h-full w-full" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="28" fill="#CDDFFF"/><path d="M98.8479 81.2759C95.3613 88.4324 89.7153 94.3147 82.706 98.0931C75.6966 101.872 67.6776 103.356 59.7795 102.336C51.8811 101.317 44.5022 97.8459 38.6831 92.4119C32.8637 86.9779 28.8977 79.8554 27.344 72.0485C25.7903 64.2415 26.7273 56.144 30.0231 48.8979C33.3188 41.6516 38.807 35.622 45.7136 31.6592C52.6203 27.6965 60.5972 26.0004 68.5197 26.8102C76.4421 27.62 83.9105 30.8948 89.8717 36.1728L87.804 38.5059C84.1861 42.5879 77.934 42.7267 72.773 40.9575C70.9774 40.3419 69.1075 39.929 67.1975 39.7338C61.9821 39.2006 56.731 40.3172 52.1842 42.926C47.6377 45.5346 44.0247 49.5038 41.8552 54.274C39.6856 59.0443 39.0687 64.3748 40.0916 69.5139C41.1143 74.6533 43.7252 79.342 47.5561 82.9192C51.3868 86.4964 56.2443 88.7815 61.4437 89.4526C66.643 90.1234 71.922 89.1465 76.5362 86.659C78.2261 85.7482 79.7955 84.6513 81.2188 83.3957C85.3096 79.7873 91.139 77.5239 96.0444 79.9115L98.8479 81.2759Z" fill="#19324D"/><path d="M58.7457 70.2185C65.9074 65.8701 74.6138 63.9597 83.2509 64.8414C89.7683 65.5067 95.9122 67.7276 101.047 71.2166C103.606 72.9549 102.959 76.3178 100.113 77.6647C96.2643 73.9283 88.7754 73.899 83.6102 75.2809C80.5881 76.2958 76.5579 78.9089 73.3011 81.6975C70.7982 83.8406 66.7866 84.4307 64.2231 82.3437C59.6547 78.624 54.1802 72.9909 58.7457 70.2185Z" fill="#19324D"/></svg></span>'''
if old_mark not in text:
    raise SystemExit("sidebar brand mark not found")
text = text.replace(old_mark, new_mark, 1)
sidebar.write_text(text, encoding="utf-8")

print("Sales Cockpit creation, analytics, contract spacing and sidebar logo patch applied")

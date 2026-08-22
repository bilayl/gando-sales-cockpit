from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}")
    path.write_text(text.replace(old, new, 1))


# 1) Keep the top strip for aggregate counts only. Detailed consultations live in the SD01 card.
strip = ROOT / "components/sd-document-analytics-strip.tsx"
strip.write_text('''"use client";\n\nimport { useEffect, useState } from "react";\nimport { Eye, Loader2, MousePointerClick } from "lucide-react";\nimport type { SDCode } from "@/lib/sd-room-types";\n\ntype Metric = { visits: number; opens: number };\ntype Payload = { documents?: Partial<Record<SDCode, Metric>> };\n\nexport function SDDocumentAnalyticsStrip({ dealId, code }: { dealId: string; code: SDCode }) {\n  const [metric, setMetric] = useState<Metric | null>(null);\n  useEffect(() => {\n    let active = true;\n    fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document-analytics`, { cache: "no-store" })\n      .then(response => response.ok ? response.json() : Promise.reject())\n      .then((payload: Payload) => { if (active) setMetric(payload.documents?.[code] || { visits: 0, opens: 0 }); })\n      .catch(() => { if (active) setMetric({ visits: 0, opens: 0 }); });\n    return () => { active = false; };\n  }, [code, dealId]);\n\n  if (!metric) return <div className="flex h-10 items-center border-b border-border px-5 text-xs text-muted-foreground lg:px-7"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Statistiques de consultation…</div>;\n\n  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground lg:px-7"><span className="font-black uppercase tracking-[0.12em] text-foreground">{code}</span><span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> Visites <strong className="text-foreground">{metric.visits}</strong></span><span className="inline-flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5 text-primary" /> Ouvertures <strong className="text-foreground">{metric.opens}</strong></span></div>;\n}\n''')

# 2) Carry first/last name through the room-wide analytics used by the detailed consultations card.
types = ROOT / "lib/sd-room-types.ts"
replace_once(
    types,
    'recentVisitors: Array<{ email: string; lastSeenAt: string; activeSeconds: number }>;',
    'recentVisitors: Array<{ email: string; firstName: string; lastName: string; lastSeenAt: string; activeSeconds: number }>;',
)

room = ROOT / "lib/sd-room.ts"
replace_once(
    room,
    '.select("visitor_email,event_type,active_seconds,created_at")',
    '.select("visitor_email,visitor_first_name,visitor_last_name,event_type,active_seconds,created_at")',
)
replace_once(
    room,
    'const visitors = new Map<string, { email: string; lastSeenAt: string; activeSeconds: number }>();',
    'const visitors = new Map<string, { email: string; firstName: string; lastName: string; lastSeenAt: string; activeSeconds: number }>();',
)
old_loop = '''  for (const event of data) {\n    const email = cleanEmail(event.visitor_email);\n    if (event.event_type === "room_opened") opens += 1;\n    activeSeconds += Number(event.active_seconds) || 0;\n    const previous = visitors.get(email);\n    if (!previous) visitors.set(email, { email, lastSeenAt: event.created_at, activeSeconds: Number(event.active_seconds) || 0 });\n    else previous.activeSeconds += Number(event.active_seconds) || 0;\n  }'''
new_loop = '''  for (const event of data) {\n    const email = cleanEmail(event.visitor_email);\n    const firstName = String(event.visitor_first_name || "").trim();\n    const lastName = String(event.visitor_last_name || "").trim();\n    const visitorKey = email || [firstName, lastName].filter(Boolean).join("|").toLowerCase() || "anonymous";\n    if (event.event_type === "room_opened") opens += 1;\n    activeSeconds += Number(event.active_seconds) || 0;\n    const previous = visitors.get(visitorKey);\n    if (!previous) visitors.set(visitorKey, { email, firstName, lastName, lastSeenAt: event.created_at, activeSeconds: Number(event.active_seconds) || 0 });\n    else {\n      previous.activeSeconds += Number(event.active_seconds) || 0;\n      if (!previous.firstName && firstName) previous.firstName = firstName;\n      if (!previous.lastName && lastName) previous.lastName = lastName;\n    }\n  }'''
replace_once(room, old_loop, new_loop)

# 3) Show names in the existing "Dernières consultations" card instead of pushing the visitor detail into the top strip.
editor = ROOT / "components/sd-room-editor.tsx"
text = editor.read_text()
pattern = re.compile(r'''\n\s*<Card className="p-5">\n\s*<div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h3 className="font-bold">Dernières consultations</h3></div>.*?\n\s*</Card>''', re.S)
replacement = '''\n              <Card className="p-5">\n                <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h3 className="font-bold">Dernières consultations</h3></div>\n                <p className="mt-1 text-xs text-muted-foreground">Dernière activité : {formatDate(analytics.lastViewedAt)}</p>\n                <div className="mt-3 space-y-2">\n                  {analytics.recentVisitors.map(visitor => {\n                    const fullName = [visitor.firstName, visitor.lastName].filter(Boolean).join(" ");\n                    return <div key={`${visitor.email}-${visitor.lastSeenAt}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 p-3 text-xs">\n                      <div className="min-w-0">\n                        <div className="truncate font-semibold">{fullName || visitor.email || "Visiteur"}</div>\n                        {fullName && visitor.email ? <div className="truncate text-[11px] text-muted-foreground">{visitor.email}</div> : null}\n                        <div className="text-muted-foreground">{formatDate(visitor.lastSeenAt)}</div>\n                      </div>\n                      <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{formatDuration(visitor.activeSeconds)}</Badge>\n                    </div>;\n                  })}\n                  {!analytics.recentVisitors.length ? <p className="text-xs text-muted-foreground">Aucune consultation pour le moment.</p> : null}\n                </div>\n              </Card>'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"Could not patch consultation card: {count}")
editor.write_text(text)

# 4) The public SD05 room must never expose the contract body. It only links to the separate signing view,
#    and exposes the signed PDF once the SD05 document is validated.
public = ROOT / "components/public-sd-room-v6.tsx"
text = public.read_text()
pattern = re.compile(r'function SD05Document\(.*?\n\}\n\nfunction DocumentBody', re.S)
replacement = '''function SD05Document({ content, token, visitorEmail, language, documentStatus }: { content: SD05Content; token: string; visitorEmail: string; language: RoomLanguage; documentStatus: string }) {\n  const validated = documentStatus === "validated";\n  const signed = content.contractStatus === "signed" || validated;\n  const ready = content.contractStatus === "ready_to_sign";\n  return <div className="space-y-5 sm:space-y-6"><Section title={content.contractTitle || tr(language, "Contrat", "Contract")} kicker={tr(language, "SD05 · Contrat & signature", "SD05 · Contract & signature")}>\n    <div className="flex flex-col gap-5">\n      <div className="flex flex-wrap items-center gap-3"><span className={`inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${signed ? "bg-[#edf7ef] text-[#376b43]" : ready ? "bg-[#f3f0ff] text-[#5c50ae]" : "bg-[#f1f3f4] text-[#60696e]"}`}>{validated ? tr(language, "Contrat validé", "Contract approved") : signed ? tr(language, "Contrat signé", "Contract signed") : ready ? tr(language, "Prêt à signer", "Ready to sign") : tr(language, "Brouillon", "Draft")}</span>{content.signatureDeadline && !validated ? <span className="text-sm text-[#687277]">{tr(language, "Signature attendue avant le", "Signature expected before")} {formatDate(content.signatureDeadline, language)}</span> : null}</div>\n      <p className="max-w-2xl text-[15px] leading-7 text-[#687277]">{tr(language, "Le contrat n’est pas affiché dans la Room. Il s’ouvre dans un espace sécurisé séparé pour la consultation et la signature.", "The contract is not displayed inside the Room. It opens in a separate secure space for review and signature.")}</p>\n      <div className="flex flex-wrap gap-2">\n        {content.contractUrl ? <a href={content.contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white"><FileSignature className="h-4 w-4" />{validated ? tr(language, "Ouvrir le contrat signé", "Open signed contract") : tr(language, "Ouvrir et signer le contrat", "Open and sign contract")}<ExternalLink className="h-4 w-4" /></a> : !validated ? <span className="text-sm italic text-[#81898e]">{tr(language, "Le lien de signature sera ajouté ici.", "The signature link will appear here.")}</span> : null}\n        {validated ? <a href={`/api/public/deal-room/${encodeURIComponent(token)}/sd05-pdf?email=${encodeURIComponent(visitorEmail)}`} className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-[#ccd2d5] bg-white px-5 text-[13px] font-semibold text-[#202a2f]"><Download className="h-4 w-4" />{tr(language, "Télécharger le contrat PDF", "Download contract PDF")}</a> : null}\n      </div>\n    </div>\n  </Section></div>;\n}\n\nfunction DocumentBody'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"Could not replace public SD05 block: {count}")
old_call = 'return <SD05Document content={document.content as unknown as SD05Content} token={token} visitorEmail={visitorEmail} language={language} />;'
new_call = 'return <SD05Document content={document.content as unknown as SD05Content} token={token} visitorEmail={visitorEmail} language={language} documentStatus={document.status} />;'
if old_call not in text:
    raise SystemExit("Public SD05 DocumentBody call not found")
text = text.replace(old_call, new_call, 1)
public.write_text(text)

# 5) Make the table button insert the table exactly at the current cursor position so the action is immediately visible.
builder = ROOT / "components/sd05-contract-builder.tsx"
text = builder.read_text()
text = text.replace(
    'function ContractTextEditor({ value, onChange, disabled, onAddAnnex, onAddTable }: { value: string; onChange: (value: string) => void; disabled: boolean; onAddAnnex: () => void; onAddTable: () => void }) {',
    'function ContractTextEditor({ value, onChange, disabled, onAddAnnex }: { value: string; onChange: (value: string) => void; disabled: boolean; onAddAnnex: () => void }) {',
    1,
)
anchor = '''  };\n\n  return <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">'''
helper = '''  };\n\n  const insertTable = () => {\n    const textarea = ref.current;\n    if (!textarea) return;\n    const start = textarea.selectionStart ?? value.length;\n    const end = textarea.selectionEnd ?? start;\n    const before = value.slice(0, start);\n    const after = value.slice(end);\n    const table = "| Intitulé | Description | Valeur |\\n| --- | --- | --- |\\n| Élément | À compléter | À compléter |";\n    const leading = before && !before.endsWith("\\n\\n") ? (before.endsWith("\\n") ? "\\n" : "\\n\\n") : "";\n    const trailing = after && !after.startsWith("\\n") ? "\\n\\n" : "";\n    const insertion = `${leading}${table}${trailing}`;\n    onChange(`${before}${insertion}${after}`);\n    requestAnimationFrame(() => {\n      const nextCursor = start + insertion.length - trailing.length;\n      textarea.focus();\n      textarea.setSelectionRange(nextCursor, nextCursor);\n      textarea.scrollTop = Math.max(0, textarea.scrollHeight * (nextCursor / Math.max(1, value.length + insertion.length)) - textarea.clientHeight / 2);\n    });\n  };\n\n  return <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">'''
if anchor not in text:
    raise SystemExit("Could not insert table helper")
text = text.replace(anchor, helper, 1)
text = text.replace('onClick={onAddTable}>+ Tableau</Button>', 'onClick={insertTable}>+ Tableau</Button>', 1)
text = re.sub(r'\n  const addTable = \(\) => setValue\(current => \(\{ \.\.\.current, contractSummary: .*?\}\)\);', '', text, count=1)
text = text.replace(' onAddAnnex={addAnnex} onAddTable={addTable} />', ' onAddAnnex={addAnnex} />', 1)
builder.write_text(text)

print("SD room consultation, SD05 visibility and table editor fixes applied")

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def replace(path: Path, old: str, new: str, label: str):
    text = path.read_text()
    if old not in text:
        raise RuntimeError(f"Missing anchor {label} in {path}")
    path.write_text(text.replace(old, new, 1))

# --- SD04: embed only the PDF page, without the native thumbnails/navigation pane.
path = ROOT / "components/sd04-offer-builder.tsx"
replace(path,
'''const isPdfUrl = (value: string) => /^https?:\\/\\//i.test(value || "");''',
'''const isPdfUrl = (value: string) => /^https?:\\/\\//i.test(value || "");
const pdfEmbedUrl = (value: string) => `${value.split("#")[0]}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;''',
"sd04 embed helper")
replace(path, 'src={pdfUrl} title={pdfName}', 'src={pdfEmbedUrl(pdfUrl)} title={pdfName}', "sd04 iframe")

# --- SD05 editor: table template and stronger text contrast.
path = ROOT / "components/sd05-contract-builder.tsx"
replace(path,
'''function ContractTextEditor({ value, onChange, disabled, onAddAnnex }: { value: string; onChange: (value: string) => void; disabled: boolean; onAddAnnex: () => void }) {''',
'''function ContractTextEditor({ value, onChange, disabled, onAddAnnex, onAddTable }: { value: string; onChange: (value: string) => void; disabled: boolean; onAddAnnex: () => void; onAddTable: () => void }) {''',
"editor props")
replace(path,
'''      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onAddAnnex}>+ Annexe</Button>''',
'''      <Button type="button" variant="outline" size="sm" onClick={onAddTable}>+ Tableau</Button>
      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onAddAnnex}>+ Annexe</Button>''',
"table button")
replace(path,
'''      className="w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60"''',
'''      className="w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-[#333333] outline-none disabled:cursor-not-allowed disabled:opacity-60"''',
"editor color")
replace(path,
'''    <div className="border-t border-border bg-muted/15 px-4 py-2 text-[11px] leading-5 text-muted-foreground">Place le curseur sur une ligne puis choisis son niveau. Les symboles de structure ne sont jamais affichés dans le contrat final. H2 = titre, H3 = sous-titre, H4 = sous-section.</div>''',
'''    <div className="border-t border-border bg-muted/15 px-4 py-2 text-[11px] leading-5 text-muted-foreground">Place le curseur sur une ligne puis choisis son niveau. H2 = titre, H3 = sous-titre, H4 = sous-section. « + Tableau » insère un modèle directement modifiable ; les séparateurs techniques ne sont pas affichés comme du texte dans le contrat final.</div>''',
"editor help")
replace(path,
'''  const addAnnex = () => setValue(current => { const matches = current.contractSummary.match(/^ANNEXE\\s+\\d+/gim) || []; const number = matches.length + 1; return { ...current, contractSummary: `${current.contractSummary.trimEnd()}\\n\\nANNEXE ${number} : TITRE DE L'ANNEXE\\nTexte de l'annexe à compléter.`.trim() }; });''',
'''  const addAnnex = () => setValue(current => { const matches = current.contractSummary.match(/^ANNEXE\\s+\\d+/gim) || []; const number = matches.length + 1; return { ...current, contractSummary: `${current.contractSummary.trimEnd()}\\n\\nANNEXE ${number} : TITRE DE L'ANNEXE\\nTexte de l'annexe à compléter.`.trim() }; });
  const addTable = () => setValue(current => ({ ...current, contractSummary: `${current.contractSummary.trimEnd()}\\n\\n| Élément | Détail |\\n| --- | --- |\\n| À compléter | À compléter |`.trim() }));''',
"add table function")
replace(path,
'''<ContractTextEditor disabled={locked} value={value.contractSummary} onChange={next => set("contractSummary", next)} onAddAnnex={addAnnex} />''',
'''<ContractTextEditor disabled={locked} value={value.contractSummary} onChange={next => set("contractSummary", next)} onAddAnnex={addAnnex} onAddTable={addTable} />''',
"editor call")
replace(path,
'''<li>2. Structurer avec H2 / H3 / H4 et annexes si nécessaire.</li>''',
'''<li>2. Structurer avec H2 / H3 / H4, tableaux et annexes si nécessaire.</li>''',
"workflow table")

# --- SD05 renderer: table blocks, #333 text, true Gando footer logo. Keep template 1 cover structure unchanged.
path = ROOT / "components/sd05-contract-renderer.tsx"
replace(path,
'''type BlockKind = "major" | "article" | "h2" | "h3" | "h4" | "subsection" | "bullet" | "paragraph";''',
'''type BlockKind = "major" | "article" | "h2" | "h3" | "h4" | "subsection" | "bullet" | "table" | "paragraph";''',
"block kind")
replace(path,
'''  if (block.kind === "subsection") return 0.9 + Math.ceil(block.text.length / 600) * 0.3;
  return Math.max(0.7, Math.ceil(block.text.length / 520) * 0.85);''',
'''  if (block.kind === "subsection") return 0.9 + Math.ceil(block.text.length / 600) * 0.3;
  if (block.kind === "table") return 1.2 + Math.ceil(block.text.split("\\n").length / 4) * 0.8;
  return Math.max(0.7, Math.ceil(block.text.length / 520) * 0.85);''',
"table weight")
text = path.read_text()
pattern = re.compile(r'''function renderSegments\(raw: string\): RenderBlock\[\] \{.*?\n\}\n\nfunction paginate''', re.S)
replacement = '''function renderSegments(raw: string): RenderBlock[] {
  const result: RenderBlock[] = [];
  let paragraph: string[] = [];
  let table: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    result.push({ kind: "paragraph", text: paragraph.join("\\n").trim() });
    paragraph = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    result.push({ kind: "table", text: table.join("\\n") });
    table = [];
  };
  for (const line of raw.split(/\\n/)) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); flushTable(); continue; }
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 4;
    if (isTableRow) { flushParagraph(); table.push(trimmed); continue; }
    flushTable();
    const kind = blockKind(trimmed);
    if (kind === "paragraph") paragraph.push(trimmed);
    else { flushParagraph(); result.push({ kind, text: displayText(trimmed) }); }
  }
  flushParagraph();
  flushTable();
  return result;
}

function paginate'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError("renderSegments replacement failed")
path.write_text(text)

text = path.read_text()
old = '''  if (block.kind === "subsection") return <h3 className="pt-1 text-[13px] font-black leading-5 text-slate-950">{block.text}</h3>;
  if (block.kind === "bullet") return <p className="whitespace-pre-line pl-5 text-[12px] leading-[1.65] text-slate-700">{block.text}</p>;
  return <p className="whitespace-pre-line text-[12px] leading-[1.7] text-slate-700">{block.text}</p>;'''
new = '''  if (block.kind === "subsection") return <h3 className="pt-1 text-[13px] font-black leading-5 text-[#333333]">{block.text}</h3>;
  if (block.kind === "table") {
    const rows = block.text.split("\\n").map(line => line.trim()).filter(line => line && !/^\\|?\\s*:?-{3,}/.test(line)).map(line => line.replace(/^\\||\\|$/g, "").split("|").map(cell => cell.trim()));
    if (!rows.length) return null;
    const [head, ...body] = rows;
    return <div className="my-2 overflow-hidden rounded-lg border border-slate-200"><table className="w-full table-fixed border-collapse text-left text-[11px] leading-5 text-[#333333]"><thead className="bg-slate-50"><tr>{head.map((cell, index) => <th key={index} className="border-b border-r border-slate-200 px-3 py-2 font-bold last:border-r-0">{cell}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="border-r border-slate-100 px-3 py-2 align-top last:border-r-0">{cell}</td>)}</tr>)}</tbody></table></div>;
  }
  if (block.kind === "bullet") return <p className="whitespace-pre-line pl-5 text-[12px] leading-[1.65] text-[#333333]">{block.text}</p>;
  return <p className="whitespace-pre-line text-[12px] leading-[1.7] text-[#333333]">{block.text}</p>;'''
if old not in text:
    raise RuntimeError("ContractBlock anchor missing")
text = text.replace(old, new, 1)
text = text.replace('''    <div className="flex items-center justify-center gap-1 text-[11px] font-black text-slate-700"><span className="text-[17px] leading-none">G</span><span>gando</span></div>''', '''    <div className="flex items-center justify-center"><img src="https://www.gando.app/Logo.svg" alt="Gando" className="h-[16px] w-auto max-w-[92px] object-contain" /></div>''', 1)
path.write_text(text)

# --- Key people section supports English labels on public room only.
path = ROOT / "components/sd01-key-people-public.tsx"
text = path.read_text()
text = text.replace('''export function SD01KeyPeoplePublic({ stakeholders }: { stakeholders: Stakeholder[] }) {''', '''export function SD01KeyPeoplePublic({ stakeholders, language = "fr" }: { stakeholders: Stakeholder[]; language?: "fr" | "en" }) {''')
text = text.replace('''<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#735DF3]">Interlocuteurs & décideurs</div>''', '''<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#735DF3]">{language === "en" ? "Stakeholders & decision-makers" : "Interlocuteurs & décideurs"}</div>''')
text = text.replace('''<h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#18221e]">Personnes clés</h2>''', '''<h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#18221e]">{language === "en" ? "Key people" : "Personnes clés"}</h2>''')
text = text.replace('''<UserRound className="h-3.5 w-3.5" /> {people.length} personne{people.length > 1 ? "s" : ""}''', '''<UserRound className="h-3.5 w-3.5" /> {people.length} {language === "en" ? `person${people.length > 1 ? "s" : ""}` : `personne${people.length > 1 ? "s" : ""}`}''')
text = text.replace('''{person.name || "Interlocuteur à confirmer"}''', '''{person.name || (language === "en" ? "Stakeholder to confirm" : "Interlocuteur à confirmer")}''')
path.write_text(text)

# --- Public Room: English mode, clean PDF embed, signed PDF download.
path = ROOT / "components/public-sd-room-v6.tsx"
text = path.read_text()
text = text.replace('''import { ArrowUpRight, Check, CheckCircle2, ChevronRight, ExternalLink, FileSignature, FileText, Loader2, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";''', '''import { ArrowUpRight, Check, CheckCircle2, ChevronRight, Download, ExternalLink, FileSignature, FileText, Languages, Loader2, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";''')
text = text.replace('''const OPTIONAL_CODES: SDCode[] = ["SD03", "SD04"];

function stageTitle(code: SDCode) {
  return code === "SD04" ? "PDF commercial" : SD_STAGE_META[code].title;
}

function formatDate(value?: string | null) {''', '''const OPTIONAL_CODES: SDCode[] = ["SD03", "SD04"];
type RoomLanguage = "fr" | "en";
const tr = (language: RoomLanguage, fr: string, en: string) => language === "en" ? en : fr;
const EN_STAGE_TITLES: Record<SDCode, string> = { SD01: "Summary", SD02: "Action plan", SD03: "Solution & integration", SD04: "Commercial PDF", SD05: "Contract & signature" };
const pdfEmbedUrl = (value: string) => `${value.split("#")[0]}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;

function stageTitle(code: SDCode, language: RoomLanguage = "fr") {
  return language === "en" ? EN_STAGE_TITLES[code] : code === "SD04" ? "PDF commercial" : SD_STAGE_META[code].title;
}

function formatDate(value?: string | null, language: RoomLanguage = "fr") {''')
text = text.replace('''new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" })''', '''new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "long", year: "numeric" })''')

# Document component signatures and major headings.
text = text.replace('''function SD01Document({ content }: { content: SD01Content }) {''', '''function SD01Document({ content, language }: { content: SD01Content; language: RoomLanguage }) {''')
text = text.replace('''<Section title="Synthèse exécutive" kicker="SD01 · Compréhension commune">''', '''<Section title={tr(language, "Synthèse exécutive", "Executive summary")} kicker={tr(language, "SD01 · Compréhension commune", "SD01 · Shared understanding")}>''')
text = text.replace('''<SD01KeyPeoplePublic stakeholders={content.stakeholders} />''', '''<SD01KeyPeoplePublic stakeholders={content.stakeholders} language={language} />''')
text = text.replace('''<Section title="Contexte">''', '''<Section title={tr(language, "Contexte", "Context")}>''')
text = text.replace('''<Eyebrow>Secteur</Eyebrow>''', '''<Eyebrow>{tr(language, "Secteur", "Industry")}</Eyebrow>''')
text = text.replace('''<Eyebrow>Entreprise</Eyebrow>''', '''<Eyebrow>{tr(language, "Entreprise", "Company")}</Eyebrow>''')
text = text.replace('''<Section title="Enjeux prioritaires">''', '''<Section title={tr(language, "Enjeux prioritaires", "Priority challenges")}>''')
text = text.replace('''<Section title="Réponse envisagée">''', '''<Section title={tr(language, "Réponse envisagée", "Proposed response")}>''')
text = text.replace('''<Section title="Décisions et prochaines étapes"><PairGrid leftTitle="Décisions"''', '''<Section title={tr(language, "Décisions et prochaines étapes", "Decisions and next steps")}><PairGrid leftTitle={tr(language, "Décisions", "Decisions")}''')
text = text.replace('''rightTitle="Prochaines actions"''', '''rightTitle={tr(language, "Prochaines actions", "Next actions")}''', 1)

text = text.replace('''function SD02Document({ content }: { content: SD02Content }) {''', '''function SD02Document({ content, language }: { content: SD02Content; language: RoomLanguage }) {''')
text = text.replace('''<Section title="Plan d’action" kicker="SD02 · Les étapes à franchir ensemble">''', '''<Section title={tr(language, "Plan d’action", "Action plan")} kicker={tr(language, "SD02 · Les étapes à franchir ensemble", "SD02 · Steps to complete together")}>''')
text = text.replace('''<Eyebrow>Responsable</Eyebrow>''', '''<Eyebrow>{tr(language, "Responsable", "Owner")}</Eyebrow>''')
text = text.replace('''<Eyebrow>Échéance</Eyebrow>''', '''<Eyebrow>{tr(language, "Échéance", "Due date")}</Eyebrow>''')
text = text.replace('''{formatDate(item.dueDate) || "À définir"}''', '''{formatDate(item.dueDate, language) || tr(language, "À définir", "To define")}''')

text = text.replace('''function SD03Document({ content }: { content: SD03Content }) {''', '''function SD03Document({ content, language }: { content: SD03Content; language: RoomLanguage }) {''')
for old, new in [
('''<Section title="Solution retenue" kicker="SD03 · Solution & intégration">''', '''<Section title={tr(language, "Solution retenue", "Selected solution")} kicker={tr(language, "SD03 · Solution & intégration", "SD03 · Solution & integration")}>'''),
('''<Section title="Périmètre"><PairGrid leftTitle="Inclus"''', '''<Section title={tr(language, "Périmètre", "Scope")}><PairGrid leftTitle={tr(language, "Inclus", "Included")}'''),
('''rightTitle="Hors périmètre"''', '''rightTitle={tr(language, "Hors périmètre", "Out of scope")}'''),
('''<Section title="Intégration"><PairGrid leftTitle="Intégrations"''', '''<Section title={tr(language, "Intégration", "Integration")}><PairGrid leftTitle={tr(language, "Intégrations", "Integrations")}'''),
('''rightTitle="Données nécessaires"''', '''rightTitle={tr(language, "Données nécessaires", "Required data")}'''),
('''<Section title="Pilote">''', '''<Section title={tr(language, "Pilote", "Pilot")}>'''),
('''<Section title="Déploiement"><PairGrid leftTitle="Sécurité & conformité"''', '''<Section title={tr(language, "Déploiement", "Deployment")}><PairGrid leftTitle={tr(language, "Sécurité & conformité", "Security & compliance")}'''),
('''rightTitle="Plan de déploiement"''', '''rightTitle={tr(language, "Plan de déploiement", "Deployment plan")}''')]:
    text = text.replace(old, new, 1)

text = text.replace('''function SD04Document({ content }: { content: SD04Content }) {''', '''function SD04Document({ content, language }: { content: SD04Content; language: RoomLanguage }) {''')
text = text.replace('''<Section title="Document commercial" kicker="SD04 · PDF commercial">''', '''<Section title={tr(language, "Document commercial", "Commercial document")} kicker="SD04 · PDF">''')
text = text.replace('''<iframe src={pdfUrl} title={fileName}''', '''<iframe src={pdfEmbedUrl(pdfUrl)} title={fileName}''')
text = text.replace('''Document PDF partagé par Gando''', '''{tr(language, "Document PDF partagé par Gando", "PDF document shared by Gando")}''')
text = text.replace('''> Ouvrir en plein écran</a>''', '''> {tr(language, "Ouvrir en plein écran", "Open full screen")}</a>''')

# Replace SD05 + DocumentBody as one block to avoid fragile nested edits.
pattern = re.compile(r'''function SD05Document\(\{ content \}: \{ content: SD05Content \}\) \{.*?\n\}\n\nfunction DocumentBody\(\{ document \}: \{ document: PublicDocument \}\) \{.*?\n\}''', re.S)
replacement = '''function SD05Document({ content, language, onDownloadPdf, downloadingPdf }: { content: SD05Content; language: RoomLanguage; onDownloadPdf: () => void; downloadingPdf: boolean }) {
  const signed = content.contractStatus === "signed";
  const ready = content.contractStatus === "ready_to_sign";
  return <div className="space-y-5 sm:space-y-6"><Section title={content.contractTitle || tr(language, "Contrat", "Contract")} kicker={tr(language, "SD05 · Contrat & signature", "SD05 · Contract & signature")}>
    <div className="flex flex-col gap-5"><div className="flex flex-wrap items-center gap-3"><span className={`inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${signed ? "bg-[#edf7ef] text-[#376b43]" : ready ? "bg-[#f3f0ff] text-[#5c50ae]" : "bg-[#f1f3f4] text-[#60696e]"}`}>{signed ? tr(language, "Contrat signé", "Signed contract") : ready ? tr(language, "Prêt à signer", "Ready to sign") : tr(language, "Brouillon", "Draft")}</span>{content.signatureDeadline ? <span className="text-sm text-[#687277]">{tr(language, "Signature attendue avant le", "Signature due by")} {formatDate(content.signatureDeadline, language)}</span> : null}</div>{content.contractSummary ? <p className="text-[16px] leading-7 text-[#465157]">{content.contractSummary}</p> : null}<div className="flex flex-wrap gap-2">{content.contractUrl ? <a href={content.contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white"><FileSignature className="h-4 w-4" />{signed ? tr(language, "Voir le contrat signé", "View signed contract") : tr(language, "Ouvrir et signer le contrat", "Open and sign contract")}<ExternalLink className="h-4 w-4" /></a> : <p className="italic text-[#81898e]">{tr(language, "Le lien du contrat sera ajouté ici.", "The contract link will appear here.")}</p>}{signed ? <button type="button" onClick={onDownloadPdf} disabled={downloadingPdf} className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-[#cfd4d7] bg-white px-5 text-[13px] font-semibold text-[#20282d] disabled:opacity-50">{downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{tr(language, "Télécharger le PDF signé", "Download signed PDF")}</button> : null}</div></div>
  </Section>{content.signatories?.length ? <Section title={tr(language, "Signataires", "Signatories")}>{content.signatories.map((person, index) => <div key={`${person.email}-${index}`} className="flex items-center justify-between gap-4 border-b border-[#eceeef] py-3 last:border-0"><div><div className="font-semibold text-[#202a2f]">{person.name}</div><div className="text-sm text-[#687277]">{person.role}{person.email ? ` · ${person.email}` : ""}</div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${person.signatureStatus === "signed" ? "bg-[#edf7ef] text-[#376b43]" : "bg-[#f1f3f4] text-[#60696e]"}`}>{person.signatureStatus === "signed" ? tr(language, "Signé", "Signed") : person.signatureStatus === "sent" ? tr(language, "Envoyé", "Sent") : tr(language, "À signer", "To sign")}</span></div>)}</Section> : null}</div>;
}

function DocumentBody({ document, language, onDownloadPdf, downloadingPdf }: { document: PublicDocument; language: RoomLanguage; onDownloadPdf: () => void; downloadingPdf: boolean }) {
  if (document.code === "SD01") return <SD01Document content={document.content as SD01Content} language={language} />;
  if (document.code === "SD02") return <SD02Document content={document.content as unknown as SD02Content} language={language} />;
  if (document.code === "SD03") return <SD03Document content={document.content as unknown as SD03Content} language={language} />;
  if (document.code === "SD04") return <SD04Document content={document.content as unknown as SD04Content} language={language} />;
  return <SD05Document content={document.content as unknown as SD05Content} language={language} onDownloadPdf={onDownloadPdf} downloadingPdf={downloadingPdf} />;
}'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError("SD05 public block replacement failed")

# State and translation loading.
text = text.replace('''  const [data, setData] = useState<PublicRoomData | null>(null);
  const [activeStage, setActiveStage] = useState<SDCode>("SD01");''', '''  const [data, setData] = useState<PublicRoomData | null>(null);
  const [language, setLanguage] = useState<RoomLanguage>("fr");
  const [englishDocuments, setEnglishDocuments] = useState<Partial<Record<SDCode, PublicDocument>>>({});
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeStage, setActiveStage] = useState<SDCode>("SD01");''')
text = text.replace('''  const currentDocument = data?.documents.find(document => document.code === activeStage) || data?.documents[0];
  const stages = useMemo(() => SD_CODES.map(code => ({ code, document: data?.documents.find(document => document.code === code) })), [data]);''', '''  const sourceDocument = data?.documents.find(document => document.code === activeStage) || data?.documents[0];
  const currentDocument = sourceDocument && language === "en" ? englishDocuments[sourceDocument.code] || sourceDocument : sourceDocument;
  const stages = useMemo(() => SD_CODES.map(code => ({ code, document: data?.documents.find(document => document.code === code) })), [data]);

  useEffect(() => {
    if (language !== "en" || !data || !sourceDocument || englishDocuments[sourceDocument.code]) return;
    let cancelled = false;
    setTranslating(true);
    setTranslationError("");
    void fetch(`/api/public/deal-room/${encodeURIComponent(token)}/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.visitorEmail, firstName, lastName, documentCode: sourceDocument.code }),
    }).then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Translation unavailable");
      if (!cancelled && payload.document) setEnglishDocuments(current => ({ ...current, [sourceDocument.code]: payload.document }));
    }).catch(error => { if (!cancelled) setTranslationError(error instanceof Error ? error.message : "Translation unavailable"); })
      .finally(() => { if (!cancelled) setTranslating(false); });
    return () => { cancelled = true; };
  }, [data, englishDocuments, firstName, language, lastName, sourceDocument, token]);

  const downloadSignedPdf = useCallback(async () => {
    if (!data || !sourceDocument || sourceDocument.code !== "SD05" || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/sd05-pdf`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.visitorEmail, firstName, lastName }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || "Téléchargement impossible"); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "SD05-signe-Gando.pdf"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (downloadError) { setTranslationError(downloadError instanceof Error ? downloadError.message : "Téléchargement impossible"); }
    finally { setDownloadingPdf(false); }
  }, [data, downloadingPdf, firstName, lastName, sourceDocument, token]);''')

# Header toggle and main public UI copy.
old_header = '''<header className="sticky top-0 z-50 border-b border-[#e4e7e9] bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-2.5"><GandoMark className="h-8 w-8 shrink-0" /><span className="hidden text-sm font-semibold sm:inline">Gando</span><span className="text-[#b5bbc0]">/</span><span className="truncate text-sm font-medium text-[#4c565b]">{data.room.companyName}</span></div><div className="ml-auto hidden items-center gap-2 text-[12px] text-[#737c81] sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> Room privée</div><div className="h-7 w-px bg-[#e2e5e7]" /><div className="text-right text-[11px] leading-4 text-[#737c81]"><div className="font-semibold text-[#384247]">{firstName} {lastName}</div><div className="hidden sm:block">{data.visitorEmail}</div></div></div></header>'''
new_header = '''<header className="sticky top-0 z-50 border-b border-[#e4e7e9] bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-2.5"><GandoMark className="h-8 w-8 shrink-0" /><span className="hidden text-sm font-semibold sm:inline">Gando</span><span className="text-[#b5bbc0]">/</span><span className="truncate text-sm font-medium text-[#4c565b]">{data.room.companyName}</span></div><div className="ml-auto flex items-center gap-2"><div className="inline-flex items-center rounded-lg border border-[#dfe3e5] bg-[#f7f8f8] p-0.5 text-[11px] font-bold"><button type="button" onClick={() => setLanguage("fr")} className={`rounded-md px-2.5 py-1.5 ${language === "fr" ? "bg-white text-[#202a2f] shadow-sm" : "text-[#7a8388]"}`}>FR</button><button type="button" onClick={() => setLanguage("en")} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 ${language === "en" ? "bg-white text-[#202a2f] shadow-sm" : "text-[#7a8388]"}`}><Languages className="h-3 w-3" /> EN</button></div>{translating ? <Loader2 className="h-4 w-4 animate-spin text-[#6558c8]" /> : null}<div className="hidden items-center gap-2 text-[12px] text-[#737c81] sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> {tr(language, "Room privée", "Private room")}</div><div className="h-7 w-px bg-[#e2e5e7]" /><div className="text-right text-[11px] leading-4 text-[#737c81]"><div className="font-semibold text-[#384247]">{firstName} {lastName}</div><div className="hidden sm:block">{data.visitorEmail}</div></div></div></div></header>'''
if old_header not in text:
    raise RuntimeError("public header anchor missing")
text = text.replace(old_header, new_header, 1)
text = text.replace('''subtitle={data.room.displaySubtitle || "Espace de collaboration stratégique"}''', '''subtitle={language === "en" ? "Strategic collaboration space" : data.room.displaySubtitle || "Espace de collaboration stratégique"}''')
text = text.replace('''>Parcours</div>''', '''>{tr(language, "Parcours", "Journey")}</div>''', 1)
text = text.replace('''{stageTitle(code)}</span><span className="mt-0.5 block text-[11px] text-[#747e83]">{optional ? "Facultatif · " : "Obligatoire · "}{document?.status === "validated" ? "Validé" : document?.status === "published" ? "À valider" : "À venir"}''', '''{stageTitle(code, language)}</span><span className="mt-0.5 block text-[11px] text-[#747e83]">{optional ? tr(language, "Facultatif · ", "Optional · ") : tr(language, "Obligatoire · ", "Required · ")}{document?.status === "validated" ? tr(language, "Validé", "Validated") : document?.status === "published" ? tr(language, "À valider", "To validate") : tr(language, "À venir", "Upcoming")}''')
text = text.replace('''{OPTIONAL_CODES.includes(currentDocument.code) ? " · Facultatif" : " · Obligatoire"}</Eyebrow><h2 className="mt-1 text-[30px] font-semibold tracking-[-0.035em] text-[#182227]">{stageTitle(currentDocument.code)}</h2>''', '''{OPTIONAL_CODES.includes(currentDocument.code) ? tr(language, " · Facultatif", " · Optional") : tr(language, " · Obligatoire", " · Required")}</Eyebrow><h2 className="mt-1 text-[30px] font-semibold tracking-[-0.035em] text-[#182227]">{stageTitle(currentDocument.code, language)}</h2>''')
text = text.replace('''>{currentDocument.status === "validated" ? "Validé" : "À valider"}</span></div>
        <DocumentBody document={currentDocument} />''', '''>{currentDocument.status === "validated" ? tr(language, "Validé", "Validated") : tr(language, "À valider", "To validate")}</span></div>
        {translationError && language === "en" ? <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{translationError}</div> : null}
        <DocumentBody document={currentDocument} language={language} onDownloadPdf={() => void downloadSignedPdf()} downloadingPdf={downloadingPdf} />''')
text = text.replace('''<div className="font-semibold text-[#24302c]">Cette étape est validée</div>''', '''<div className="font-semibold text-[#24302c]">{tr(language, "Cette étape est validée", "This stage is validated")}</div>''')
text = text.replace('''{validatedBy ? `Validée par ${validatedBy}` : "Validation enregistrée"}{currentDocument.validated_at ? ` · ${formatDate(currentDocument.validated_at)}` : ""}.''', '''{validatedBy ? `${tr(language, "Validée par", "Validated by")} ${validatedBy}` : tr(language, "Validation enregistrée", "Validation recorded")}{currentDocument.validated_at ? ` · ${formatDate(currentDocument.validated_at, language)}` : ""}.''')
text = text.replace('''<Eyebrow>Validation</Eyebrow><h3 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-[#202a2f]">Confirmez-vous le contenu de cette étape ?</h3><p className="mt-2 text-[14px] leading-6 text-[#6b757a]">La validation enregistre votre accord sur cette version.</p>''', '''<Eyebrow>{tr(language, "Validation", "Validation")}</Eyebrow><h3 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-[#202a2f]">{tr(language, "Confirmez-vous le contenu de cette étape ?", "Do you confirm the content of this stage?")}</h3><p className="mt-2 text-[14px] leading-6 text-[#6b757a]">{tr(language, "La validation enregistre votre accord sur cette version.", "Validation records your approval of this version.")}</p>''')
text = text.replace(''' Valider {currentDocument.code}</button>''', ''' {tr(language, "Valider", "Validate")} {currentDocument.code}</button>''')
text = text.replace('''<h3 className="text-[15px] font-semibold text-[#263136]">Ajouter une remarque</h3>''', '''<h3 className="text-[15px] font-semibold text-[#263136]">{tr(language, "Ajouter une remarque", "Add a comment")}</h3>''')
text = text.replace('''Question, correction ou point à confirmer : votre message sera rattaché à {currentDocument.code}.''', '''{tr(language, "Question, correction ou point à confirmer : votre message sera rattaché à", "Question, correction or point to confirm: your message will be attached to")} {currentDocument.code}.''')
text = text.replace('''placeholder="Écrivez votre remarque…"''', '''placeholder={tr(language, "Écrivez votre remarque…", "Write your comment…")}''')
text = text.replace('''>Attribué à {firstName} {lastName}</span>''', '''>{tr(language, "Attribué à", "Attributed to")} {firstName} {lastName}</span>''')
text = text.replace('''{commentState === "sent" ? "Envoyé" : "Envoyer"}''', '''{commentState === "sent" ? tr(language, "Envoyé", "Sent") : tr(language, "Envoyer", "Send")}''')
text = text.replace('''>Document confidentiel · {data.room.companyName} × Gando</footer>''', '''>{tr(language, "Document confidentiel", "Confidential document")} · {data.room.companyName} × Gando</footer>''')
path.write_text(text)

print("room/contract polish applied")

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Make the concise banner subtitle the default everywhere in runtime sources.
for base in [ROOT / "app", ROOT / "components", ROOT / "lib"]:
    for path in base.rglob("*.ts*"):
        text = path.read_text()
        if "Espace de collaboration stratégique" in text:
            path.write_text(text.replace("Espace de collaboration stratégique", "Espace de collaboration"))

# Public Room: translate the complete interface/structured labels to English while preserving authored deal content.
p = ROOT / "components/public-sd-room-v6.tsx"
text = p.read_text()
text = text.replace('function formatDate(value?: string | null) {\n  if (!value) return "";\n  try {\n    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));', 'function formatDate(value?: string | null, language: RoomLanguage = "fr") {\n  if (!value) return "";\n  try {\n    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));')
text = text.replace('function stageStatus(status: string) {\n  if (status === "done") return { label: "Terminé", classes: "bg-[#edf7ef] text-[#376b43]" };\n  if (status === "in_progress") return { label: "En cours", classes: "bg-[#f3f0ff] text-[#5c50ae]" };\n  return { label: "À faire", classes: "bg-[#f1f3f4] text-[#60696e]" };\n}', 'function stageStatus(status: string, language: RoomLanguage) {\n  if (status === "done") return { label: tr(language, "Terminé", "Done"), classes: "bg-[#edf7ef] text-[#376b43]" };\n  if (status === "in_progress") return { label: tr(language, "En cours", "In progress"), classes: "bg-[#f3f0ff] text-[#5c50ae]" };\n  return { label: tr(language, "À faire", "To do"), classes: "bg-[#f1f3f4] text-[#60696e]" };\n}')
text = text.replace('function SD01Document({ content }: { content: SD01Content }) {', 'function SD01Document({ content, language }: { content: SD01Content; language: RoomLanguage }) {')
text = text.replace('<Section title="Synthèse exécutive" kicker="SD01 · Compréhension commune"><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.executiveSummary || "Synthèse en cours de validation."}</p></Section>', '<Section title={tr(language, "Synthèse exécutive", "Executive summary")} kicker={tr(language, "SD01 · Compréhension commune", "SD01 · Shared understanding")}><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.executiveSummary || tr(language, "Synthèse en cours de validation.", "Summary pending approval.")}</p></Section>')
text = text.replace('<SD01KeyPeoplePublic stakeholders={content.stakeholders} />', '<SD01KeyPeoplePublic stakeholders={content.stakeholders} language={language} />')
text = text.replace('<Section title="Contexte"><div className="grid gap-5 sm:grid-cols-[170px_1fr]"><div><Eyebrow>Secteur</Eyebrow>', '<Section title={tr(language, "Contexte", "Context")}><div className="grid gap-5 sm:grid-cols-[170px_1fr]"><div><Eyebrow>{tr(language, "Secteur", "Industry")}</Eyebrow>')
text = text.replace('<div><Eyebrow>Entreprise</Eyebrow>', '<div><Eyebrow>{tr(language, "Entreprise", "Company")}</Eyebrow>')
text = text.replace('<Section title="Enjeux prioritaires">', '<Section title={tr(language, "Enjeux prioritaires", "Top priorities")}>')
text = text.replace('<Section title="Réponse envisagée">', '<Section title={tr(language, "Réponse envisagée", "Proposed response")}>')
text = text.replace('<Section title="Décisions et prochaines étapes"><PairGrid leftTitle="Décisions"', '<Section title={tr(language, "Décisions et prochaines étapes", "Decisions & next steps")}><PairGrid leftTitle={tr(language, "Décisions", "Decisions")}')
text = text.replace('rightTitle="Prochaines actions"', 'rightTitle={tr(language, "Prochaines actions", "Next actions")}')
text = text.replace('`${step.owner || "À définir"} — ${step.action}${step.dueDate ? ` · ${formatDate(step.dueDate)}` : ""}`', '`${step.owner || tr(language, "À définir", "TBD")} — ${step.action}${step.dueDate ? ` · ${formatDate(step.dueDate, language)}` : ""}`')

text = text.replace('function SD02Document({ content }: { content: SD02Content }) {', 'function SD02Document({ content, language }: { content: SD02Content; language: RoomLanguage }) {')
text = text.replace('<Section title="Plan d’action" kicker="SD02 · Les étapes à franchir ensemble">', '<Section title={tr(language, "Plan d’action", "Action plan")} kicker={tr(language, "SD02 · Les étapes à franchir ensemble", "SD02 · Steps to complete together")}>')
text = text.replace('const status = stageStatus(item.status);', 'const status = stageStatus(item.status, language);')
text = text.replace('<Eyebrow>Responsable</Eyebrow>', '<Eyebrow>{tr(language, "Responsable", "Owner")}</Eyebrow>')
text = text.replace('{item.owner || "À définir"}', '{item.owner || tr(language, "À définir", "TBD")}')
text = text.replace('<Eyebrow>Échéance</Eyebrow>', '<Eyebrow>{tr(language, "Échéance", "Due date")}</Eyebrow>')
text = text.replace('{formatDate(item.dueDate) || "À définir"}', '{formatDate(item.dueDate, language) || tr(language, "À définir", "TBD")}')
text = text.replace('<strong>Dépendance :</strong>', '<strong>{tr(language, "Dépendance :", "Dependency:")}</strong>')
text = text.replace('>Aucune étape définie.</p>', '>{tr(language, "Aucune étape définie.", "No step defined yet.")}</p>')

text = text.replace('function SD03Document({ content }: { content: SD03Content }) {', 'function SD03Document({ content, language }: { content: SD03Content; language: RoomLanguage }) {')
for old, new in [
('title="Solution retenue" kicker="SD03 · Solution & intégration"', 'title={tr(language, "Solution retenue", "Selected solution")} kicker={tr(language, "SD03 · Solution & intégration", "SD03 · Solution & integration")}'),
('title="Périmètre"', 'title={tr(language, "Périmètre", "Scope")}'),
('leftTitle="Inclus"', 'leftTitle={tr(language, "Inclus", "Included")}'),
('rightTitle="Hors périmètre"', 'rightTitle={tr(language, "Hors périmètre", "Out of scope")}'),
('title="Intégration"', 'title={tr(language, "Intégration", "Integration")}'),
('leftTitle="Intégrations"', 'leftTitle={tr(language, "Intégrations", "Integrations")}'),
('rightTitle="Données nécessaires"', 'rightTitle={tr(language, "Données nécessaires", "Required data")}'),
('title="Pilote"', 'title={tr(language, "Pilote", "Pilot")}'),
('>Périmètre</Eyebrow>', '>{tr(language, "Périmètre", "Scope")}</Eyebrow>'),
('>Durée</Eyebrow>', '>{tr(language, "Durée", "Duration")}</Eyebrow>'),
('>Critères de succès</Eyebrow>', '>{tr(language, "Critères de succès", "Success criteria")}</Eyebrow>'),
('title="Déploiement"', 'title={tr(language, "Déploiement", "Rollout")}'),
('leftTitle="Sécurité & conformité"', 'leftTitle={tr(language, "Sécurité & conformité", "Security & compliance")}'),
('rightTitle="Plan de déploiement"', 'rightTitle={tr(language, "Plan de déploiement", "Rollout plan")}'),
]: text = text.replace(old, new)

text = text.replace('function SD04Document({ content }: { content: SD04Content }) {', 'function SD04Document({ content, language }: { content: SD04Content; language: RoomLanguage }) {')
text = text.replace('<Section title="Document commercial" kicker="SD04 · PDF commercial">', '<Section title={tr(language, "Document commercial", "Commercial document")} kicker={tr(language, "SD04 · PDF commercial", "SD04 · Commercial PDF")}>')
text = text.replace('Document PDF partagé par Gando', '{tr(language, "Document PDF partagé par Gando", "PDF shared by Gando")}')
text = text.replace(' /> Ouvrir en plein écran</a>', ' /> {tr(language, "Ouvrir en plein écran", "Open full screen")}</a>')
text = text.replace('Ouvrez le PDF en plein écran pour une lecture confortable.', '{tr(language, "Ouvrez le PDF en plein écran pour une lecture confortable.", "Open the PDF full screen for comfortable reading.")}')
text = text.replace('>Aucun PDF n’a encore été publié.</p>', '>{tr(language, "Aucun PDF n’a encore été publié.", "No PDF has been published yet.")}</p>')

text = text.replace('<Section title={content.contractTitle || "Contrat"} kicker="SD05 · Contrat & signature">', '<Section title={content.contractTitle || tr(language, "Contrat", "Contract")} kicker={tr(language, "SD05 · Contrat & signature", "SD05 · Contract & signature")}>')
text = text.replace('{signed ? "Contrat signé" : ready ? "Prêt à signer" : "Brouillon"}', '{signed ? tr(language, "Contrat signé", "Signed contract") : ready ? tr(language, "Prêt à signer", "Ready to sign") : tr(language, "Brouillon", "Draft")}')
text = text.replace('Signature attendue avant le {formatDate(content.signatureDeadline)}', '{tr(language, "Signature attendue avant le", "Signature due by")} {formatDate(content.signatureDeadline, language)}')
text = text.replace('<Section title="Signataires">', '<Section title={tr(language, "Signataires", "Signatories")}>')
text = text.replace('{person.signatureStatus === "signed" ? "Signé" : person.signatureStatus === "sent" ? "Envoyé" : "À signer"}', '{person.signatureStatus === "signed" ? tr(language, "Signé", "Signed") : person.signatureStatus === "sent" ? tr(language, "Envoyé", "Sent") : tr(language, "À signer", "To sign")}')

text = text.replace('if (document.code === "SD01") return <SD01Document content={document.content as SD01Content} />;', 'if (document.code === "SD01") return <SD01Document content={document.content as SD01Content} language={language} />;')
text = text.replace('if (document.code === "SD02") return <SD02Document content={document.content as unknown as SD02Content} />;', 'if (document.code === "SD02") return <SD02Document content={document.content as unknown as SD02Content} language={language} />;')
text = text.replace('if (document.code === "SD03") return <SD03Document content={document.content as unknown as SD03Content} />;', 'if (document.code === "SD03") return <SD03Document content={document.content as unknown as SD03Content} language={language} />;')
text = text.replace('if (document.code === "SD04") return <SD04Document content={document.content as unknown as SD04Content} />;', 'if (document.code === "SD04") return <SD04Document content={document.content as unknown as SD04Content} language={language} />;')
p.write_text(text)

# Public key-people card labels also respect Room language.
p = ROOT / "components/sd01-key-people-public.tsx"
text = p.read_text()
text = text.replace('export function SD01KeyPeoplePublic({ stakeholders }: { stakeholders: Stakeholder[] }) {', 'export function SD01KeyPeoplePublic({ stakeholders, language = "fr" }: { stakeholders: Stakeholder[]; language?: "fr" | "en" }) {')
text = text.replace('>Interlocuteurs & décideurs</div>', '>{language === "en" ? "Stakeholders & decision-makers" : "Interlocuteurs & décideurs"}</div>')
text = text.replace('>Personnes clés</h2>', '>{language === "en" ? "Key people" : "Personnes clés"}</h2>')
text = text.replace('{people.length} personne{people.length > 1 ? "s" : ""}', '{people.length} {language === "en" ? `person${people.length > 1 ? "s" : ""}` : `personne${people.length > 1 ? "s" : ""}`}')
text = text.replace('{person.name || "Interlocuteur à confirmer"}', '{person.name || (language === "en" ? "Stakeholder to confirm" : "Interlocuteur à confirmer")}')
p.write_text(text)

print("Final room polish applied")

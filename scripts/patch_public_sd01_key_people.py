from pathlib import Path

path = Path(__file__).resolve().parents[1] / "components/public-sd-room-v6.tsx"
text = path.read_text()

import_anchor = 'import { GandoMark } from "@/components/gando-mark";\n'
import_line = 'import { SD01KeyPeoplePublic } from "@/components/sd01-key-people-public";\n'
if import_line not in text:
    if import_anchor not in text:
        raise RuntimeError("Public Room import anchor not found")
    text = text.replace(import_anchor, import_anchor + import_line, 1)

summary_anchor = '    <Section title="Synthèse exécutive" kicker="SD01 · Compréhension commune"><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.executiveSummary || "Synthèse en cours de validation."}</p></Section>\n'
people_line = '    {content.stakeholders?.length ? <SD01KeyPeoplePublic stakeholders={content.stakeholders} /> : null}\n'
if people_line not in text:
    if summary_anchor not in text:
        raise RuntimeError("SD01 summary anchor not found")
    text = text.replace(summary_anchor, summary_anchor + people_line, 1)

path.write_text(text)
print("Public SD01 key people section applied")

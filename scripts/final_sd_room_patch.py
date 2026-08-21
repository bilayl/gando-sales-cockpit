from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def patch(path, pattern, replacement):
    target = ROOT / path
    text = target.read_text()
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, got {count}")
    target.write_text(next_text)

# Keep renderer pagination consistent with the server's legacy page-count algorithm:
# H2/H3/H4 change visual hierarchy only, not page-weight semantics.
patch(
    "components/sd05-contract-renderer.tsx",
    r'function weight\(block: RenderBlock\) \{.*?\n\}',
    '''function weight(block: RenderBlock) {
  if (["major", "article"].includes(block.kind)) return 1.35 + Math.ceil(block.text.length / 520) * 0.25;
  if (block.kind === "subsection") return 0.9 + Math.ceil(block.text.length / 600) * 0.3;
  return Math.max(0.7, Math.ceil(block.text.length / 520) * 0.85);
}'''
)

# Make the public SD04 reader match the cleaner cockpit reader.
patch(
    "components/public-sd-room-v6.tsx",
    r'function SD04Document\(\{ content \}: \{ content: SD04Content \}\) \{.*?\n\}\n\nfunction SD05Document',
    '''function SD04Document({ content }: { content: SD04Content }) {
  const pdfUrl = /^https?:\\/\\//i.test(content.deckSubtitle || "") ? content.deckSubtitle : "";
  const fileName = content.deckTitle || "Offre commerciale.pdf";
  return <div className="space-y-5 sm:space-y-6"><Section title="Document commercial" kicker="SD04 · PDF commercial">
    {pdfUrl ? <div className="overflow-hidden rounded-[16px] border border-[#d9dee1] bg-[#eef0f2] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[#20282d] px-4 py-3 text-white sm:flex-row sm:items-center">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><FileText className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{fileName}</div><div className="mt-0.5 text-[11px] text-white/55">Document PDF partagé par Gando</div></div>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-[#20282d]"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir en plein écran</a>
      </div>
      <div className="p-2 sm:p-4"><iframe src={pdfUrl} title={fileName} className="hidden h-[780px] w-full rounded-lg border border-[#d9dee1] bg-white md:block" /><div className="grid min-h-40 place-items-center rounded-lg bg-white p-6 text-center md:hidden"><div><FileText className="mx-auto h-8 w-8 text-[#7166c7]" /><p className="mt-3 text-sm text-[#687277]">Ouvrez le PDF en plein écran pour une lecture confortable.</p></div></div></div>
    </div> : <p className="italic text-[#81898e]">Aucun PDF n’a encore été publié.</p>}
  </Section></div>;
}

function SD05Document'''
)

# Clarify exactly where the public hero subtitle can be edited.
path = ROOT / "components/sd-room-branding-editor-v2.tsx"
text = path.read_text()
old = '<div><Label>Sous-titre</Label><textarea value={subtitle}'
if old not in text:
    raise RuntimeError("Branding subtitle label anchor missing")
path.write_text(text.replace(old, '<div><Label>Sous-titre de la bannière</Label><textarea value={subtitle}', 1))

print("final SD room patch applied")

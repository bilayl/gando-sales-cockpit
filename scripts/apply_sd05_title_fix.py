from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# SD05 builder: formatting applies to the current line instead of appending markers at the end.
path = ROOT / "components/sd05-contract-builder.tsx"
text = path.read_text()
if "function ContractTextEditor" not in text:
    text = text.replace(
        'import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";',
        'import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
        1,
    )

    area_anchor = r'''function Area({ value, onChange, rows = 5, placeholder, disabled = false }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string; disabled?: boolean }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} disabled={disabled} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60" />;
}
'''
    if area_anchor not in text:
        raise RuntimeError("Area anchor not found")

    editor_component = area_anchor + r'''
function ContractTextEditor({ value, onChange, disabled, onAddAnnex }: { value: string; onChange: (value: string) => void; disabled: boolean; onAddAnnex: () => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (prefix: "" | "## " | "### " | "#### ") => {
    const textarea = ref.current;
    if (!textarea) return;
    const cursorStart = textarea.selectionStart ?? value.length;
    const cursorEnd = textarea.selectionEnd ?? cursorStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, cursorStart - 1)) + 1;
    const nextBreak = value.indexOf("\n", cursorEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const currentLine = value.slice(lineStart, lineEnd);
    const cleaned = currentLine.replace(/^\s*(?:H[234]:\s*|#{2,4}\s+)/i, "").trimStart();
    const replacement = `${prefix}${cleaned}`;
    onChange(`${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`);
    requestAnimationFrame(() => {
      const nextCursor = lineStart + replacement.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
    {!disabled ? <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/25 p-2">
      <span className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Style de la ligne</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => applyFormat("")}>Texte</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyFormat("## ")}>Titre H2</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyFormat("### ")}>Sous-titre H3</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => applyFormat("#### ")}>Sous-section H4</Button>
      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onAddAnnex}>+ Annexe</Button>
    </div> : null}
    <textarea
      ref={ref}
      value={value}
      onChange={event => onChange(event.target.value)}
      rows={34}
      disabled={disabled}
      placeholder={"## ARTICLE 1 — OBJET\nLe présent article définit…\n\n### 1.1 Périmètre\nLe périmètre comprend…\n\n#### Modalités pratiques\nLes modalités sont…"}
      className="w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-[13px] leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60"
    />
    <div className="border-t border-border bg-muted/15 px-4 py-2 text-[11px] leading-5 text-muted-foreground">Place le curseur sur une ligne puis choisis son niveau. Les symboles de structure ne sont jamais affichés dans le contrat final. H2 = titre, H3 = sous-titre, H4 = sous-section.</div>
  </div>;
}
'''
    text = text.replace(area_anchor, editor_component, 1)
    text = re.sub(r'\n\s*const appendHeading = \(prefix: "H2:" \| "H3:" \| "H4:"\) => .*?;\n', '\n', text, count=1)

    pattern = re.compile(
        r'\s*<Card className="space-y-4 p-5"><div><h2 className="font-semibold">Texte du contrat</h2>.*?</Card>\n\n\s*<Card className="space-y-4 p-5"><div><h2 className="font-semibold">Pied de page & confidentialité</h2>',
        re.S,
    )
    replacement = r'''
      <Card className="space-y-4 p-5">
        <div><h2 className="font-semibold">Texte du contrat</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Éditeur structuré : applique directement un niveau à la ligne courante. Un titre ou un sous-titre reste distinct du paragraphe qui suit, même sans ligne vide. « ARTICLE », « 3.1. » et « ANNEXE » restent également reconnus.</p></div>
        <ContractTextEditor disabled={locked} value={value.contractSummary} onChange={next => set("contractSummary", next)} onAddAnnex={addAnnex} />
      </Card>

      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Pied de page & confidentialité</h2>'''
    text, count = pattern.subn(lambda _match: replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"Contract editor card replacement failed: {count}")
    path.write_text(text)

# SD05 renderer: a heading line cannot absorb the paragraph below it.
path = ROOT / "components/sd05-contract-renderer.tsx"
text = path.read_text()
if "function renderSegments(raw: string)" not in text:
    pattern = re.compile(r'function paginate\(body: string\): RenderBlock\[\]\[\] \{.*?\n\}\n\nfunction ContractBlock', re.S)
    replacement = r'''function renderSegments(raw: string): RenderBlock[] {
  const result: RenderBlock[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    result.push({ kind: "paragraph", text: paragraph.join("\n").trim() });
    paragraph = [];
  };
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); continue; }
    const kind = blockKind(trimmed);
    if (kind === "paragraph") paragraph.push(trimmed);
    else {
      flushParagraph();
      result.push({ kind, text: displayText(trimmed) });
    }
  }
  flushParagraph();
  return result;
}

function paginate(body: string): RenderBlock[][] {
  // Preserve the legacy page grouping used by existing signing invitations,
  // but render headings and their following paragraphs as separate visual blocks.
  const rawBlocks = body.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  if (!rawBlocks.length) return [[]];
  const pages: string[][] = [];
  let page: string[] = [];
  let used = 0;
  for (const raw of rawBlocks) {
    const legacyBlock: RenderBlock = { kind: blockKind(raw), text: displayText(raw) };
    const next = weight(legacyBlock);
    if (page.length && used + next > 6.2) { pages.push(page); page = []; used = 0; }
    page.push(raw);
    used += next;
  }
  if (page.length) pages.push(page);
  return pages.map(items => items.flatMap(renderSegments));
}

function ContractBlock'''
    text, count = pattern.subn(lambda _match: replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"Renderer pagination replacement failed: {count}")
    path.write_text(text)

print("SD05 title hierarchy fixes applied")

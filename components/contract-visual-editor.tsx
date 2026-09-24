"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  FilePlus2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Table2,
  Underline,
  Undo2,
} from "lucide-react";
import { contractTextToHtml, rentalCoverHtml, sanitizeContractHtml } from "@/lib/contract-rich-text";
import type { SD05Content } from "@/lib/sd-stage-content";

type Props = {
  value: string;
  fallbackText: string;
  content: SD05Content;
  companyName: string;
  disabled?: boolean;
  onChange: (html: string) => void;
};

const PAGE_BREAK = '<div data-page-break="true"></div>';

function splitPages(value: string, fallbackText: string) {
  const html = sanitizeContractHtml(value || contractTextToHtml(fallbackText));
  const pages = html
    .split(/<div\b[^>]*data-page-break\s*=\s*["']?true["']?[^>]*>\s*<\/div>/gi)
    .map(page => page.trim())
    .filter((page, index, array) => page || array.length === 1);
  return pages.length ? pages : ["<p><br></p>"];
}

function ToolbarButton({
  title,
  active,
  disabled,
  onMouseDown,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={onMouseDown}
    className={`grid h-8 w-8 place-items-center rounded-md border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent"}`}
  >
    {children}
  </button>;
}

export function ContractVisualEditor({ value, fallbackText, content, companyName, disabled = false, onChange }: Props) {
  const [pages, setPages] = useState(() => splitPages(value, fallbackText));
  const [activePage, setActivePage] = useState(0);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const savedRange = useRef<Range | null>(null);
  const externalValue = useRef(value);

  const showCover = content.contractTemplate === "rental_exact";
  const cover = useMemo(() => showCover ? rentalCoverHtml(content, companyName) : "", [content, companyName, showCover]);

  useEffect(() => {
    if (value === externalValue.current) return;
    externalValue.current = value;
    setPages(splitPages(value, fallbackText));
    setActivePage(0);
  }, [value, fallbackText]);

  const emit = (nextPages: string[]) => {
    const next = nextPages.map(page => sanitizeContractHtml(page)).join(PAGE_BREAK);
    externalValue.current = next;
    onChange(next);
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    const editor = pageRefs.current[activePage];
    if (!selection || !selection.rangeCount || !editor) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const editor = pageRefs.current[activePage];
    if (!editor) return;
    editor.focus();
    if (!savedRange.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
  };

  const syncPage = (index = activePage) => {
    const editor = pageRefs.current[index];
    if (!editor) return;
    setPages(current => {
      const next = [...current];
      next[index] = editor.innerHTML;
      emit(next);
      return next;
    });
  };

  const command = (name: string, argument?: string) => {
    if (disabled) return;
    restoreSelection();
    document.execCommand(name, false, argument);
    rememberSelection();
    queueMicrotask(() => syncPage());
  };

  const insertTable = () => {
    command("insertHTML", `
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tbody>
          <tr><td style="border:1px solid #cbd5e1;padding:8px">Cellule</td><td style="border:1px solid #cbd5e1;padding:8px">Cellule</td></tr>
          <tr><td style="border:1px solid #cbd5e1;padding:8px">Cellule</td><td style="border:1px solid #cbd5e1;padding:8px">Cellule</td></tr>
        </tbody>
      </table><p><br></p>`);
  };

  const addPage = () => {
    if (disabled) return;
    setPages(current => {
      const next = [...current];
      next.splice(activePage + 1, 0, "<p><br></p>");
      emit(next);
      return next;
    });
    setActivePage(current => current + 1);
  };

  const removePage = (index: number) => {
    if (disabled || pages.length <= 1) return;
    setPages(current => {
      const next = current.filter((_, pageIndex) => pageIndex !== index);
      emit(next);
      return next;
    });
    setActivePage(current => Math.max(0, Math.min(current > index ? current - 1 : current, pages.length - 2)));
  };

  const toolbarMouseDown = (callback: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    callback();
  };

  return <div className="overflow-hidden rounded-2xl border border-border bg-[#eef0f2]">
    <style>{`
      .contract-visual-cover .contract-cover {
        width: 794px; min-height: 1123px; padding: 72px 68px 62px; position: relative; background: white; color: #111827;
        font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.42;
      }
      .contract-visual-cover .brand-band { position:absolute; left:0; right:0; top:0; height:46px; background:#b6adf6; }
      .contract-visual-cover .gando-round { position:absolute; left:50%; top:27px; transform:translateX(-50%); width:42px; height:42px; border-radius:999px; border:5px solid white; background:#b6adf6; color:white; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:22px; }
      .contract-visual-cover .cover-head { display:grid; grid-template-columns:1fr 1fr; gap:42px; margin-top:8px; align-items:start; }
      .contract-visual-cover .gando-title { font-size:30px; font-weight:800; letter-spacing:-1px; }
      .contract-visual-cover .contract-meta { text-align:right; font-size:12px; }
      .contract-visual-cover .contract-name { font-size:22px; margin-bottom:12px; }
      .contract-visual-cover .contract-name strong, .contract-visual-cover .party-grid h3, .contract-visual-cover .pricing-box h3 { color:#6437cc; }
      .contract-visual-cover .party-grid { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:34px; }
      .contract-visual-cover .party-grid h3 { font-size:16px; margin:0 0 14px; }
      .contract-visual-cover .party-grid p { margin:0; font-size:12px; line-height:1.38; }
      .contract-visual-cover .party-right { text-align:right; }
      .contract-visual-cover .service-title { color:#0d2c4a; font-size:16px; margin:30px 0 14px; font-weight:700; }
      .contract-visual-cover .pricing-box { border:1px solid #7864ff; background:#f8f7ff; padding:18px 14px; }
      .contract-visual-cover .pricing-box h3 { margin:0 0 18px; font-size:15px; }
      .contract-visual-cover .pricing-box p { margin:0 0 14px; }
      .contract-visual-cover .signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:68px; margin-top:58px; }
      .contract-visual-cover .signature-grid span { color:#6437cc; font-weight:700; font-size:11px; }
      .contract-visual-cover .signature-grid p { min-height:26px; margin:8px 0; }
      .contract-visual-cover .cover-footer { position:absolute; left:68px; right:68px; bottom:28px; text-align:center; font-size:9px; color:#64748b; }
      .contract-visual-cover .cover-footer strong { color:#111827; font-size:14px; }
      .contract-doc-page h1 { color:#0d2c4a; font-size:28px; font-weight:800; margin:0 0 30px; }
      .contract-doc-page h2 { color:#6437cc; font-size:18px; font-weight:800; margin:28px 0 12px; }
      .contract-doc-page h3 { color:#0d2c4a; font-size:15px; font-weight:800; margin:22px 0 8px; }
      .contract-doc-page h4 { font-size:13px; font-weight:800; margin:16px 0 6px; }
      .contract-doc-page p { margin:0 0 14px; }
      .contract-doc-page ul, .contract-doc-page ol { padding-left:28px; margin:0 0 14px; }
      .contract-doc-page blockquote { border-left:3px solid #7864ff; padding-left:16px; color:#475569; margin:16px 0; }
      .contract-doc-page table { width:100%; border-collapse:collapse; margin:16px 0; }
      .contract-doc-page th, .contract-doc-page td { border:1px solid #cbd5e1; padding:8px; vertical-align:top; }
      .contract-doc-page hr { border:0; border-top:1px solid #cbd5e1; margin:20px 0; }
      .contract-doc-page:focus { outline: 2px solid rgba(100,55,204,.2); outline-offset: -2px; }
    `}</style>

    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-border bg-white/95 px-3 py-2 backdrop-blur">
      <ToolbarButton title="Annuler" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("undo"))}><Undo2 className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Rétablir" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("redo"))}><Redo2 className="h-4 w-4" /></ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <select
        aria-label="Style"
        disabled={disabled}
        className="h-8 rounded-md border border-border bg-white px-2 text-xs font-semibold"
        defaultValue="p"
        onMouseDown={rememberSelection}
        onChange={event => command("formatBlock", event.target.value)}
      >
        <option value="p">Normal</option>
        <option value="h1">Titre 1</option>
        <option value="h2">Titre 2</option>
        <option value="h3">Titre 3</option>
        <option value="blockquote">Citation</option>
      </select>
      <select
        aria-label="Taille"
        disabled={disabled}
        className="h-8 rounded-md border border-border bg-white px-2 text-xs"
        defaultValue="3"
        onMouseDown={rememberSelection}
        onChange={event => command("fontSize", event.target.value)}
      >
        <option value="2">10</option>
        <option value="3">12</option>
        <option value="4">14</option>
        <option value="5">18</option>
        <option value="6">24</option>
      </select>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Gras" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("bold"))}><Bold className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Italique" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("italic"))}><Italic className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Souligné" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("underline"))}><Underline className="h-4 w-4" /></ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Aligner à gauche" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("justifyLeft"))}><AlignLeft className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Centrer" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("justifyCenter"))}><AlignCenter className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Aligner à droite" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("justifyRight"))}><AlignRight className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Justifier" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("justifyFull"))}><AlignJustify className="h-4 w-4" /></ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Liste à puces" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("insertUnorderedList"))}><List className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Liste numérotée" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("insertOrderedList"))}><ListOrdered className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Tableau 2 × 2" disabled={disabled} onMouseDown={toolbarMouseDown(insertTable)}><Table2 className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Séparateur" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("insertHorizontalRule"))}><Minus className="h-4 w-4" /></ToolbarButton>
      <ToolbarButton title="Effacer la mise en forme" disabled={disabled} onMouseDown={toolbarMouseDown(() => command("removeFormat"))}><Eraser className="h-4 w-4" /></ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <button type="button" disabled={disabled} onMouseDown={toolbarMouseDown(addPage)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"><FilePlus2 className="h-4 w-4" /> Nouvelle page</button>
      <div className="ml-auto text-[11px] font-medium text-muted-foreground">Page active : {activePage + (showCover ? 2 : 1)}</div>
    </div>

    <div className="max-h-[78vh] overflow-auto px-5 py-6">
      <div className="mx-auto w-max space-y-7">
        {showCover ? <div>
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground"><span>Page 1 · informations automatiques</span><span>Modifiable depuis les champs du contrat</span></div>
          <div className="contract-visual-cover overflow-hidden rounded-sm bg-white shadow-[0_8px_32px_rgba(15,23,42,0.12)]" dangerouslySetInnerHTML={{ __html: cover }} />
        </div> : null}

        {pages.map((page, index) => <div key={index}>
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Page {index + (showCover ? 2 : 1)}</span>
            {!disabled && pages.length > 1 ? <button type="button" onClick={() => removePage(index)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50">Supprimer la page</button> : null}
          </div>
          <div
            ref={node => { pageRefs.current[index] = node; }}
            contentEditable={!disabled}
            suppressContentEditableWarning
            spellCheck
            className="contract-doc-page min-h-[1123px] w-[794px] overflow-hidden rounded-sm bg-white px-[76px] py-[78px] text-[13px] leading-[1.55] text-slate-900 shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
            dangerouslySetInnerHTML={{ __html: page }}
            onFocus={() => { setActivePage(index); queueMicrotask(rememberSelection); }}
            onMouseUp={() => { setActivePage(index); rememberSelection(); }}
            onKeyUp={() => { setActivePage(index); rememberSelection(); }}
            onInput={() => syncPage(index)}
          />
        </div>)}
      </div>
    </div>
  </div>;
}

import { CheckCircle2, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { contractBodyBlocks, isContractHeading } from "@/lib/sd05-contract";
import type { SD05Content } from "@/lib/sd-stage-content";

export type SD05SignatureSummary = {
  id: string;
  signerName: string;
  signerEmail: string;
  signerRole: string | null;
  signerOrganization: string | null;
  status: string;
  contractHash: string;
  signedPayloadHash: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
};

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}

function statusLabel(status: string) {
  if (status === "signed") return "Signé";
  if (status === "viewed") return "Consulté";
  if (status === "sent") return "Envoyé";
  if (status === "expired") return "Expiré";
  if (status === "revoked") return "Révoqué";
  if (status === "failed") return "Échec d'envoi";
  return "À signer";
}

export function SD05ContractRenderer({
  content,
  companyName,
  contractHash,
  signatures = [],
  compact = false,
}: {
  content: SD05Content;
  companyName?: string;
  contractHash?: string | null;
  signatures?: SD05SignatureSummary[];
  compact?: boolean;
}) {
  const clientSigner = content.signatories.find(item => item.organization !== "GANDO SOLUTIONS") || content.signatories[0];
  const gandoSigner = content.signatories.find(item => item.organization === "GANDO SOLUTIONS") || content.signatories[1];
  const blocks = contractBodyBlocks(content.contractSummary);

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white text-slate-950 shadow-sm">
      <div className="h-3 bg-[#735DF3]" />
      <div className={compact ? "p-5 sm:p-7" : "p-6 sm:p-10 lg:p-12"}>
        <div className="relative flex items-start justify-between gap-6 border-b border-slate-200 pb-7">
          <div>
            <div className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">GANDO SOLUTIONS</div>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Convention de services · SD05</p>
          </div>
          <GandoMark className="absolute left-1/2 top-[-40px] h-14 w-14 -translate-x-1/2 rounded-full shadow-sm" />
          <div className="max-w-[280px] text-right">
            <div className="text-sm font-bold">{content.contractTitle || "Contrat Gando"}</div>
            <div className="mt-1 text-sm font-black text-[#735DF3]">{content.contractReference || "Référence à compléter"}</div>
            <div className="mt-2 text-[11px] leading-5 text-slate-500">
              Version : {content.contractVersion || "—"}<br />
              Validité de signature : {dateLabel(content.signatureDeadline)}
            </div>
          </div>
        </div>

        <div className="grid gap-6 py-8 sm:grid-cols-2">
          <section>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#735DF3]">L'établissement</div>
            <div className="mt-3 text-sm leading-6 text-slate-700">
              <strong className="text-slate-950">GANDO SOLUTIONS</strong><br />
              SAS au capital de 1 000,00 euros<br />
              RCS Meaux, N° 943 391 201<br />
              3 chemin de la porte verte, 77144 Montévrain<br />
              contact@gando.app
            </div>
          </section>
          <section className="sm:text-right">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#735DF3]">Le Loueur utilisateur</div>
            <div className="mt-3 text-sm leading-6 text-slate-700">
              <strong className="text-slate-950">{companyName || clientSigner?.organization || "Société cliente"}</strong><br />
              {clientSigner?.name ? <>Représenté par {clientSigner.name}<br /></> : null}
              {clientSigner?.role ? <>{clientSigner.role}<br /></> : null}
              {clientSigner?.email || "Coordonnées à compléter"}
            </div>
          </section>
        </div>

        {content.legalItems.length ? (
          <section className="mb-8">
            <div className="mb-3 text-sm font-black">Service(s) de l'offre de sécurisation de caution en ligne Gando</div>
            <div className="rounded-xl border border-[#735DF3]/45 bg-[#735DF3]/[0.035] p-5">
              <div className="text-xs font-black uppercase tracking-[0.13em] text-[#735DF3]">Structure tarifaire</div>
              <div className="mt-4 space-y-3">
                {content.legalItems.map((item, index) => (
                  <div key={`${item.topic}-${index}`} className="grid gap-1 text-sm sm:grid-cols-[220px_1fr]">
                    <strong>{item.topic}</strong>
                    <span className="leading-6 text-slate-700">{item.notes || "À compléter"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-9 rounded-xl bg-slate-50 p-5">
          <div className="text-sm font-black">Entrée en vigueur</div>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div><span className="font-semibold text-slate-950">Date de mise en production</span><br />{dateLabel(content.goLiveDate || content.effectiveDate)}</div>
            <div><span className="font-semibold text-slate-950">Durée initiale</span><br />{content.term || "À compléter"}</div>
            <div><span className="font-semibold text-slate-950">Renouvellement</span><br />{content.renewal || "À compléter"}</div>
            <div><span className="font-semibold text-slate-950">Préavis / résiliation</span><br />{content.terminationNotice || "À compléter"}</div>
          </div>
        </section>

        <div className="space-y-5 border-t border-slate-200 pt-8">
          {blocks.length ? blocks.map((block, index) => {
            const heading = isContractHeading(block);
            return heading ? (
              <h2 key={index} className="pt-4 text-base font-black uppercase tracking-[-0.01em] text-[#735DF3] sm:text-lg">{block}</h2>
            ) : /^(\d+\.\d+|5\.\d+)\s/.test(block) ? (
              <h3 key={index} className="pt-2 text-sm font-black text-slate-950">{block}</h3>
            ) : (
              <p key={index} className="whitespace-pre-line text-sm leading-7 text-slate-700">{block}</p>
            );
          }) : <p className="text-sm italic text-slate-500">Le texte contractuel doit être renseigné avant l'envoi en signature.</p>}
        </div>

        <section className="mt-12 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[#735DF3]">Signatures électroniques</div>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Les Parties</h2>
            </div>
            {contractHash ? (
              <div className="max-w-[420px] rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
                <strong className="text-slate-700">Empreinte SHA-256 du document</strong><br />
                <span className="break-all font-mono">{contractHash}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {content.signatories.map((signer, index) => {
              const evidence = signatures.find(item => item.signerEmail.toLowerCase() === signer.email.toLowerCase());
              const signed = evidence?.status === "signed" || signer.signatureStatus === "signed";
              return (
                <div key={`${signer.email}-${index}`} className="min-h-[170px] rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{signer.organization || (index === 0 ? "Loueur utilisateur" : "Gando Solutions")}</div>
                    <span className={signed ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700" : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"}>
                      {signed ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />} {statusLabel(evidence?.status || signer.signatureStatus || "pending")}
                    </span>
                  </div>
                  <div className="mt-5 text-sm font-black">{signer.name || "Nom à compléter"}</div>
                  <div className="mt-1 text-xs text-slate-500">{signer.role || "Fonction à compléter"}</div>
                  <div className="mt-1 text-xs text-slate-500">{signer.email || "Email à compléter"}</div>
                  {evidence?.signedAt ? <div className="mt-4 text-[11px] font-semibold text-emerald-700">Signé électroniquement le {dateLabel(evidence.signedAt)}</div> : null}
                </div>
              );
            })}
          </div>

          {contractHash ? (
            <div className="mt-6 grid gap-3 rounded-xl bg-slate-950 p-5 text-white sm:grid-cols-3">
              <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" /><div><div className="text-xs font-bold">Intégrité</div><div className="mt-1 text-[10px] leading-4 text-slate-300">Document figé par empreinte SHA-256.</div></div></div>
              <div className="flex gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 text-emerald-300" /><div><div className="text-xs font-bold">Traçabilité</div><div className="mt-1 text-[10px] leading-4 text-slate-300">Email, horodatages et journal d'audit conservés.</div></div></div>
              <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" /><div><div className="text-xs font-bold">Consentement</div><div className="mt-1 text-[10px] leading-4 text-slate-300">Acceptation explicite avant chaque signature.</div></div></div>
            </div>
          ) : null}
        </section>

        <div className="mt-10 border-t border-slate-200 pt-5 text-center text-[9px] leading-4 text-slate-400">
          CONFIDENTIALITÉ — Ce document et ses éléments de preuve sont confidentiels. GANDO SOLUTIONS · RCS Meaux 943 391 201 · 3 chemin de la porte verte, 77144 Montévrain.
        </div>
      </div>
    </div>
  );
}

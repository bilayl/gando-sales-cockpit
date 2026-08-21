import { SD05SignaturePortal } from "@/components/sd05-signature-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  if (!s) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black text-slate-900">Invitation de signature requise</h1><p className="mt-3 text-sm leading-6 text-slate-600">Ouvrez le lien personnel reçu par email pour consulter et signer ce contrat.</p></div></main>;
  }
  return <SD05SignaturePortal token={s} />;
}

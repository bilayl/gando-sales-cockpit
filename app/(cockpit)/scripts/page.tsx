import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function ScriptsPage() {
  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <div className="max-w-xl rounded-2xl border border-primary/20 bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles /></span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Les scripts statiques ont été remplacés</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Le Cockpit prépare désormais chaque appel avec l’IA à partir du lead, de l’entreprise et de l’historique CRM disponible.
        </p>
        <Button asChild className="mt-5 gap-1.5">
          <Link href="/prospection">Ouvrir la prospection <ArrowRight size={15} /></Link>
        </Button>
      </div>
    </main>
  );
}

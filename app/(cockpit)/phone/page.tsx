import { OnoffWebPhone } from "@/components/onoff-webphone";

export default function Page() {
  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Téléphonie</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.045em]">Appels</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              Test du vrai webphone Onoff directement dans Gando. Connecte-toi à Onoff dans le cadre puis autorise le microphone si le navigateur le demande.
            </p>
          </div>
          <div className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">POC · iframe Onoff</div>
        </div>

        <OnoffWebPhone />
      </div>
    </div>
  );
}

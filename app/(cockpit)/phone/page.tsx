import { OnoffWebPhone } from "@/components/onoff-webphone";
import { Badge } from "@/components/ui/badge";
import { getOnoffDirectApiStatus } from "@/lib/onoff";

export default async function Page() {
  const onoff = await getOnoffDirectApiStatus().catch(() => null);
  const apiLabel = !onoff?.configured ? "API à configurer" : onoff.connected === true ? "API Onoff connectée" : onoff.connected === false ? "API Onoff à vérifier" : "API Onoff configurée";

  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Téléphonie Onoff</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.045em]">Appels</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              Le média passe par le webphone Onoff. Gando utilise l’API Onoff directement côté serveur pour vérifier et enrichir les appels, puis les webhooks mettent à jour le workflow commercial.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={onoff?.configured && onoff.connected !== false ? "default" : "outline"}>{apiLabel}</Badge>
            <Badge variant="outline">Webphone Onoff</Badge>
          </div>
        </div>

        <OnoffWebPhone />
      </div>
    </div>
  );
}

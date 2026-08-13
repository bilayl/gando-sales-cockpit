import { isHubSpotConfigured } from "@/lib/hubspot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Page() {
  const configured = isHubSpotConfigured();
  return <div className="min-h-[calc(100vh-24px)] p-6">
    <div className="mb-1 flex items-center gap-2">
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(115,93,243,0.9)]" />
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">Configuration</span>
    </div>
    <h1 className="font-display text-2xl font-bold tracking-tight">Paramètres</h1>
    <p className="mt-1 text-sm text-muted-foreground">Configuration de la connexion HubSpot.</p>
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">HubSpot connecté <Badge variant={configured ? "default" : "outline"}>{configured ? "Connecté" : "Non configuré"}</Badge></CardTitle>
        <CardDescription>Application Private App (jeton API).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/20 p-3"><span className="text-muted-foreground">Mode</span><div className="mt-1 font-medium">Private App (jeton API)</div></div>
        <div className="rounded-xl border border-border bg-muted/20 p-3"><span className="text-muted-foreground">État</span><div className="mt-1 font-medium">{configured ? "Connecté" : "Non configuré"}</div></div>
      </CardContent>
    </Card>
  </div>;
}

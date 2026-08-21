import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { SettingsTeam } from "@/components/settings-team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Page() {
  const access = await getCockpitAccess();
  const oauthConfigured = isHubSpotOAuthConfigured();
  const connected = await isHubSpotAuthenticated().catch(() => false);
  const identity = connected ? await getHubSpotIdentity().catch(() => null) : null;
  const configured = oauthConfigured || connected;
  const mode = identity?.mode === "oauth"
    ? "OAuth HubSpot"
    : identity?.mode === "service_token"
      ? "Connexion serveur Gando"
      : configured
        ? "OAuth configuré"
        : "Non configuré";
  const state = connected ? "Opérationnel" : configured ? "À reconnecter" : "Non configuré";

  return <div className="page-shell min-h-screen"><div className="page-content space-y-6">
    <div>
      <h1 className="text-2xl font-bold tracking-[-0.035em]">Paramètres</h1>
      <p className="mt-1 text-sm text-muted-foreground">Équipe, permissions et intégrations du Sales Cockpit.</p>
    </div>

    <SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} />

    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{state}</Badge></CardTitle>
        <CardDescription>Cette vérification teste l’accès HubSpot disponible côté serveur. La connexion au Sales Cockpit reste indépendante de HubSpot.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/45 p-3"><span className="text-muted-foreground">Mode</span><div className="mt-1 font-medium">{mode}</div></div>
        <div className="rounded-lg border border-border bg-muted/45 p-3"><span className="text-muted-foreground">État API</span><div className="mt-1 font-medium">{state}</div></div>
      </CardContent>
    </Card>
  </div></div>;
}

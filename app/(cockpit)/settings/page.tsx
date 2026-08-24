import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { SettingsTeam } from "@/components/settings-team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ hubspot?: string }>;
}) {
  const access = await getCockpitAccess();
  const params = searchParams ? await searchParams : {};
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
  const reconnectStatus = params?.hubspot;

  return <div className="page-shell min-h-screen"><div className="page-content space-y-6">
    <div>
      <h1 className="text-2xl font-bold tracking-[-0.035em]">Paramètres</h1>
      <p className="mt-1 text-sm text-muted-foreground">Équipe, permissions et intégrations du Sales Cockpit.</p>
    </div>

    <SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} />

    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{state}</Badge></CardTitle>
        <CardDescription>Cette connexion donne au Sales Cockpit l’accès aux contacts, entreprises, segments et commerciaux HubSpot. Ta connexion au Sales Cockpit reste indépendante.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {reconnectStatus === "reconnected" ? (
          <div className="rounded-lg border border-border bg-muted/45 px-3 py-2 font-medium">HubSpot a bien été reconnecté.</div>
        ) : reconnectStatus === "error" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 font-medium text-destructive">La reconnexion HubSpot a échoué. Tu peux relancer la connexion ci-dessous.</div>
        ) : reconnectStatus === "not-configured" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 font-medium text-destructive">La configuration OAuth HubSpot est incomplète.</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/45 p-3"><span className="text-muted-foreground">Mode</span><div className="mt-1 font-medium">{mode}</div></div>
          <div className="rounded-lg border border-border bg-muted/45 p-3"><span className="text-muted-foreground">État API</span><div className="mt-1 font-medium">{state}</div></div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button asChild disabled={!oauthConfigured}>
            <a href="/api/auth/hubspot?returnTo=%2Fsettings">
              {connected ? "Reconnecter HubSpot" : "Connecter HubSpot"}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">La reconnexion met à jour les accès HubSpot sans te déconnecter du Sales Cockpit.</p>
        </div>
      </CardContent>
    </Card>
  </div></div>;
}

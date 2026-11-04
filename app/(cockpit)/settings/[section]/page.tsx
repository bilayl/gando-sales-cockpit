import { redirect } from "next/navigation";
import { ExternalLink, PhoneCall, Radio, ShieldCheck, Webhook } from "lucide-react";
import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getAircallStatus } from "@/lib/aircall";
import { SettingsTeam } from "@/components/settings-team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const WORKSPACE_URL = "https://workspace.aircall.io/";
const DASHBOARD_URL = "https://dashboard.aircall.io/";
const WEBHOOK_URL = "https://room.gando.pro/api/aircall/webhook";

const VALID_SECTIONS = new Set([
  "numbers", "members", "billing", "usage", "tags", "models", "profile",
  "email-notifications", "integrations", "api-keys", "webhooks", "compliance",
]);

function PageHeader({ title, description }: { title: string; description?: string }) {
  return <div className="mb-6"><h1 className="text-[22px] font-semibold tracking-[-0.035em]">{title}</h1>{description ? <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">{description}</p> : null}</div>;
}

function EmptySetting({ title, description }: { title: string; description: string }) {
  return <Card><CardHeader><CardTitle className="text-[15px]">{title}</CardTitle><CardDescription className="text-xs leading-5">{description}</CardDescription></CardHeader></Card>;
}

export const dynamic = "force-dynamic";

export default async function SettingsSectionPage({
  params, searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams?: Promise<{ hubspot?: string }>;
}) {
  const { section } = await params;
  if (!VALID_SECTIONS.has(section)) redirect("/settings/integrations");
  const access = await getCockpitAccess();
  const aircall = await getAircallStatus();
  const apiState = aircall.connected ? "Connectée" : aircall.configured ? "À vérifier" : "À configurer";

  if (section === "numbers") {
    return <><PageHeader title="Numéros Aircall" description="Lignes professionnelles attribuées aux commerciaux." /><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><PhoneCall size={18} /><div><div className="text-sm font-semibold">Lignes Aircall</div><div className="mt-0.5 text-xs text-muted-foreground">Gérées dans le tableau de bord Aircall.</div></div></div><Button variant="outline" asChild><a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Gérer les numéros <ExternalLink size={13} /></a></Button></CardContent></Card></>;
  }
  if (section === "members") return <><PageHeader title="Membres" description="Accès au Cockpit et rôles de l’équipe." /><SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} /></>;
  if (section === "billing") return <><PageHeader title="Facturation" /><EmptySetting title="Facturation téléphonique" description="Les abonnements et consommations Aircall sont consultables depuis Aircall Dashboard." /></>;
  if (section === "usage") return <><PageHeader title="Utilisation" description="Données d’appels et performances synchronisées." /><Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2"><div className="rounded-xl border border-border bg-muted/35 p-3"><div className="text-xs text-muted-foreground">API Aircall</div><div className="mt-1 font-semibold">{apiState}</div></div><div className="rounded-xl border border-border bg-muted/35 p-3"><div className="text-xs text-muted-foreground">Webhook Aircall</div><div className="mt-1 font-semibold">{aircall.webhookConfigured ? "Secret configuré" : "À configurer"}</div></div></CardContent></Card></>;
  if (section === "tags") return <><PageHeader title="Tags d’appel" /><EmptySetting title="Tags Aircall" description="Les tags transmis par le webhook Aircall sont visibles dans l’historique Gando." /></>;
  if (section === "models") return <><PageHeader title="Modèles" /><EmptySetting title="Comptes rendus" description="La synchronisation native des appels Aircall fournit la base des comptes rendus et du suivi commercial." /></>;
  if (section === "profile") return <><PageHeader title="Profil" /><EmptySetting title={access?.email || "Compte Gando"} description="Votre adresse e-mail Gando doit être identique à celle de votre utilisateur Aircall." /></>;
  if (section === "email-notifications") return <><PageHeader title="Notifications" /><EmptySetting title="Notifications par e-mail" description="Préférences de notification du Cockpit." /></>;
  if (section === "api-keys") return <><PageHeader title="Clés API" description="Les identifiants Aircall restent exclusivement côté serveur." /><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="text-sm font-semibold">Aircall API</div><div className="mt-1 text-xs text-muted-foreground">Variables serveur AIRCALL_API_ID et AIRCALL_API_TOKEN dans Vercel, jamais exposées au navigateur.</div></div><Badge variant={aircall.connected ? "default" : "outline"}>{apiState}</Badge></CardContent></Card></>;
  if (section === "webhooks") return <><PageHeader title="Webhooks" description="Synchronisation Aircall → Gando après la fin de chaque appel." /><Card><CardContent className="space-y-4 p-5"><div className="flex items-start gap-3"><Webhook size={17} /><div><div className="text-sm font-semibold">Aircall · appels terminés</div><div className="mt-1 break-all font-mono text-xs text-muted-foreground">{WEBHOOK_URL}</div></div></div><Badge variant={aircall.webhookConfigured ? "default" : "outline"}>{aircall.webhookConfigured ? "Secret de vérification présent" : "À configurer dans Aircall"}</Badge><p className="text-xs text-muted-foreground">Événements : call.ended, call.tagged, call.commented, call.comm_assets_generated. Les événements sont authentifiés par le token unique du webhook.</p></CardContent></Card></>;
  if (section === "compliance") return <><PageHeader title="Conformité" /><Card><CardContent className="flex items-start gap-3 p-5"><ShieldCheck size={18} /><div><div className="text-sm font-semibold">Sécurité des communications</div><div className="mt-1 text-xs text-muted-foreground">Aircall assure la téléphonie. Gando n’expose ni les clés API ni les enregistrements sans authentification du Cockpit. Vérifiez les obligations d’information et de conservation avant d’activer les enregistrements.</div></div></CardContent></Card></>;

  const oauthConfigured = isHubSpotOAuthConfigured();
  const connected = await isHubSpotAuthenticated().catch(() => false);
  const identity = connected ? await getHubSpotIdentity().catch(() => null) : null;
  const configured = oauthConfigured || connected;
  const mode = identity?.mode === "oauth" ? "OAuth HubSpot" : identity?.mode === "service_token" ? "Connexion serveur Gando" : configured ? "OAuth configuré" : "Non configuré";
  const state = connected ? "Opérationnel" : configured ? "À reconnecter" : "Non configuré";
  const query = searchParams ? await searchParams : {};

  return <>
    <PageHeader title="Intégrations" description="Aircall gère les communications. Gando relie la prospection, les appels et le CRM HubSpot." />
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">Aircall <Badge variant={aircall.connected ? "default" : "outline"}>{apiState}</Badge></CardTitle><CardDescription>Appels sortants via API, téléphone Aircall Everywhere intégré et webhooks pour l’historique.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">API Aircall</div><div className="mt-1 font-semibold">{apiState}</div></div><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Webhook Aircall</div><div className="mt-1 font-semibold">{aircall.webhookConfigured ? "Secret configuré" : "À configurer"}</div></div></div>
          {aircall.error ? <p className="rounded-lg border border-destructive/40 p-3 text-xs text-destructive">{aircall.error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button asChild><a href="/phone">Ouvrir le téléphone Gando</a></Button><Button asChild variant="outline"><a href={WORKSPACE_URL} target="_blank" rel="noopener noreferrer">Aircall Workspace <ExternalLink size={13} /></a></Button><Button asChild variant="outline"><a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Aircall Dashboard <ExternalLink size={13} /></a></Button></div>
          <p className="text-xs text-muted-foreground">Configurez AIRCALL_API_ID, AIRCALL_API_TOKEN et AIRCALL_WEBHOOK_TOKEN sur Vercel. Chaque commercial doit utiliser la même adresse e-mail dans Gando et Aircall.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{state}</Badge></CardTitle><CardDescription>CRM de référence : contacts, entreprises, responsables commerciaux et historique HubSpot.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {query.hubspot === "reconnected" ? <div className="rounded-lg border border-border bg-muted px-3 py-2">HubSpot a bien été reconnecté.</div> : null}
          {query.hubspot === "error" ? <div className="rounded-lg border border-destructive/40 px-3 py-2 text-destructive">La reconnexion HubSpot a échoué.</div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Mode</div><div className="mt-1 font-semibold">{mode}</div></div><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">État API</div><div className="mt-1 font-semibold">{state}</div></div></div>
          <Button asChild><a href="/api/auth/hubspot?returnTo=%2Fsettings%2Fintegrations">{connected ? "Reconnecter HubSpot" : "Connecter HubSpot"}</a></Button>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><Radio size={14} /> Cockpit · Aircall + HubSpot</div>
    </div>
  </>;
}

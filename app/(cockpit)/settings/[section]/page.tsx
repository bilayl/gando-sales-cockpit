import { redirect } from "next/navigation";
import { ExternalLink, PhoneCall, Radio, ShieldCheck, Webhook } from "lucide-react";
import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getOnoffDirectApiStatus } from "@/lib/onoff";
import { SettingsTeam } from "@/components/settings-team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ONOFF_WEBPHONE_URL = "https://phone.onoffbusiness.com/";
const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

const VALID_SECTIONS = new Set([
  "numbers",
  "members",
  "billing",
  "usage",
  "tags",
  "models",
  "profile",
  "email-notifications",
  "integrations",
  "api-keys",
  "webhooks",
  "compliance",
]);

function formatDate(value?: string | null) {
  if (!value) return "Aucun événement reçu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.035em]">{title}</h1>
      {description ? <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function EmptySetting({ title, description }: { title: string; description: string }) {
  return <Card><CardHeader><CardTitle className="text-[15px]">{title}</CardTitle><CardDescription className="text-xs leading-5">{description}</CardDescription></CardHeader></Card>;
}

export const dynamic = "force-dynamic";

export default async function SettingsSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams?: Promise<{ hubspot?: string }>;
}) {
  const { section } = await params;
  if (!VALID_SECTIONS.has(section)) redirect("/settings/integrations");

  const access = await getCockpitAccess();
  const onoff = await getOnoffDirectApiStatus().catch(error => ({
    configured: false,
    connected: false,
    source: "onoff_api" as const,
    latestCallId: null,
    latestEventName: null,
    latestReceivedAt: null,
    latestProcessingStatus: null,
    webhookAuthenticated: false,
    checkedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : "Impossible de vérifier Onoff.",
  }));
  const apiState = !onoff.configured ? "À configurer" : onoff.connected === true ? "Connectée" : onoff.connected === false ? "À vérifier" : "Configurée";

  if (section === "numbers") {
    return <><PageHeader title="Numéros" description="Lignes professionnelles utilisées par l’équipe commerciale." /><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-[13px] bg-muted"><PhoneCall className="h-4 w-4" /></div><div><div className="text-sm font-semibold">Onoff Business</div><div className="mt-0.5 text-xs text-muted-foreground">Les lignes restent administrées dans Onoff.</div></div></div><Button variant="outline" size="sm" asChild><a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">Gérer dans Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></CardContent></Card></>;
  }

  if (section === "members") {
    return <><PageHeader title="Membres" description="Accès au Cockpit et rôles de l’équipe." /><SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} /></>;
  }

  if (section === "billing") {
    return <><PageHeader title="Facturation" /><EmptySetting title="Facturation" description="La facturation téléphonie reste gérée depuis Onoff Business." /></>;
  }

  if (section === "usage") {
    return <><PageHeader title="Utilisation" description="Suivi de l’usage téléphonique synchronisé avec le Cockpit." /><Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2"><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">API Onoff</span><div className="mt-1 font-medium">{apiState}</div></div><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier traitement</span><div className="mt-1 font-medium">{onoff.latestProcessingStatus || "—"}</div></div></CardContent></Card></>;
  }

  if (section === "tags") {
    return <><PageHeader title="Tags" /><EmptySetting title="Tags d’appel" description="Les tags Onoff sont conservés avec les métadonnées d’appel et pourront être exploités dans le CRM." /></>;
  }

  if (section === "models") {
    return <><PageHeader title="Modèles" /><EmptySetting title="Modèles de compte rendu" description="Les transcriptions et métadonnées Onoff alimentent les modèles Gando après l’appel." /></>;
  }

  if (section === "profile") {
    return <><PageHeader title="Profil" /><EmptySetting title={access?.email || "Compte Gando"} description="Profil utilisé pour attribuer les actions et sessions commerciales." /></>;
  }

  if (section === "email-notifications") {
    return <><PageHeader title="Notifications par e-mail" /><EmptySetting title="Notifications" description="Les préférences de notification sont centralisées dans cette rubrique." /></>;
  }

  if (section === "api-keys") {
    return <><PageHeader title="Clés API" description="Les secrets restent exclusivement côté serveur." /><Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><div className="text-sm font-semibold">Onoff API</div><div className="mt-1 text-xs text-muted-foreground">Clé stockée côté serveur dans Supabase Vault.</div></div><Badge variant={onoff.configured ? "default" : "outline"}>{onoff.configured ? "Protégée" : "Manquante"}</Badge></CardContent></Card></>;
  }

  if (section === "webhooks") {
    const webhookState = onoff.latestCallId ? "Flux reçu" : "En attente";
    return <><PageHeader title="Webhooks" description="Synchronisation Onoff → Gando." /><Card><CardContent className="space-y-4 p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-[13px] bg-muted"><Webhook className="h-4 w-4" /></div><div><div className="text-sm font-semibold">CDR / RECORDING Onoff</div><div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">https://gando-sales-cockpit-web.vercel.app/v1/onoff/cdr</div></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">État du flux</span><div className="mt-1 font-medium">{webhookState}</div></div><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier type</span><div className="mt-1 font-medium">{onoff.latestEventName || "—"}</div></div></div><p className="text-xs leading-5 text-muted-foreground">Le webhook signale l’événement. Gando vérifie ensuite le call ID avec l’API Onoff avant de réconcilier l’appel avec le prospect et la session commerciale.</p></CardContent></Card></>;
  }

  if (section === "compliance") {
    return <><PageHeader title="Conformité" /><Card><CardContent className="flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><div className="text-sm font-semibold">Séparation des responsabilités</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Onoff gère le média téléphonique. Gando conserve la logique commerciale et les métadonnées nécessaires au suivi. HubSpot reste le CRM de référence.</div></div></CardContent></Card></>;
  }

  const oauthConfigured = isHubSpotOAuthConfigured();
  const connected = await isHubSpotAuthenticated().catch(() => false);
  const identity = connected ? await getHubSpotIdentity().catch(() => null) : null;
  const configured = oauthConfigured || connected;
  const mode = identity?.mode === "oauth" ? "OAuth HubSpot" : identity?.mode === "service_token" ? "Connexion serveur Gando" : configured ? "OAuth configuré" : "Non configuré";
  const state = connected ? "Opérationnel" : configured ? "À reconnecter" : "Non configuré";
  const query = searchParams ? await searchParams : {};
  const reconnectStatus = query?.hubspot;

  return (
    <>
      <PageHeader title="Intégrations" description="Onoff porte la téléphonie. Gando orchestre la prospection, le prospect, le résultat et HubSpot." />
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">Onoff Business <Badge variant={onoff.configured && onoff.connected !== false ? "default" : "outline"}>{apiState}</Badge></CardTitle><CardDescription>API Onoff côté serveur et webhooks pour réconcilier les appels dans le Cockpit.</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">API directe Onoff</span><div className="mt-1 font-medium">{apiState}</div></div>
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier événement</span><div className="mt-1 font-medium">{formatDate(onoff.latestReceivedAt)}</div></div>
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Traitement Gando</span><div className="mt-1 font-medium">{onoff.latestProcessingStatus || "—"}</div></div>
            </div>
            {onoff.error ? <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{onoff.error}</div> : null}
            <div className="flex flex-wrap gap-2"><Button asChild><a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">Ouvrir Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button><Button variant="outline" asChild><a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer">Click2Call Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></div>
            <p className="text-xs leading-5 text-muted-foreground">La clé API reste dans Supabase Vault. Le navigateur ne la reçoit jamais. Les webhooks ferment la boucle après l’appel.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{state}</Badge></CardTitle><CardDescription>Source CRM du Cockpit : contacts, entreprises, propriétaires et historique commercial.</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {reconnectStatus === "reconnected" ? <div className="rounded-lg border border-border bg-muted/45 px-3 py-2 font-medium">HubSpot a bien été reconnecté.</div> : null}
            {reconnectStatus === "error" ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 font-medium text-destructive">La reconnexion HubSpot a échoué.</div> : null}
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-muted-foreground">Mode</span><div className="mt-1 font-medium">{mode}</div></div><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-muted-foreground">État API</span><div className="mt-1 font-medium">{state}</div></div></div>
            <Button asChild disabled={!oauthConfigured}><a href="/api/auth/hubspot?returnTo=%2Fsettings%2Fintegrations">{connected ? "Reconnecter HubSpot" : "Connecter HubSpot"}</a></Button>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground"><Radio className="h-3.5 w-3.5" /> Paramètres Cockpit · Onoff API + Webhooks + HubSpot</div>
      </div>
    </>
  );
}

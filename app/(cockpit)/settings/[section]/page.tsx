import { ExternalLink, PhoneCall, Radio, ShieldCheck, Webhook } from "lucide-react";
import { notFound } from "next/navigation";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getOnoffDirectApiStatus } from "@/lib/onoff";
import { SettingsTeam } from "@/components/settings-team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ONOFF_WEBPHONE_URL = "https://phone.onoffbusiness.com/";
const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";
const SECTIONS = new Set([
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

function PageShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[980px] space-y-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Paramètres</div>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.04em]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptySetting({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-[15px]">{title}</CardTitle>
        <CardDescription className="text-xs leading-5">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

async function getOnoffStatus() {
  return getOnoffDirectApiStatus().catch(error => ({
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
}

export default async function SettingsSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ hubspot?: string }>;
}) {
  const { section } = await params;
  if (!SECTIONS.has(section)) notFound();
  const access = await getCockpitAccess();

  if (section === "numbers") {
    return (
      <PageShell title="Numéros" description="Lignes professionnelles utilisées par l’équipe commerciale.">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-[13px] bg-muted"><PhoneCall className="h-4 w-4" /></div>
              <div><div className="text-sm font-semibold">Onoff Business</div><div className="mt-0.5 text-xs text-muted-foreground">Les lignes restent administrées depuis Onoff.</div></div>
            </div>
            <Button variant="outline" size="sm" asChild><a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">Gérer dans Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (section === "members") {
    return <PageShell title="Membres" description="Accès au Cockpit et rôles de l’équipe."><SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} /></PageShell>;
  }

  if (section === "billing") {
    return <PageShell title="Facturation"><EmptySetting title="Facturation" description="La facturation de la téléphonie reste gérée depuis Onoff Business." /></PageShell>;
  }

  if (section === "usage") {
    return <PageShell title="Utilisation"><EmptySetting title="Utilisation" description="Les appels Onoff alimentent les statistiques du Cockpit à partir de l’API et des webhooks." /></PageShell>;
  }

  if (section === "tags") {
    return <PageShell title="Tags"><EmptySetting title="Tags d’appel" description="Les tags Onoff sont conservés avec les métadonnées d’appel." /></PageShell>;
  }

  if (section === "models") {
    return <PageShell title="Modèles"><EmptySetting title="Modèles de compte rendu" description="Les transcriptions et métadonnées Onoff alimentent les modèles Gando après l’appel." /></PageShell>;
  }

  if (section === "profile") {
    return <PageShell title="Profil"><EmptySetting title={access?.email || "Compte Gando"} description="Profil utilisé pour attribuer les actions et sessions commerciales." /></PageShell>;
  }

  if (section === "email-notifications") {
    return <PageShell title="Notifications par e-mail"><EmptySetting title="Notifications" description="Les préférences de notification sont centralisées dans cette rubrique." /></PageShell>;
  }

  if (section === "integrations") {
    const query = await searchParams;
    const oauthConfigured = isHubSpotOAuthConfigured();
    const connected = await isHubSpotAuthenticated().catch(() => false);
    const identity = connected ? await getHubSpotIdentity().catch(() => null) : null;
    const configured = oauthConfigured || connected;
    const mode = identity?.mode === "oauth" ? "OAuth HubSpot" : identity?.mode === "service_token" ? "Connexion serveur Gando" : configured ? "OAuth configuré" : "Non configuré";
    const state = connected ? "Opérationnel" : configured ? "À reconnecter" : "Non configuré";
    const onoff = await getOnoffStatus();
    const apiState = !onoff.configured ? "À configurer" : onoff.connected === true ? "Connectée" : onoff.connected === false ? "À vérifier" : "Configurée";

    return (
      <PageShell title="Intégrations" description="Onoff porte la téléphonie. Gando orchestre les leads, les résultats et la synchronisation HubSpot.">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">Onoff Business <Badge variant={onoff.configured && onoff.connected !== false ? "default" : "outline"}>{apiState}</Badge></CardTitle>
            <CardDescription>API Onoff côté serveur et webhooks temps réel pour réconcilier les appels avec le Cockpit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">API Onoff</span><div className="mt-1 font-medium">{apiState}</div></div>
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier événement</span><div className="mt-1 font-medium">{formatDate(onoff.latestReceivedAt)}</div></div>
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Traitement Gando</span><div className="mt-1 font-medium">{onoff.latestProcessingStatus || "—"}</div></div>
            </div>
            {onoff.error ? <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{onoff.error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">Application Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>
              <Button variant="outline" asChild><a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer">Click2Call Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">La clé API reste côté serveur. Le navigateur ne la reçoit jamais.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{state}</Badge></CardTitle><CardDescription>Source CRM du Cockpit : contacts, entreprises, propriétaires et historique commercial.</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {query.hubspot === "reconnected" ? <div className="rounded-lg border border-border bg-muted/45 px-3 py-2 font-medium">HubSpot a bien été reconnecté.</div> : null}
            {query.hubspot === "error" ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 font-medium text-destructive">La reconnexion HubSpot a échoué.</div> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-muted-foreground">Mode</span><div className="mt-1 font-medium">{mode}</div></div>
              <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-muted-foreground">État API</span><div className="mt-1 font-medium">{state}</div></div>
            </div>
            <Button asChild disabled={!oauthConfigured}><a href="/api/auth/hubspot?returnTo=%2Fsettings%2Fintegrations">{connected ? "Reconnecter HubSpot" : "Connecter HubSpot"}</a></Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (section === "api-keys") {
    const onoff = await getOnoffStatus();
    return (
      <PageShell title="Clés API" description="État des accès techniques utilisés par le Cockpit.">
        <Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><div className="text-sm font-semibold">Onoff API</div><div className="mt-1 text-xs text-muted-foreground">Clé stockée côté serveur dans Supabase Vault.</div></div><Badge variant={onoff.configured ? "default" : "outline"}>{onoff.configured ? "Protégée" : "Manquante"}</Badge></CardContent></Card>
      </PageShell>
    );
  }

  if (section === "webhooks") {
    const onoff = await getOnoffStatus();
    const webhookState = onoff.latestCallId ? "Flux reçu" : "En attente";
    return (
      <PageShell title="Webhooks" description="Synchronisation des événements Onoff vers Gando.">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-[13px] bg-muted"><Webhook className="h-4 w-4" /></div><div><div className="text-sm font-semibold">CDR / RECORDING Onoff</div><div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">https://gando-sales-cockpit-web.vercel.app/v1/onoff/cdr</div></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">État du flux</span><div className="mt-1 font-medium">{webhookState}</div></div><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier type</span><div className="mt-1 font-medium">{onoff.latestEventName || "—"}</div></div></div>
            <p className="text-xs leading-5 text-muted-foreground">Le webhook signale l’événement. Gando vérifie ensuite le call ID avec l’API Onoff avant de mettre à jour le prospect et les traitements post-appel.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="Conformité" description="Répartition des responsabilités entre les outils.">
      <Card><CardContent className="flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><div className="text-sm font-semibold">Séparation des responsabilités</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Onoff gère le média téléphonique. Gando conserve la logique commerciale et les métadonnées nécessaires au suivi. HubSpot reste le CRM de référence.</div></div></CardContent></Card>
      <div className="flex items-center gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground"><Radio className="h-3.5 w-3.5" /> Paramètres Cockpit · Onoff API + Webhooks + HubSpot</div>
    </PageShell>
  );
}

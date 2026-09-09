import { ExternalLink, PhoneCall, Radio, ShieldCheck, Webhook } from "lucide-react";
import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getOnoffDirectApiStatus } from "@/lib/onoff";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { SettingsTeam } from "@/components/settings-team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ONOFF_WEBPHONE_URL = "https://phone.onoffbusiness.com/";
const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

function formatDate(value?: string | null) {
  if (!value) return "Aucun événement reçu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function EmptySetting({ title, description }: { title: string; description: string }) {
  return <Card><CardHeader className="pb-4"><CardTitle className="text-[15px]">{title}</CardTitle><CardDescription className="text-xs leading-5">{description}</CardDescription></CardHeader></Card>;
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ hubspot?: string }> }) {
  const access = await getCockpitAccess();
  const params = searchParams ? await searchParams : {};

  const oauthConfigured = isHubSpotOAuthConfigured();
  const connected = await isHubSpotAuthenticated().catch(() => false);
  const identity = connected ? await getHubSpotIdentity().catch(() => null) : null;
  const configured = oauthConfigured || connected;
  const mode = identity?.mode === "oauth" ? "OAuth HubSpot" : identity?.mode === "service_token" ? "Connexion serveur Gando" : configured ? "OAuth configuré" : "Non configuré";
  const state = connected ? "Opérationnel" : configured ? "À reconnecter" : "Non configuré";
  const reconnectStatus = params?.hubspot;

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
  const webhookState = onoff.latestCallId ? "Flux reçu" : "En attente";

  return (
    <div className="flex min-h-screen bg-background">
      <SettingsSidebar />
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[980px] space-y-9">
          <div className="lg:hidden"><h1 className="text-2xl font-semibold tracking-[-0.04em]">Paramètres</h1><p className="mt-1 text-sm text-muted-foreground">Équipe, téléphonie et intégrations du Cockpit.</p></div>

          <section id="numbers" className="scroll-mt-6 space-y-3">
            <div><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Numéros</h2><p className="mt-1 text-xs text-muted-foreground">Lignes professionnelles utilisées par l’équipe commerciale.</p></div>
            <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-[13px] bg-muted"><PhoneCall className="h-4 w-4" /></div><div><div className="text-sm font-semibold">Onoff Business</div><div className="mt-0.5 text-xs text-muted-foreground">Les lignes restent administrées dans Onoff.</div></div></div><Button variant="outline" size="sm" asChild><a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">Gérer dans Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></CardContent></Card>
          </section>

          <section id="members" className="scroll-mt-6 space-y-3"><div><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Membres</h2><p className="mt-1 text-xs text-muted-foreground">Accès au Cockpit et rôles de l’équipe.</p></div><SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} /></section>
          <section id="billing" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Facturation</h2><EmptySetting title="Facturation" description="La facturation téléphonie reste gérée depuis Onoff Business." /></section>
          <section id="usage" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Utilisation</h2><EmptySetting title="Utilisation" description="Les appels Onoff alimentent les statistiques du Cockpit à partir de l’API et des webhooks." /></section>
          <section id="tags" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Tags</h2><EmptySetting title="Tags d’appel" description="Les tags Onoff sont conservés avec les métadonnées d’appel." /></section>
          <section id="models" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Modèles</h2><EmptySetting title="Modèles de compte rendu" description="Les transcriptions et métadonnées Onoff alimentent les modèles Gando après l’appel." /></section>
          <section id="profile" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Profil</h2><EmptySetting title={access?.email || "Compte Gando"} description="Profil utilisé pour attribuer les actions et sessions commerciales." /></section>
          <section id="email-notifications" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Notifications par e-mail</h2><EmptySetting title="Notifications" description="Les préférences de notification seront centralisées ici." /></section>

          <section id="integrations" className="scroll-mt-6 space-y-4">
            <div><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Intégrations</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Onoff porte la téléphonie. Gando orchestre la file, le prospect, le résultat et HubSpot.</p></div>

            <Card className="overflow-hidden">
              <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">Onoff Business <Badge variant={onoff.configured && onoff.connected !== false ? "default" : "outline"}>{apiState}</Badge></CardTitle><CardDescription>API Onoff utilisée directement côté serveur, webhooks temps réel pour fermer la boucle, webphone pour le média téléphonique.</CardDescription></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">API directe Onoff</span><div className="mt-1 font-medium">{apiState}</div></div>
                  <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier événement</span><div className="mt-1 font-medium">{formatDate(onoff.latestReceivedAt)}</div></div>
                  <div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Traitement Gando</span><div className="mt-1 font-medium">{onoff.latestProcessingStatus || "—"}</div></div>
                </div>
                {onoff.error ? <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{onoff.error}</div> : null}
                <div className="flex flex-wrap gap-2"><Button asChild><a href="/phone">Ouvrir le webphone</a></Button><Button variant="outline" asChild><a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer">Click2Call Onoff <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></div>
                <p className="text-xs leading-5 text-muted-foreground">La clé API reste dans Supabase Vault. Le navigateur ne la reçoit jamais. Gando peut lire directement les métadonnées d’un call ID via l’API Onoff, tandis que le webhook déclenche la réconciliation immédiatement après l’appel.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{state}</Badge></CardTitle><CardDescription>Source CRM du Cockpit : contacts, entreprises, propriétaires et historique commercial.</CardDescription></CardHeader>
              <CardContent className="space-y-4 text-sm">
                {reconnectStatus === "reconnected" ? <div className="rounded-lg border border-border bg-muted/45 px-3 py-2 font-medium">HubSpot a bien été reconnecté.</div> : null}
                {reconnectStatus === "error" ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 font-medium text-destructive">La reconnexion HubSpot a échoué.</div> : null}
                <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-muted-foreground">Mode</span><div className="mt-1 font-medium">{mode}</div></div><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-muted-foreground">État API</span><div className="mt-1 font-medium">{state}</div></div></div>
                <Button asChild disabled={!oauthConfigured}><a href="/api/auth/hubspot?returnTo=%2Fsettings%23integrations">{connected ? "Reconnecter HubSpot" : "Connecter HubSpot"}</a></Button>
              </CardContent>
            </Card>
          </section>

          <section id="api-keys" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Clés API</h2><Card><CardContent className="flex items-center justify-between gap-4 p-5"><div><div className="text-sm font-semibold">Onoff API</div><div className="mt-1 text-xs text-muted-foreground">Clé stockée côté serveur dans Supabase Vault.</div></div><Badge variant={onoff.configured ? "default" : "outline"}>{onoff.configured ? "Protégée" : "Manquante"}</Badge></CardContent></Card></section>

          <section id="webhooks" className="scroll-mt-6 space-y-3">
            <div><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Webhooks</h2><p className="mt-1 text-xs text-muted-foreground">Synchronisation Onoff → Gando.</p></div>
            <Card><CardContent className="space-y-4 p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-[13px] bg-muted"><Webhook className="h-4 w-4" /></div><div><div className="text-sm font-semibold">CDR / RECORDING Onoff</div><div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">https://gando-sales-cockpit-web.vercel.app/v1/onoff/cdr</div></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">État du flux</span><div className="mt-1 font-medium">{webhookState}</div></div><div className="rounded-[14px] border border-border bg-muted/35 p-3"><span className="text-xs text-muted-foreground">Dernier type</span><div className="mt-1 font-medium">{onoff.latestEventName || "—"}</div></div></div><p className="text-xs leading-5 text-muted-foreground">Le webhook signale l’événement. Gando vérifie ensuite le call ID avec l’API Onoff avant de mettre à jour le prospect, le statut de la session et les traitements d’enregistrement/transcription.</p></CardContent></Card>
          </section>

          <section id="compliance" className="scroll-mt-6 space-y-3"><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Conformité</h2><Card><CardContent className="flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><div className="text-sm font-semibold">Séparation des responsabilités</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Onoff gère le média téléphonique. Gando conserve la logique commerciale et les métadonnées nécessaires au suivi. HubSpot reste le CRM de référence.</div></div></CardContent></Card></section>

          <div className="flex items-center gap-2 border-t border-border pt-6 text-[11px] text-muted-foreground"><Radio className="h-3.5 w-3.5" /> Paramètres Cockpit · Onoff API + Webhooks + HubSpot</div>
        </div>
      </div>
    </div>
  );
}

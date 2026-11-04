import { redirect } from "next/navigation";
import { ExternalLink, PhoneCall, Radio, ShieldCheck, Webhook } from "lucide-react";
import { getHubSpotIdentity, isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getWithAlloStatus, listWithAlloNumbers } from "@/lib/withallo";
import { SettingsTeam } from "@/components/settings-team";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DASHBOARD_URL = "https://web.withallo.com/";
const VALID_SECTIONS = new Set(["numbers", "members", "billing", "usage", "tags", "models", "profile", "email-notifications", "integrations", "api-keys", "webhooks", "compliance"]);

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
  const allo = await getWithAlloStatus();
  const state = allo.connected ? "Connectée" : allo.configured ? "À vérifier" : "Non configurée";
  const numbers = section === "numbers" && allo.connected ? await listWithAlloNumbers().catch(() => []) : [];

  if (section === "numbers") return <><PageHeader title="Numéros Allo" description="Lignes professionnelles disponibles dans l’espace Allo." /><Card><CardContent className="space-y-4 p-5">{numbers.length ? numbers.map(line => <div key={line.number} className="flex items-center justify-between rounded-xl border border-border p-3"><span className="text-sm font-semibold">{line.name}</span><span className="text-xs text-muted-foreground">{line.number}</span></div>) : <p className="text-xs text-muted-foreground">Aucune ligne retournée par l’API Allo ou clé sans permission NUMBERS_READ.</p>}<Button variant="outline" asChild><a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Gérer dans Allo <ExternalLink size={13}/></a></Button></CardContent></Card></>;
  if (section === "members") return <><PageHeader title="Membres" description="Accès au Cockpit et rôles de l’équipe." /><SettingsTeam initialCanManage={Boolean(access?.canManageTeam)} /></>;
  if (section === "billing") return <><PageHeader title="Facturation" /><EmptySetting title="Facturation Allo" description="L’abonnement et les consommations téléphoniques sont gérés depuis ton compte Allo." /></>;
  if (section === "usage") return <><PageHeader title="Utilisation" description="Disponibilité de la connexion et des accès de la clé Allo." /><Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2"><div className="rounded-xl border border-border bg-muted/35 p-3"><div className="text-xs text-muted-foreground">API Allo</div><div className="mt-1 font-semibold">{state}</div></div><div className="rounded-xl border border-border bg-muted/35 p-3"><div className="text-xs text-muted-foreground">Permissions</div><div className="mt-1 break-words text-xs">{allo.scopes.length ? allo.scopes.join(" · ") : "Aucune permission lisible"}</div></div></CardContent></Card></>;
  if (section === "tags") return <><PageHeader title="Tags d’appel" /><EmptySetting title="Tags Allo" description="Les tags de conversation peuvent être pilotés dans l’interface Allo. Les appels et leurs synthèses remontent dans le Cockpit via l’API." /></>;
  if (section === "models") return <><PageHeader title="Modèles" /><EmptySetting title="Résumés IA Allo" description="Les modèles de compte rendu sont configurés dans Allo. Les synthèses exposées par l’API sont affichées dans l’historique du Cockpit." /></>;
  if (section === "profile") return <><PageHeader title="Profil" /><EmptySetting title={access?.email || "Compte Gando"} description="Les commerciaux retrouvent les appels dont l’adresse e-mail d’agent Allo correspond à leur compte Cockpit." /></>;
  if (section === "email-notifications") return <><PageHeader title="Notifications" /><EmptySetting title="Notifications par e-mail" description="Préférences de notification du Cockpit." /></>;
  if (section === "api-keys") return <><PageHeader title="Clé API Allo" description="Utilisation de la clé serveur déjà configurée, sans clé supplémentaire." /><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="text-sm font-semibold">WITHALLO_API_KEY</div><div className="mt-1 text-xs text-muted-foreground">Clé conservée sur Vercel et utilisée uniquement dans les routes serveur Gando. Jamais envoyée au navigateur.</div></div><Badge variant={allo.connected ? "default" : "outline"}>{state}</Badge></CardContent></Card></>;
  if (section === "webhooks") return <><PageHeader title="Webhooks Allo" description="Événements temps réel distincts de la lecture directe de l’historique." /><Card><CardContent className="space-y-3 p-5"><div className="flex items-start gap-3"><Webhook size={17}/><div><div className="text-sm font-semibold">Historique lu en direct</div><p className="mt-1 text-xs text-muted-foreground">Le Cockpit charge les appels directement via l’API Allo. Aucun webhook supplémentaire n’est nécessaire pour consulter l’historique.</p></div></div><p className="text-xs text-muted-foreground">La souscription aux événements Allo pourra être ajoutée séparément avec vérification cryptographique des signatures HMAC.</p></CardContent></Card></>;
  if (section === "compliance") return <><PageHeader title="Conformité" /><Card><CardContent className="flex items-start gap-3 p-5"><ShieldCheck size={18}/><div><div className="text-sm font-semibold">Sécurité des communications</div><div className="mt-1 text-xs text-muted-foreground">Allo assure la téléphonie. L’accès aux appels est protégé par la session Cockpit ; les clés restent uniquement côté serveur. Vérifiez l’information des interlocuteurs et les durées de conservation des enregistrements.</div></div></CardContent></Card></>;

  const oauthConfigured = isHubSpotOAuthConfigured();
  const connected = await isHubSpotAuthenticated().catch(() => false);
  const identity = connected ? await getHubSpotIdentity().catch(() => null) : null;
  const configured = oauthConfigured || connected;
  const mode = identity?.mode === "oauth" ? "OAuth HubSpot" : identity?.mode === "service_token" ? "Connexion serveur Gando" : configured ? "OAuth configuré" : "Non configuré";
  const hubspotState = connected ? "Opérationnel" : configured ? "À reconnecter" : "Non configuré";
  const query = searchParams ? await searchParams : {};

  return <>
    <PageHeader title="Intégrations" description="Allo pour les appels et leurs résumés IA ; HubSpot pour les contacts, entreprises et suivi commercial." />
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">Allo <Badge variant={allo.connected ? "default" : "outline"}>{state}</Badge></CardTitle><CardDescription>API Allo déjà configurée ; composeur intégré au Cockpit via l’iframe officiel Allo.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Connexion API</div><div className="mt-1 font-semibold">{state}</div></div><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Permissions disponibles</div><div className="mt-1 break-words text-xs">{allo.scopes.length ? allo.scopes.join(" · ") : "Non communiquées par Allo"}</div></div></div>
          {allo.error ? <p className="rounded-lg border border-destructive/40 p-3 text-xs text-destructive">{allo.error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button asChild><a href="/phone">Voir les appels Allo</a></Button><Button asChild variant="outline"><a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Ouvrir Allo <ExternalLink size={13}/></a></Button><Button asChild variant="outline"><a href="https://help.withallo.com/en/integrations/dialer/embedded-dialer" target="_blank" rel="noopener noreferrer">Activation du domaine <ExternalLink size={13}/></a></Button></div>
          <p className="text-xs text-muted-foreground">Le téléphone intégré est indépendant de la clé API : Allo doit autoriser le domaine room.gando.pro. Les commerciaux se connectent directement dans le composeur embarqué. Les activités peuvent continuer à être synchronisées automatiquement par l’intégration native Allo–HubSpot.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base">HubSpot <Badge variant={connected ? "default" : "outline"}>{hubspotState}</Badge></CardTitle><CardDescription>CRM de référence : contacts, entreprises, responsables commerciaux et historique HubSpot.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {query.hubspot === "reconnected" ? <div className="rounded-lg border border-border bg-muted px-3 py-2">HubSpot a bien été reconnecté.</div> : null}
          {query.hubspot === "error" ? <div className="rounded-lg border border-destructive/40 px-3 py-2 text-destructive">La reconnexion HubSpot a échoué.</div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Mode</div><div className="mt-1 font-semibold">{mode}</div></div><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">État API</div><div className="mt-1 font-semibold">{hubspotState}</div></div></div>
          <Button asChild><a href="/api/auth/hubspot?returnTo=%2Fsettings%2Fintegrations">{connected ? "Reconnecter HubSpot" : "Connecter HubSpot"}</a></Button>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><Radio size={14} /> Cockpit · Allo + HubSpot</div>
    </div>
  </>;
}

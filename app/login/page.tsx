import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { isHubSpotAuthenticated, isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isHubSpotAuthenticated()) redirect("/today");
  const { error } = await searchParams;
  const oauthReady = isHubSpotOAuthConfigured();
  const requestOrigin = `https://${(await headers()).get("host") || ""}`;

  return (
    <main className="app-bg relative grid min-h-screen place-items-center overflow-hidden p-4">
      <div className="app-bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-violet-400/10 blur-[120px]" />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="brand-mark mx-auto grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white">G</div>
          <h1 className="font-display mt-5 text-3xl font-bold tracking-tight">Gando Sales Cockpit</h1>
          <p className="mt-2 text-sm text-muted-foreground">Votre file d’appels priorisée, synchronisée avec HubSpot.</p>
        </div>

        <Card className="panel shadow-glow-lg">
          <CardHeader>
            <Badge variant="outline" className="mb-2 w-fit border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Connexion sécurisée
            </Badge>
            <CardTitle>Continuer avec HubSpot</CardTitle>
            <CardDescription>Les contacts, tâches et activités restent dans HubSpot. Aucun token n’est exposé au navigateur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="space-y-3">
                <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
                <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
                  <div className="font-semibold text-foreground">Vérifiez la configuration de l’app HubSpot (developers.hubspot.com → Manage apps)</div>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                    <li>La <strong>Redirect URL</strong> doit être exactement : <code className="font-mono">{`${requestOrigin}/api/auth/hubspot/callback`}</code></li>
                    <li>Tous les scopes demandés doivent être cochés : contacts, entreprises, deals, propriétaires et listes (lecture + écriture).</li>
                    <li>L’app doit être publiée et le compte utilisé doit être autorisé à l’installer.</li>
                  </ol>
                </div>
              </div>
            ) : null}
            {oauthReady ? (
              <Button asChild size="lg" className="h-12 w-full justify-between">
                <a href="/api/auth/hubspot"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Se connecter à HubSpot</span><ArrowRight className="h-4 w-4" /></a>
              </Button>
            ) : (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                Configurez <code>HUBSPOT_CLIENT_ID</code>, <code>HUBSPOT_CLIENT_SECRET</code>, <code>HUBSPOT_REDIRECT_URI</code> et <code>SESSION_SECRET</code> pour activer la connexion. Le token privé <code>HUBSPOT_PRIVATE_APP_TOKEN</code> n’est accepté qu’en développement local.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

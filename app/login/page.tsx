import { redirect } from "next/navigation";
import { ArrowRight, Building2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { isCockpitAuthenticated } from "@/lib/auth";
import { isHubSpotOAuthConfigured } from "@/lib/hubspot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isCockpitAuthenticated()) redirect("/prospection");

  const { error } = await searchParams;
  const oauthReady = isHubSpotOAuthConfigured();

  return (
    <main className="app-bg relative grid min-h-screen place-items-center overflow-hidden p-4">
      <div className="app-bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-orange-400/10 blur-[120px]" />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="brand-mark mx-auto grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white">G</div>
          <h1 className="font-display mt-5 text-3xl font-bold tracking-tight">Gando Sales Cockpit</h1>
          <p className="mt-2 text-sm text-muted-foreground">Connectez-vous à votre espace commercial Gando.</p>
        </div>

        <Card className="panel shadow-glow-lg">
          <CardHeader>
            <Badge variant="outline" className="mb-2 w-fit border-orange-400/30 bg-orange-400/10 text-orange-300">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Accès équipe Gando
            </Badge>
            <CardTitle>Se connecter</CardTitle>
            <CardDescription>
              Utilisez votre compte interne Gando. L’inscription libre n’est pas disponible sur le Sales Cockpit.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <form action="/api/auth/password" method="post" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="vous@gando.app"
                    className="h-11 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="h-11 pl-10"
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="h-12 w-full justify-between">
                <span>Se connecter</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {oauthReady ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button asChild variant="outline" size="lg" className="h-12 w-full justify-between">
                  <a href="/api/auth/hubspot">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#ff7a59]" />
                      Continuer avec HubSpot
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </>
            ) : null}

            <p className="text-center text-[11px] leading-5 text-muted-foreground">
              Aucun compte ne peut être créé depuis cette interface. Les accès sont provisionnés par Gando.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

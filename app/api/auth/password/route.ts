import { NextResponse } from "next/server";
import { createCockpitSession, verifyCockpitCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";

function loginRedirect(request: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
    303,
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  if (!email || !password) {
    return loginRedirect(request, "Renseignez votre email et votre mot de passe.");
  }

  try {
    const user = await verifyCockpitCredentials(email, password);
    if (!user) return loginRedirect(request, "Email ou mot de passe incorrect.");

    await createCockpitSession({
      email: user.email,
      displayName: user.displayName,
      provider: "password",
    });

    return NextResponse.redirect(new URL("/prospection", request.url), 303);
  } catch (error) {
    console.error("Cockpit password sign-in failed", error);
    return loginRedirect(request, "La connexion est momentanément indisponible.");
  }
}

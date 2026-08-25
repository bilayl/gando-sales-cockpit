import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type OpenRouterKeySource = "vercel" | "supabase-vault" | "none";

export async function resolveOpenRouterApiKey(): Promise<{ apiKey: string; source: OpenRouterKeySource }> {
  const envKey = process.env.OPENROUTER_API_KEY?.trim();
  if (envKey) return { apiKey: envKey, source: "vercel" };

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("get_openrouter_api_key");
    if (error) {
      console.error("OpenRouter Vault RPC:", error.message);
      return { apiKey: "", source: "none" };
    }
    const vaultKey = typeof data === "string" ? data.trim() : "";
    return vaultKey
      ? { apiKey: vaultKey, source: "supabase-vault" }
      : { apiKey: "", source: "none" };
  } catch (error) {
    console.error("OpenRouter Vault fallback:", error);
    return { apiKey: "", source: "none" };
  }
}

export async function getOpenRouterSalesStatus() {
  const { apiKey, source } = await resolveOpenRouterApiKey();
  return {
    configured: Boolean(apiKey),
    source,
    model: process.env.OPENROUTER_MODEL?.trim() || "~openai/gpt-latest",
  };
}

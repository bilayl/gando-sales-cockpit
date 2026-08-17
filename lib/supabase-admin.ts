import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Client administrateur Supabase, créé paresseusement à la première utilisation.
 * Permet à `next build` d'évaluer les modules sans que l'URL Supabase soit
 * disponible (elle n'est définie que dans l'environnement de production).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !/^https?:\/\/.+/.test(url) || !key) {
      throw new Error("Supabase est mal configuré : vérifiez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return client;
}
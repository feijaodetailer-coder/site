import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config";

let client: SupabaseClient | null = null;
/** Cliente do navegador (sessão guardada no localStorage). Criado só quando necessário. */
export function getSupabase() {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  return client;
}

/**
 * Dados PÚBLICOS do projeto Supabase (Project Settings → API). A chave "anon"/"publishable" foi feita
 * para ficar no navegador; o que protege os dados é a Edge Function `api` e o RLS das tabelas.
 * NUNCA coloque aqui a chave "service_role" / "secret".
 *
 * Preencha abaixo ou defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dqgyhlfsethmucylxcao.supabase.co").replace(/\/$/, "");
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_by0TcsxawjLlrQeKAD6jLg_s-hsXZds";
export const supabaseConfigured = !SUPABASE_URL.includes("SEU-PROJETO") && !SUPABASE_ANON_KEY.startsWith("SUA-CHAVE");

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config";
import { getSupabase } from "./supabase";
import { withBase } from "./base";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/api`;

async function accessToken() {
  try { return (await getSupabase().auth.getSession()).data.session?.access_token ?? null; } catch { return null; }
}

/**
 * Substitui o `fetch("/api/...")` do servidor antigo: chama a Edge Function `api` do Supabase,
 * enviando o login (se houver) no cabeçalho Authorization.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_ANON_KEY);
  headers.set("Authorization", `Bearer ${(await accessToken()) ?? SUPABASE_ANON_KEY}`);
  try {
    return await fetch(`${FUNCTION_URL}${path.replace(/^\/api/, "")}`, { ...init, headers });
  } catch {
    return Response.json({ error: "Sem conexão com o servidor. Verifique a internet e tente novamente." }, { status: 503 });
  }
}

/** Abre um anexo privado: o navegador não consegue enviar o login em <a href>, então baixamos como arquivo. */
export async function openProtectedFile(path: string) {
  const popup = window.open("", "_blank");
  try {
    const response = await apiFetch(path);
    if (!response.ok) throw new Error();
    const url = URL.createObjectURL(await response.blob());
    if (popup) popup.location.href = url; else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    popup?.close();
    window.alert("Não foi possível abrir o arquivo.");
  }
}

export async function signInWithGoogle(returnPath = "/admin/") {
  await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${withBase(returnPath)}` } });
}

export async function signOutEverywhere() {
  try { await getSupabase().auth.signOut(); } catch { /* sessão local já removida */ }
}

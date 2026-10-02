// Edge Function `api` — substitui as antigas rotas /api/* do site (Cloudflare Workers + D1 + R2).
// Variáveis fornecidas pelo Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
// Segredos a configurar: OWNER_EMAIL (e-mail Google do administrador) e, opcionalmente, ALLOWED_ORIGINS.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Database, type Executor } from "./db.ts";
import { setRuntime, type Storage } from "./lib.ts";
import { handle } from "./router.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 4, idle_timeout: 20 });
const exec = (runner: { unsafe: (query: string, params: any[]) => any }): Executor => async (query, params) => {
  const rows = await runner.unsafe(query, params as any[]);
  return { rows: Array.from(rows) as Record<string, any>[], count: rows.count ?? rows.length };
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

const storage: Storage = {
  async put(bucket, key, bytes, contentType) {
    const body = typeof bytes === "string" ? new Blob([bytes], { type: contentType }) : new Blob([bytes], { type: contentType });
    const { error } = await admin.storage.from(bucket).upload(key, body, { contentType, upsert: false });
    if (error) throw new Error("Armazenamento indisponível.");
  },
  async get(bucket, key) {
    const { data, error } = await admin.storage.from(bucket).download(key);
    return error || !data ? null : { body: data, type: data.type };
  },
  async has(bucket, key) {
    const slash = key.lastIndexOf("/");
    const { data } = await admin.storage.from(bucket).list(slash < 0 ? "" : key.slice(0, slash), { search: key.slice(slash + 1), limit: 5 });
    return !!data?.some(file => file.name === key.slice(slash + 1));
  },
  async remove(bucket, key) { await admin.storage.from(bucket).remove([key]); },
  async list(bucket, prefix) {
    const { data } = await admin.storage.from(bucket).list(prefix.replace(/\/$/, ""), { limit: 1000, sortBy: { column: "name", order: "asc" } });
    return (data ?? []).map(file => ({ name: `${prefix}${file.name}`, size: Number((file.metadata as { size?: number } | null)?.size ?? 0) }));
  },
};

setRuntime({
  db: new Database({
    query: exec(sql),
    transaction: fn => sql.begin(tx => fn(exec(tx))) as Promise<any>,
  }),
  storage,
  ownerEmails: (Deno.env.get("OWNER_EMAIL") ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean),
  async verifyToken(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    const user = data.user;
    return { id: user.id, email: user.email ?? "", name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""), confirmed: !!user.email_confirmed_at };
  },
});

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(origin => origin.trim().replace(/\/$/, "")).filter(Boolean);
Deno.serve(request => handle(request, allowedOrigins));

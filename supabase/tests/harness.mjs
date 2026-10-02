// Executa a Edge Function `api` (router + handlers) contra um Postgres real em memória (PGlite),
// usando a migração oficial. Assim o SQL e as regras de negócio são exercitados sem precisar do Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Database } from "../functions/api/db.ts";
import { setRuntime } from "../functions/api/lib.ts";
import { handle } from "../functions/api/router.ts";

const migration = readFileSync(new URL("../migrations/20261002000000_schema_inicial.sql", import.meta.url), "utf8");

export const users = {
  admin: { id: "00000000-0000-4000-8000-000000000001", email: "dono@example.com", name: "Dono", confirmed: true },
  // Um e-mail diferente do dono, mesmo com login válido, nunca vira administrador.
  intruder: { id: "00000000-0000-4000-8000-000000000002", email: "outro@example.com", name: "Outro", confirmed: true },
  ana: { id: "00000000-0000-4000-8000-0000000000a1", email: "cliente-5531999990001@auth.feijaodetailer.invalid", name: "Ana", confirmed: true },
  bia: { id: "00000000-0000-4000-8000-0000000000b2", email: "cliente-5531999990002@auth.feijaodetailer.invalid", name: "Bia", confirmed: true },
};

export async function createApi() {
  const pg = new PGlite();
  await pg.exec("create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit int); create role anon; create role authenticated;");
  await pg.exec(migration);
  const exec = runner => async (sql, params) => {
    const result = await runner.query(sql, params);
    return { rows: result.rows, count: result.affectedRows ?? result.rows.length };
  };
  const files = new Map();
  setRuntime({
    db: new Database({ query: exec(pg), transaction: fn => pg.transaction(tx => fn(exec(tx))) }),
    storage: {
      async put(bucket, key, bytes, type) { files.set(`${bucket}/${key}`, { body: new Blob([bytes], { type }), type, size: bytes.byteLength ?? String(bytes).length }); },
      async get(bucket, key) { return files.get(`${bucket}/${key}`) ?? null; },
      async has(bucket, key) { return files.has(`${bucket}/${key}`); },
      async remove(bucket, key) { files.delete(`${bucket}/${key}`); },
      async list(bucket, prefix) { return [...files].filter(([k]) => k.startsWith(`${bucket}/${prefix}`)).map(([k, v]) => ({ name: k.slice(bucket.length + 1), size: v.size })); },
    },
    ownerEmails: ["dono@example.com"],
    async verifyToken(token) { return users[token] ?? null; },
  });
  const call = async (as, method, path, body) => {
    const headers = { origin: "https://feijaodetailer-coder.github.io" };
    if (as) headers.authorization = `Bearer ${as}`;
    let payload;
    if (["GET", "HEAD", "OPTIONS"].includes(method)) payload = undefined;
    else if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const response = await handle(new Request(`https://x.supabase.co/functions/v1/api${path}`, { method, headers, body: payload }));
    const type = response.headers.get("content-type") || "";
    return { status: response.status, headers: response.headers, body: type.includes("json") ? await response.json() : await response.blob() };
  };
  return { pg, call, files };
}

/** Próximo dia útil (segunda a sexta) a pelo menos 3 dias de hoje, no formato AAAA-MM-DD. */
export function nextWeekday(offset = 3) {
  const d = new Date(Date.now() + offset * 86400000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

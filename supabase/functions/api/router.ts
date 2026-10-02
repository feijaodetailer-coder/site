import { backupsGet } from "./backup.ts";
import { dataGet, dataPatch, dataPost } from "./data.ts";
import { filesGet, filesPost } from "./files.ts";
import { financeGet, financeMutate } from "./finance.ts";
import { reply } from "./lib.ts";
import { publicGet, publicPost } from "./public.ts";
import { customerAuthPost, sessionGet, siteSettingsGet, siteSettingsPut } from "./site.ts";
import { workflowGet, workflowPost } from "./workflow.ts";

type Handler = (request: Request) => Promise<Response>;
const routes: Record<string, Partial<Record<string, Handler>>> = {
  data: { GET: dataGet, POST: dataPost, PATCH: dataPatch },
  workflow: { GET: workflowGet, POST: workflowPost },
  public: { GET: publicGet, POST: publicPost },
  finance: { GET: financeGet, POST: r => financeMutate(r, "POST"), PATCH: r => financeMutate(r, "PATCH"), DELETE: r => financeMutate(r, "DELETE") },
  "site-settings": { GET: siteSettingsGet, PUT: siteSettingsPut },
  session: { GET: sessionGet },
  "customer-auth": { POST: customerAuthPost },
  files: { GET: filesGet, POST: filesPost },
  backups: { GET: backupsGet },
};

function corsHeaders(request: Request, allowed: string[]) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function handle(request: Request, allowedOrigins: string[] = []) {
  const cors = corsHeaders(request, allowedOrigins);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) return withHeaders(reply({ error: "Origem não permitida." }, 403), cors);
  const name = new URL(request.url).pathname.split("/").filter(Boolean).pop() || "";
  const handler = routes[name]?.[request.method];
  if (!handler) return withHeaders(reply({ error: routes[name] ? "Método não permitido." : "Rota não encontrada." }, routes[name] ? 405 : 404), cors);
  try { return withHeaders(await handler(request), cors); }
  catch { return withHeaders(reply({ error: "Não foi possível concluir. Tente novamente." }, 500), cors); }
}

function withHeaders(response: Response, headers: Record<string, string>) {
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) next.headers.set(key, value);
  return next;
}

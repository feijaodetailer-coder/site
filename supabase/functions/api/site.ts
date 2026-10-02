import { defaultSiteDisplay, parseSiteDisplay } from "../_shared/site-display.ts";
import { db, identity, json, now, noAccess, reply, runtime, text } from "./lib.ts";
import { clientLoginEmail } from "./customer.ts";

export const siteDisplayRecordId = "site-display";

export async function readSiteDisplay() {
  const row = await db().prepare("SELECT data,version FROM workflow_records WHERE id=? AND kind='site_config'").bind(siteDisplayRecordId).first<{ data: unknown; version: number }>();
  return { settings: row ? parseSiteDisplay(row.data) : defaultSiteDisplay, version: row?.version ?? 0 };
}

export async function siteSettingsGet() {
  try { return reply(await readSiteDisplay(), 200, { "Cache-Control": "no-store" }); }
  catch { return reply({ error: "Não foi possível carregar as configurações." }, 503); }
}

export async function siteSettingsPut(request: Request) {
  try {
    const who = await identity(request);
    if (!who.admin || !who.user) return noAccess();
    const raw = await request.text();
    if (raw.length > 64000) return reply({ error: "Configurações muito grandes." }, 413);
    const input = JSON.parse(raw);
    const settings = parseSiteDisplay(input.settings);
    if (!Number.isSafeInteger(input.version) || input.version < 0) throw new Error("Versão inválida.");
    const stamp = now();
    const result = await db().prepare(`INSERT INTO workflow_records(id,kind,status,data,version,created_at,updated_at)
      SELECT ?::text,'site_config','ativo',?::jsonb,1,?::text,?::text WHERE ?::int=0 OR EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text)
      ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,version=workflow_records.version+1,updated_at=EXCLUDED.updated_at
      WHERE workflow_records.kind='site_config' AND workflow_records.version=?::int`)
      .bind(siteDisplayRecordId, json(settings), stamp, stamp, input.version, siteDisplayRecordId, input.version).run();
    if (!result.meta.changes) return reply({ error: "Outra edição foi salva. Recarregue as configurações antes de tentar novamente." }, 409);
    return reply({ settings, version: input.version + 1 }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, 400);
  }
}

export async function sessionGet(request: Request) {
  const { user, admin } = await identity(request);
  return reply({ signedIn: !!user, admin, name: user?.displayName || "" }, 200, { "Cache-Control": "private, no-store" });
}

/**
 * Conclui o cadastro/entrada do cliente depois que o Supabase Auth validou telefone + senha.
 * O token é verificado pelo servidor; o identificador do cliente nunca vem do navegador.
 */
export async function customerAuthPost(request: Request) {
  const denied = () => reply({ error: "Não foi possível validar o acesso. Confira seus dados e tente novamente." }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 12000) return reply({ error: "Confira os dados e tente novamente." }, 400);
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const mode = text(payload.mode, 20);
    if (!["register", "login"].includes(mode)) return denied();
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const auth = token ? await runtime().verifyToken(token).catch(() => null) : null;
    if (!auth) return denied();
    const phone = clientLoginEmail(payload.phone);
    if (auth.email.toLowerCase() !== phone.email) return denied();
    const userId = `supabase:${auth.id}`;
    const d = db();
    let client = await d.prepare("SELECT id,name,phone,vehicle,plate,email FROM clients WHERE user_id=?").bind(userId).first<{ id: number; name: string; phone: string; vehicle: string; plate: string; email: string }>();

    if (mode === "register" && !client) {
      const name = text(payload.name, 100), vehicle = text(payload.vehicle, 100), plate = text(payload.plate, 12).toUpperCase();
      const email = text(payload.contactEmail, 160), address = text(payload.address, 240);
      if (!name || !vehicle || (email && !/^\S+@\S+\.\S+$/.test(email))) return reply({ error: "Preencha nome, veículo e um e-mail válido, se quiser informar." }, 400);
      const created = await d.prepare("INSERT INTO clients (name,phone,vehicle,plate,notes,user_id,email,address) VALUES (?,?,?,?,?,?,?,?) RETURNING id,name,phone,vehicle,plate,email")
        .bind(name, phone.phone, vehicle, plate, "", userId, email, address).first<{ id: number; name: string; phone: string; vehicle: string; plate: string; email: string }>();
      if (!created) throw new Error("Não foi possível criar seu cadastro.");
      const stamp = now();
      await d.prepare("INSERT INTO workflow_records (id,kind,client_id,status,data,created_at,updated_at) VALUES (?,'vehicle',?,'aberto',?::jsonb,?,?)")
        .bind(`vehicle-${crypto.randomUUID()}`, created.id, json({ title: vehicle, plate }), stamp, stamp).run();
      client = created;
    }
    if (!client) return denied();
    const oldRecords = await d.prepare("SELECT phone FROM clients WHERE id<>?").bind(client.id).all<{ phone: string }>();
    const possibleExistingHistory = mode === "register" && oldRecords.results.some(row => row.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") === phone.digits.slice(2));
    return reply({ ok: true, name: client.name, possibleExistingHistory }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    if (error instanceof Error && /telefone brasileiro/.test(error.message)) return reply({ error: error.message }, 400);
    return reply({ error: "Não foi possível concluir o acesso agora. Tente novamente." }, 500);
  }
}

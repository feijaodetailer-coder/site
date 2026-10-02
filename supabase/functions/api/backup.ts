import { db, failure, now, noAccess, reply, runtime, identity } from "./lib.ts";

export const BACKUP_TABLES = ["clients", "services", "bookings", "transactions", "financial_categories", "plan_subscriptions", "workflow_records", "attachments", "audit_log"];

/** Salva no máximo uma cópia por dia, no primeiro acesso da gestão. */
export async function dailyBackup() {
  const day = now().slice(0, 10), key = `backups/${day}.json`;
  if (await runtime().storage.has("backups", key)) return { saved: true, date: day };
  const contents: Record<string, unknown> = { exportedAt: now() };
  for (const table of BACKUP_TABLES) contents[table] = (await db().prepare(`SELECT * FROM ${table}`).all()).results;
  await runtime().storage.put("backups", key, JSON.stringify(contents), "application/json");
  return { saved: true, date: day };
}

export async function backupsGet(request: Request) {
  try {
    const who = await identity(request);
    if (!who.admin) return noAccess();
    const day = new URL(request.url).searchParams.get("date");
    if (!day) {
      const list = await runtime().storage.list("backups", "backups/");
      return reply({ backups: list.map(o => ({ date: o.name.slice(8, 18), size: o.size })).reverse() }, 200, { "Cache-Control": "private, no-store" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error("Data inválida.");
    const file = await runtime().storage.get("backups", `backups/${day}.json`);
    if (!file) return new Response("Cópia não encontrada", { status: 404 });
    return new Response(file.body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="feijao-${day}.json"`, "Cache-Control": "private, no-store" } });
  } catch (e) { return failure(e); }
}

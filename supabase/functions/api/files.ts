import { db, failure, identity, noAccess, now, record, reply, runtime, text } from "./lib.ts";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function filesPost(request: Request) {
  try {
    const who = await identity(request);
    if (!who.user) return noAccess();
    if (Number(request.headers.get("content-length") || 0) > 6000000) throw Error("Arquivo muito grande. Limite: 5 MB.");
    const form = await request.formData(), file = form.get("file"), recordId = text(form.get("recordId"));
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || !file.size || !ALLOWED.includes(file.type)) throw Error("Envie JPG, PNG, WebP ou PDF de até 5 MB.");
    let cid: number | null = null;
    if (recordId.startsWith("plan:")) {
      const p = await db().prepare("SELECT client_id FROM plan_subscriptions WHERE id=?").bind(Number(recordId.slice(5))).first<{ client_id: number }>();
      cid = p?.client_id || null;
    } else {
      const r = await record(recordId);
      if (r && ["order", "inspection"].includes(r.kind)) cid = r.client_id;
      if (!who.admin) return noAccess();
    }
    if (!cid || (!who.admin && cid !== who.client?.id)) return noAccess();
    const id = crypto.randomUUID(), bytes = await file.arrayBuffer(), head = new Uint8Array(bytes.slice(0, 12));
    const valid = file.type === "application/pdf" ? new TextDecoder().decode(head).startsWith("%PDF-") : file.type === "image/jpeg" ? head[0] === 255 && head[1] === 216 : file.type === "image/png" ? head[0] === 137 && head[1] === 80 : new TextDecoder().decode(head).startsWith("RIFF");
    if (!valid) throw Error("O conteúdo não corresponde ao formato informado.");
    await runtime().storage.put("attachments", id, bytes, file.type);
    try {
      await db().prepare("INSERT INTO attachments(id,record_id,client_id,name,type,shared,created_at) VALUES(?,?,?,?,?,?,?)").bind(id, recordId, cid, text(file.name, 160), file.type, who.admin && form.get("shared") === "true" ? 1 : 0, now()).run();
    } catch (e) { await runtime().storage.remove("attachments", id); throw e; }
    return reply({ ok: true, id });
  } catch (e) { return failure(e); }
}

export async function filesGet(request: Request) {
  try {
    const who = await identity(request);
    if (!who.user) return noAccess();
    const id = new URL(request.url).searchParams.get("id");
    const file = await db().prepare("SELECT * FROM attachments WHERE id=?").bind(id).first<{ client_id: number; shared: number; record_id: string; type: string }>();
    if (!file || (!who.admin && (file.client_id !== who.client?.id || (!file.shared && !file.record_id.startsWith("plan:"))))) return noAccess();
    const object = await runtime().storage.get("attachments", id!);
    if (!object) return new Response("Arquivo não encontrado", { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (e) { return failure(e); }
}

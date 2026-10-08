import { offerIsVisible } from "../_shared/site-display.ts";
import { isWithinBusinessHours, brazilNow } from "../_shared/availability.ts";
import { reminders, dayInBrazil, campaignData, validDay } from "../_shared/vehicle-hub.ts";
import { audit, amount, BLOCK_OVERLAP_SQL, BOOKING_OVERLAP_SQL, checkAvailability, db, failure, identity, insert, json, noAccess, now, record, reply, reserveBooking, text, type Row } from "./lib.ts";
import { dailyBackup } from "./backup.ts";
import { readSiteDisplay } from "./site.ts";

const kinds = ["vehicle", "quote", "quote_template", "order", "inspection", "product", "movement", "followup", "planrule", "benefit", "bill", "block", "settings", "campaign"];
const normalized = (value: unknown) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
const hasVitrification = (data: Record<string, any>, services: { name: string; description: string; category: string }[]) => {
  const names = (Array.isArray(data.items) ? data.items : []).map((item: any) => normalized(item?.name)).filter(Boolean);
  const matched = services.filter(service => names.includes(normalized(service.name)));
  return [...names, ...matched.flatMap(service => [service.name, service.description, service.category])].some(value => normalized(value).includes("vitrific"));
};
const vitrificationFollowup = (id: string, data: Record<string, any>) => ({ title: `Manutenção de vitrificação · ${data.title || "Serviço"}`, type: "Vitrificação", date: data.maintenanceDate || "", notes: "Defina a data da próxima manutenção e registre aqui quando ela for realizada.", orderId: id, vehicleId: data.vehicleId || "" });
const BOOKING_STATUS_BY_ORDER = (status: string) => status === "entregue" ? "concluido" : status === "cancelado" ? "cancelado" : status === "aguardando entrada" ? "agendado" : "em andamento";

export async function workflowGet(request: Request) {
  try {
    const who = await identity(request);
    if (!who.user) return reply({ admin: false, signedIn: false, records: [], clients: [], bookings: [], plans: [], files: [], services: [], transactions: [] }, 200, { "Cache-Control": "no-store" });
    const d = db(), cid = who.client?.id || -1;
    if (who.admin) {
      await d.prepare("INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at) SELECT 'legacy-vehicle-'||id,'vehicle',id,'aberto',jsonb_build_object('title',vehicle,'plate',plate,'notes',notes),?,? FROM clients WHERE vehicle<>'' ON CONFLICT DO NOTHING").bind(now(), now()).run();
      await d.prepare(`INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at)
        SELECT 'booking-'||b.id,'order',b.client_id,CASE b.status WHEN 'concluido' THEN 'entregue' WHEN 'em andamento' THEN 'execução' ELSE 'aguardando entrada' END,
        jsonb_build_object('title',s.name,'items',jsonb_build_array(jsonb_build_object('name',s.name,'qty',1,'price',b.amount)),'total',b.amount,'discount',0,'paid',b.paid,'bookingId',b.id,'notes',b.notes),?,?
        FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.status IN ('agendado','em andamento','concluido')
        AND NOT EXISTS(SELECT 1 FROM workflow_records r WHERE r.kind='order' AND r.data->>'bookingId'=b.id::text) ON CONFLICT DO NOTHING`).bind(now(), now()).run();
      const [delivered, serviceRows] = await Promise.all([d.prepare("SELECT * FROM workflow_records WHERE kind='order' AND status='entregue'").all<Row>(), d.prepare("SELECT name,description,category FROM services").all<{ name: string; description: string; category: string }>()]);
      const maintenanceRows = delivered.results.filter(order => hasVitrification(order.data, serviceRows.results));
      if (maintenanceRows.length) await d.batch(maintenanceRows.map(order => insert(`vitrification-${order.id}`, "followup", order.client_id, order.id, "aberto", vitrificationFollowup(order.id, order.data))));
    }
    const backup = who.admin ? await dailyBackup().catch(() => ({ saved: false, error: "Não foi possível salvar a cópia diária. Use a exportação manual." })) : null;
    const { settings: displaySettings } = await readSiteDisplay();
    const rows = who.admin ? await d.prepare("SELECT * FROM workflow_records ORDER BY created_at DESC").all<Row>()
      : await d.prepare("SELECT * FROM workflow_records WHERE (client_id=? AND kind IN ('vehicle','quote','order','inspection','followup','benefit','notification_read','review')) OR kind='planrule' OR (kind='campaign' AND status='ativa' AND data->>'starts'<=? AND data->>'ends'>=?) ORDER BY created_at DESC").bind(cid, dayInBrazil(), dayInBrazil()).all<Row>();
    const [clients, bookings, plans, services, files, transactions] = await Promise.all([
      who.admin ? d.prepare("SELECT * FROM clients ORDER BY name").all() : d.prepare("SELECT id,name,phone,vehicle,plate,email FROM clients WHERE id=?").bind(cid).all(),
      who.admin ? d.prepare("SELECT b.*,s.name AS service_name,s.duration AS service_duration,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration FROM bookings b JOIN services s ON s.id=b.service_id ORDER BY start_at DESC").all()
        : d.prepare("SELECT b.id,b.start_at,b.status,b.amount,b.paid,b.service_id,s.name AS service_name,s.duration AS service_duration,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.client_id=? ORDER BY start_at DESC").bind(cid).all(),
      d.prepare(`SELECT p.*,s.name AS plan_name FROM plan_subscriptions p JOIN services s ON s.id=p.plan_service_id ${who.admin ? "" : "WHERE p.client_id=?"} ORDER BY requested_at DESC`).bind(...(who.admin ? [] : [cid])).all(),
      d.prepare("SELECT * FROM services ORDER BY name").all(),
      d.prepare(`SELECT * FROM attachments ${who.admin ? "" : "WHERE client_id=? AND (shared=1 OR record_id LIKE 'plan:%')"}`).bind(...(who.admin ? [] : [cid])).all(),
      who.admin ? d.prepare("SELECT * FROM transactions ORDER BY date DESC,id DESC").all() : Promise.resolve({ results: [] }),
    ]);
    const visibleServices = who.admin ? services.results : services.results.filter(service => offerIsVisible(displaySettings, service as { id: number; category: string }));
    return reply({ admin: who.admin, signedIn: true, backup, accountKey: who.user.userId, profile: who.client, records: rows.results, clients: clients.results, bookings: bookings.results, plans: plans.results, services: visibleServices, files: files.results, transactions: transactions.results }, 200, { "Cache-Control": "private, no-store" });
  } catch (e) { return failure(e); }
}

export async function workflowPost(request: Request) {
  try {
    const who = await identity(request);
    if (!who.user) return noAccess();
    const raw = await request.text();
    if (raw.length > 64000) throw Error("Registro muito grande.");
    const p = JSON.parse(raw), d = db(), actor = who.user.userId;
    if (p.action === "read_notification") {
      if (!who.client) return noAccess();
      const own = await d.prepare("SELECT * FROM workflow_records WHERE client_id=? AND kind IN ('order','notification_read')").bind(who.client.id).all<Row>();
      const bookings = await d.prepare("SELECT b.*,s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.client_id=?").bind(who.client.id).all<any>();
      const notification = reminders(own.results as any, bookings.results).find(n => n.id === text(p.notificationId) && n.due);
      if (!notification) return noAccess();
      await insert("notice:" + who.client.id + ":" + notification.id, "notification_read", who.client.id, null, "lida", { notificationId: notification.id }).run();
      return reply({ ok: true });
    }
    if (p.action === "link_client") {
      if (!who.admin) return noAccess();
      const target = await d.prepare("SELECT id FROM clients WHERE user_id=?").bind(text(p.accountKey)).first<{ id: number }>();
      const source = await d.prepare("SELECT id,user_id FROM clients WHERE id=?").bind(Number(p.clientId)).first<{ id: number; user_id: string | null }>();
      if (!target || !source || source.user_id || target.id === source.id) throw Error("Selecione um cadastro sem vínculo e uma conta de cliente já cadastrada.");
      await d.batch([
        d.prepare("UPDATE bookings SET client_id=? WHERE client_id=?").bind(target.id, source.id),
        d.prepare("UPDATE plan_subscriptions SET client_id=? WHERE client_id=?").bind(target.id, source.id),
        d.prepare("UPDATE workflow_records SET client_id=? WHERE client_id=?").bind(target.id, source.id),
        d.prepare("UPDATE attachments SET client_id=? WHERE client_id=?").bind(target.id, source.id),
        audit(actor, `Histórico do cliente ${source.id} vinculado à conta ${target.id}`, String(source.id)),
      ]);
      return reply({ ok: true });
    }
    if (p.action === "delete_quote_template") {
      if (!who.admin) return noAccess();
      const template = await record(text(p.id));
      if (template?.kind !== "quote_template") throw Error("Modelo não encontrado.");
      if (template.version !== Number(p.version)) throw Error("Modelo alterado. Atualize antes de excluir.");
      await d.batch([d.prepare("DELETE FROM workflow_records WHERE id=? AND kind='quote_template' AND version=?").bind(template.id, template.version), audit(actor, "Modelo de orçamento excluído", template.id)]);
      return reply({ ok: true });
    }
    if (p.action === "cancel_order") {
      if (!who.admin) return noAccess();
      const order = await record(text(p.id));
      if (order?.kind !== "order") throw Error("OS não encontrada.");
      if (order.status === "cancelado") return reply({ ok: true, id: order.id });
      if (order.status === "entregue") throw Error("Uma OS entregue não pode ser cancelada. Corrija o registro em vez disso.");
      const version = Number(p.version);
      if (order.version !== version) throw Error("OS alterada. Atualize antes de cancelar.");
      const stamp = now();
      const results = await d.batch([
        d.prepare("UPDATE workflow_records SET status='cancelado',version=version+1,updated_at=? WHERE id=? AND kind='order' AND version=? AND status<>'entregue'").bind(stamp, order.id, version),
        ...(order.data.bookingId ? [d.prepare("UPDATE bookings SET status='cancelado' WHERE id=? AND status IN ('solicitado','agendado','em andamento')").bind(Number(order.data.bookingId))] : []),
        audit(actor, "OS cancelada", order.id),
      ]);
      if (!results[0]?.count) throw Error("A OS foi alterada. Atualize e tente novamente.");
      return reply({ ok: true, id: order.id });
    }
    if (p.action === "schedule_order") {
      if (!who.admin) return noAccess();
      const order = await record(text(p.id));
      if (order?.kind !== "order" || order.status === "cancelado") throw Error("OS indisponível.");
      const data = order.data;
      if (data.bookingId) throw Error("Esta OS já possui agendamento. Use a agenda para reagendar.");
      const service = await d.prepare("SELECT id,booking_duration FROM services WHERE id=?").bind(Number(p.serviceId)).first<{ id: number; booking_duration: number }>();
      if (!service) throw Error("Serviço inválido.");
      await checkAvailability(text(p.startAt), service.booking_duration);
      // A referência determinística da OS nas notas faz com que novas tentativas reutilizem o mesmo agendamento.
      const booking = await reserveBooking(order.client_id!, service.id, text(p.startAt), service.booking_duration, data.total, data.paid || 0, `OS:${order.id}`);
      await d.batch([d.prepare("UPDATE workflow_records SET data=jsonb_set(data,'{bookingId}',?::jsonb),version=version+1,updated_at=? WHERE id=?").bind(json(booking.id), now(), order.id), audit(actor, "OS agendada", order.id)]);
      return reply({ ok: true });
    }
    if (p.action === "profile") {
      if (text(p.name).length < 2 || !/^\d{10,13}$/.test(text(p.phone).replace(/\D/g, ""))) throw Error("Informe nome e WhatsApp válidos.");
      await d.prepare("INSERT INTO clients(name,phone,vehicle,plate,notes,user_id,email) VALUES(?,?,'','','',?,?) ON CONFLICT(user_id) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone").bind(text(p.name, 80), text(p.phone, 30), actor, who.user.email).run();
      return reply({ ok: true });
    }
    if (p.action === "quote_decision") {
      const q = await record(text(p.id));
      if (!q || q.kind !== "quote" || (!who.admin && q.client_id !== who.client?.id)) return noAccess();
      if (q.status !== "enviado") throw Error("O orçamento já foi analisado ou ainda não foi enviado.");
      const data = { ...q.data };
      if (data.validUntil && data.validUntil < now().slice(0, 10)) throw Error("Orçamento vencido. Solicite uma atualização.");
      if (!["aprovado", "recusado"].includes(p.status)) throw Error("Decisão inválida.");
      if (p.status === "recusado") { const reason = text(p.reason, 500); if (reason.length < 3) throw Error("Informe o motivo da recusa."); data.declineReason = reason; }
      const orderId = `os-${q.id}`, stamp = now();
      await d.batch([
        ...(p.status === "aprovado" ? [d.prepare("INSERT INTO workflow_records(id,kind,client_id,parent_id,status,data,created_at,updated_at) SELECT ?::text,'order',?::int,?::text,'aguardando entrada',?::jsonb,?::text,?::text WHERE EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text AND status='enviado') ON CONFLICT DO NOTHING").bind(orderId, q.client_id, q.id, json({ ...data, quoteId: q.id, paid: 0, checkIn: [], checkOut: [], minutes: 0 }), stamp, stamp, q.id)] : []),
        d.prepare("UPDATE workflow_records SET status=?,data=?::jsonb,version=version+1,updated_at=? WHERE id=? AND status='enviado'").bind(p.status, json(data), stamp, q.id),
        audit(actor, p.status === "recusado" ? `Orçamento recusado: ${text(data.declineReason, 120)}` : `Orçamento ${p.status}`, q.id),
      ]);
      return reply({ ok: true });
    }
    if (p.action === "payment") {
      if (!who.admin) return noAccess();
      const row = await record(text(p.id));
      if (!row || !["order", "bill"].includes(row.kind) || row.status === "cancelado") throw Error("Conta não encontrada ou cancelada.");
      const data = row.data, value = amount(p.amount);
      if (value <= 0 || value > data.total - (data.paid || 0)) throw Error("Valor maior que o saldo ou inválido.");
      const version = Number(p.version);
      if (row.version !== version) throw Error("Registro alterado. Atualize antes de receber.");
      const paid = (data.paid || 0) + value, stamp = now();
      await d.batch([
        d.prepare("INSERT INTO transactions(date,kind,category,description,amount,payment_method,financial_status,record_id) SELECT ?::text,?::text,?::text,?::text,?::int,?::text,?::text,?::text WHERE EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text AND version=?::int)")
          .bind(text(p.date, 10) || stamp.slice(0, 10), row.kind === "bill" && data.direction === "pagar" ? "saida" : "entrada", data.category || "Serviços", `${data.title || "OS"} #${row.id.slice(-8)}`, value, text(p.method, 30) || "Pix", "pago", row.id, row.id, version),
        ...(data.bookingId ? [d.prepare("UPDATE bookings SET paid=? WHERE id=? AND EXISTS(SELECT 1 FROM workflow_records WHERE id=? AND version=?)").bind(paid, Number(data.bookingId), row.id, version)] : []),
        d.prepare("UPDATE workflow_records SET data=?::jsonb,version=version+1,updated_at=? WHERE id=? AND version=?").bind(json({ ...data, paid }), stamp, row.id, version),
        audit(actor, "Pagamento registrado", row.id),
      ]);
      return reply({ ok: true });
    }
    if (p.action === "stock") {
      if (!who.admin) return noAccess();
      const product = await record(text(p.id));
      if (!product || product.kind !== "product") throw Error("Produto não encontrado.");
      const data = product.data, quantity = Number(p.quantity), version = Number(p.version);
      if (!Number.isFinite(quantity) || quantity === 0 || Number(data.quantity || 0) + quantity < 0) throw Error("Quantidade inválida ou estoque insuficiente.");
      if (product.version !== version) throw Error("Estoque alterado. Atualize.");
      const order = p.orderId ? await record(text(p.orderId)) : null;
      if (p.orderId && order?.kind !== "order") throw Error("Ordem inválida.");
      const id = crypto.randomUUID(), stamp = now(), movement = { title: data.title, quantity, unit: data.unit, cost: Math.round((data.unitCost || 0) * -quantity), note: text(p.note) };
      await d.batch([
        d.prepare("INSERT INTO workflow_records(id,kind,client_id,parent_id,status,data,created_at,updated_at) SELECT ?::text,'movement',?::int,?::text,'registrado',?::jsonb,?::text,?::text WHERE EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text AND version=?::int)").bind(id, order?.client_id || null, order?.id || product.id, json(movement), stamp, stamp, product.id, version),
        d.prepare("UPDATE workflow_records SET data=?::jsonb,version=version+1,updated_at=? WHERE id=? AND version=?").bind(json({ ...data, quantity: Number(data.quantity || 0) + quantity }), stamp, product.id, version),
        audit(actor, "Movimentação de estoque", product.id),
      ]);
      return reply({ ok: true });
    }
    if (p.action === "reschedule") {
      const id = Number(p.id), b = await d.prepare("SELECT * FROM bookings WHERE id=?").bind(id).first<{ client_id: number; status: string; service_id: number }>();
      if (!b || (!who.admin && b.client_id !== who.client?.id)) return noAccess();
      if (!["solicitado", "agendado"].includes(b.status)) throw Error("Somente agendamentos ainda não iniciados podem ser alterados.");
      if (p.cancel) await d.prepare("UPDATE bookings SET status='cancelado' WHERE id=? AND status IN ('solicitado','agendado')").bind(id).run();
      else {
        const startAt = text(p.startAt), service = await d.prepare("SELECT booking_duration FROM services WHERE id=?").bind(b.service_id).first<{ booking_duration: number }>();
        if (!service || !isWithinBusinessHours(startAt, service.booking_duration) || startAt <= brazilNow()) throw Error("Escolha um horário futuro disponível dentro do expediente.");
        await checkAvailability(startAt, service.booking_duration, id);
        const moved = await d.prepare(`UPDATE bookings SET start_at=?,booking_duration=?,status='agendado' WHERE id=? AND status IN ('solicitado','agendado')
          AND NOT ${BOOKING_OVERLAP_SQL} AND NOT ${BLOCK_OVERLAP_SQL} RETURNING id`)
          .bind(startAt, service.booking_duration, id, id, startAt, startAt, service.booking_duration, startAt, startAt, service.booking_duration).first<{ id: number }>();
        if (!moved) throw Error("Esse horário acabou de ficar indisponível. Escolha outro.");
      }
      if (p.cancel) await d.prepare("UPDATE workflow_records SET status='cancelado',version=version+1,updated_at=? WHERE kind='order' AND data->>'bookingId'=?").bind(now(), String(id)).run();
      else await d.prepare("UPDATE workflow_records SET data=jsonb_set(data,'{delivery}',?::jsonb),version=version+1,updated_at=? WHERE kind='order' AND data->>'bookingId'=?").bind(json(text(p.startAt)), now(), String(id)).run();
      await audit(actor, p.cancel ? "Cancelamento" : "Reagendamento confirmado", String(id)).run();
      return reply({ ok: true });
    }
    if (p.action === "plan_cancel") {
      const plan = await d.prepare("SELECT client_id FROM plan_subscriptions WHERE id=?").bind(Number(p.id)).first<{ client_id: number }>();
      if (!plan || (!who.admin && plan.client_id !== who.client?.id)) return noAccess();
      await d.prepare("UPDATE plan_subscriptions SET status='cancelado' WHERE id=?").bind(Number(p.id)).run();
      await audit(actor, "Plano cancelado", String(p.id)).run();
      return reply({ ok: true });
    }
    if (p.action === "benefit") {
      if (!who.admin) return noAccess();
      const plan = await d.prepare("SELECT * FROM plan_subscriptions WHERE id=? AND status='ativo' AND expires_at>?").bind(Number(p.planId), now()).first<{ id: number; client_id: number; plan_service_id: number }>();
      if (!plan) throw Error("Plano inativo ou vencido.");
      const rule = await record(`rule-${plan.plan_service_id}`);
      const limit = rule ? Number(rule.data.visits) : 0;
      if (!limit) throw Error("Defina os atendimentos incluídos no plano.");
      const used = await d.prepare("SELECT count(*)::int AS n FROM workflow_records WHERE kind='benefit' AND parent_id=?").bind(`plan:${plan.id}`).first<{ n: number }>();
      if ((used?.n || 0) >= limit) throw Error("Benefícios esgotados.");
      // O identificador determinístico garante o limite mesmo com pedidos simultâneos.
      await d.batch([insert(`benefit-${plan.id}-${used?.n || 0}`, "benefit", plan.client_id, `plan:${plan.id}`, "utilizado", { title: text(p.title), date: now().slice(0, 10) }), audit(actor, "Benefício utilizado", String(plan.id))]);
      return reply({ ok: true });
    }
    if (p.action === "save") return await saveRecord(p, who as any, actor);
    if (p.action === "backup") {
      if (!who.admin) return noAccess();
      const tables = ["clients", "services", "bookings", "transactions", "financial_categories", "plan_subscriptions", "workflow_records", "attachments", "audit_log"];
      const result: Record<string, unknown> = { exportedAt: now() };
      for (const table of tables) result[table] = (await d.prepare(`SELECT * FROM ${table}`).all()).results;
      return reply(result, 200, { "Content-Disposition": `attachment; filename="feijao-backup-${now().slice(0, 10)}.json"` });
    }
    return reply({ error: "Ação inválida" }, 400);
  } catch (e) { return failure(e); }
}

async function saveRecord(p: any, who: { admin: boolean; client: { id: number } | null }, actor: string) {
  const d = db();
  const kind = text(p.kind);
  if (!kinds.includes(kind) || ["movement", "benefit"].includes(kind)) throw Error("Tipo inválido.");
  if (!who.admin && !["vehicle", "quote", "followup"].includes(kind)) return noAccess();
  const old = p.id ? await record(text(p.id)) : null;
  if (p.id && !old && !(who.admin && (kind === "planrule" || kind === "settings"))) throw Error("Registro não encontrado.");
  if (old && (old.kind !== kind || (!who.admin && old.client_id !== who.client?.id))) return noAccess();
  if (old && old.version !== Number(p.version)) throw Error("Registro alterado. Atualize para continuar.");
  if (old?.kind === "quote" && ["aprovado", "recusado"].includes(old.status)) throw Error("Crie um novo orçamento para alterar uma proposta já analisada.");
  const cid = who.admin ? (Number(p.clientId) || null) : who.client?.id || null;
  if (old?.client_id && old.client_id !== cid) throw Error("O cliente de um registro existente não pode ser alterado. Use o vínculo de histórico nas configurações.");
  if (["vehicle", "quote", "order", "inspection", "followup"].includes(kind) && !cid) throw Error("Cadastre ou selecione o cliente primeiro.");
  if (cid && !await d.prepare("SELECT id FROM clients WHERE id=?").bind(cid).first()) throw Error("Cliente inválido.");
  const input = p.data || {}, data: Record<string, any> = {};
  let status = text(p.status, 40) || "aberto";
  const allowed: Record<string, string[]> = { campaign: ["title", "description", "offer", "terms", "starts", "ends"], vehicle: ["title", "year", "plate", "km", "notes", "protection"], quote: ["title", "items", "discount", "validUntil", "delivery", "vehicleId", "notes"], quote_template: ["title", "items", "discount", "notes"], order: ["title", "items", "discount", "validUntil", "delivery", "vehicleId", "notes", "checkIn", "checkOut", "minutes", "fuel", "km", "objects", "damages", "maintenanceDate", "completedDate", "sendReminders", "bookingId", "productsUsed"], inspection: ["title", "stage", "km", "fuel", "objects", "damages", "checks"], product: ["title", "supplier", "unit", "quantity", "minimum", "unitCost", "expires", "category", "brand", "volume", "purchasePrice", "startDate", "endDate"], followup: ["title", "date", "type", "notes", "rating"], planrule: ["title", "visits", "included", "frequency", "validity", "renewal", "cancellation", "scheduling"], bill: ["title", "total", "due", "direction", "category", "costType"], block: ["title", "start", "end"], settings: ["title", "address", "phone", "instructions"] };
  for (const key of allowed[kind] || []) if (input[key] !== undefined) data[key] = input[key];
  const arrays = ["items", "checkIn", "checkOut", "damages", "checks", "productsUsed"];
  for (const key of Object.keys(data)) if (!arrays.includes(key) && key !== "sendReminders") data[key] = text(data[key]);
  for (const key of ["checkIn", "checkOut", "damages", "checks"]) if (data[key] !== undefined) { if (!Array.isArray(data[key]) || data[key].length > 30) throw Error("Checklist inválido."); data[key] = (data[key] as unknown[]).map(x => text(x, 150)); }
  if (data.productsUsed !== undefined) { if (!Array.isArray(data.productsUsed) || data.productsUsed.length > 30) throw Error("Seleção de produtos inválida."); data.productsUsed = [...new Set((data.productsUsed as unknown[]).map(x => text(x, 120)))]; }
  if (!text(data.title, 120)) throw Error("Informe o título ou nome.");
  data.title = text(data.title, 120);
  const parent = text(p.parentId) || null;
  if (parent) { const linked = await record(parent); if (!linked || linked.client_id !== cid) throw Error("Vínculo inválido."); }
  if (["quote", "order"].includes(kind)) {
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 50) throw Error("Inclua ao menos um serviço.");
    data.items = data.items.map((i: Record<string, unknown>) => { const qty = Number(i.qty); if (!Number.isInteger(qty) || qty < 1 || qty > 100) throw Error("Quantidade inválida."); return { name: text(i.name, 150), qty, price: amount(i.price) }; });
    data.discount = amount(data.discount || 0);
    data.total = (data.items as { qty: number; price: number }[]).reduce((sum, i) => sum + i.qty * i.price, 0) - Number(data.discount);
    if (Number(data.total) < 0) throw Error("Desconto maior que o total.");
    if (data.vehicleId) { const v = await record(text(data.vehicleId)); if (v?.kind !== "vehicle" || v.client_id !== cid) throw Error("Veículo não pertence ao cliente."); }
    if (!who.admin) { if (old && old.status !== "solicitado") throw Error("Orçamento em análise não pode ser editado."); status = "solicitado"; data.total = 0; data.discount = 0; data.items = (data.items as { name: string; qty: number }[]).map(i => ({ ...i, price: 0 })); }
    else if (kind === "quote" && !["rascunho", "enviado", "solicitado"].includes(status)) throw Error("Use a aprovação do orçamento para gerar a OS.");
    if (kind === "order") {
      data.sendReminders = input.sendReminders === true || input.sendReminders === "true" ? true : (old ? old.data.sendReminders !== false : false);
      if (!["aguardando entrada", "inspeção", "execução", "revisão", "pronto", "entregue", "cancelado"].includes(status)) throw Error("Etapa inválida.");
      data.paid = old ? old.data.paid || 0 : 0;
      if (Number(data.total) < Number(data.paid)) throw Error("O total não pode ser menor que o valor recebido.");
      if (old) data.bookingId = old.data.bookingId || null;
      const previousProducts = new Set<string>(old ? old.data.productsUsed || [] : []), serviceDate = text(input.completedDate, 10) || dayInBrazil();
      for (const productId of (data.productsUsed || []) as string[]) {
        const product = await record(productId);
        if (product?.kind !== "product") throw Error("Produto selecionado não encontrado.");
        const productData = product.data;
        if (productData.startDate && serviceDate < productData.startDate) throw Error("A data da OS é anterior ao início deste ciclo de produto.");
        if (productData.endDate && serviceDate > productData.endDate && !previousProducts.has(productId)) throw Error("Esse ciclo já havia terminado na data desta OS. Selecione um produto em uso naquele período.");
      }
    }
  }
  if (kind === "quote_template") {
    if (!who.admin || cid || parent) throw Error("Somente a gestão pode salvar modelos de orçamento.");
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 50) throw Error("Inclua ao menos um serviço no modelo.");
    data.items = data.items.map((item: Record<string, unknown>) => { const qty = Number(item.qty); if (!Number.isInteger(qty) || qty < 1 || qty > 100) throw Error("Quantidade inválida no modelo."); return { name: text(item.name, 150), qty, price: amount(item.price) }; });
    data.discount = amount(data.discount || 0);
    data.notes = text(data.notes, 2000);
  }
  if (kind === "vehicle") { data.plate = text(data.plate, 12).toUpperCase(); if (Number(data.km || 0) < 0) throw Error("Quilometragem inválida."); }
  if (kind === "product") {
    const previous = old ? old.data : {};
    data.unitCost = input.unitCost !== undefined ? amount(input.unitCost || 0) : Number(previous.unitCost || 0);
    data.purchasePrice = amount(data.purchasePrice || 0);
    for (const k of ["quantity", "minimum"]) { data[k] = input[k] !== undefined ? Number(data[k] || 0) : Number(previous[k] || 0); if (!Number.isFinite(data[k]) || Number(data[k]) < 0) throw Error("Quantidade inválida."); }
    const startDate = text(data.startDate, 10), endDate = text(data.endDate, 10);
    if (!text(data.brand, 100) || !text(data.category, 100) || !text(data.volume, 80) || !validDay(startDate) || startDate > dayInBrazil()) throw Error("Informe categoria, marca, embalagem e data de início válidas, até hoje.");
    data.brand = text(data.brand, 100); data.category = text(data.category, 100); data.volume = text(data.volume, 80); data.startDate = startDate; data.endDate = endDate;
    if (endDate && (!validDay(endDate) || endDate < startDate || endDate > dayInBrazil())) throw Error("Informe um término válido, entre o início do ciclo e hoje.");
    if (Number(data.purchasePrice) <= 0) throw Error("Informe o valor pago da embalagem.");
    if (old) data.quantity = previous.quantity;
  }
  if (kind === "bill") { data.total = amount(data.total); data.paid = old ? old.data.paid || 0 : 0; if (!["pagar", "receber"].includes(text(data.direction)) || Number(data.total) < Number(data.paid)) throw Error("Conta inválida."); }
  if (kind === "planrule" && (!Number.isInteger(Number(data.visits)) || Number(data.visits) < 1)) throw Error("Quantidade de benefícios inválida.");
  if (kind === "block" && (!data.start || !data.end || String(data.end) <= String(data.start))) throw Error("Período inválido.");
  if (!who.admin && kind === "followup") status = "aberto";
  if (kind === "campaign") {
    if (cid || parent) throw Error("Campanhas são destinadas à área de todos os clientes.");
    Object.assign(data, campaignData(input, status));
  }
  if (kind === "order") {
    const previous = old ? old.data : {};
    if (status === "entregue") {
      data.completedDate = previous.completedDate || dayInBrazil();
      if (input.completedDate !== undefined && input.completedDate !== "") { if (!validDay(input.completedDate) || input.completedDate > dayInBrazil()) throw Error("Informe uma data de realização válida, até hoje."); data.completedDate = input.completedDate; }
    } else if (previous.completedDate) { data.completedDate = previous.completedDate; }
  }
  const id = old?.id || (kind === "planrule" ? text(p.id) : kind === "settings" ? "company" : crypto.randomUUID()), stamp = now();
  const statements = [
    old ? d.prepare("UPDATE workflow_records SET client_id=?,parent_id=?,status=?,data=?::jsonb,version=version+1,updated_at=? WHERE id=? AND version=?").bind(cid, parent, status, json(data), stamp, id, old.version) : insert(id, kind, cid, parent, status, data),
    audit(actor, `${kind}: ${status}`, id),
  ];
  if (kind === "order" && data.bookingId) statements.push(d.prepare("UPDATE bookings SET amount=?,paid=?,status=? WHERE id=? AND EXISTS(SELECT 1 FROM workflow_records WHERE id=? AND version=? AND updated_at=?)").bind(data.total, data.paid, BOOKING_STATUS_BY_ORDER(status), Number(data.bookingId), id, (old?.version || 0) + 1, stamp));
  if (kind === "order" && status === "entregue") {
    const services = (await d.prepare("SELECT name,description,category FROM services").all<{ name: string; description: string; category: string }>()).results;
    const vitrification = hasVitrification(data, services);
    const followupData = vitrification ? vitrificationFollowup(id, data) : { title: `Manutenção: ${data.title}`, date: data.maintenanceDate || "", type: "Manutenção", notes: "Confirmar com o cliente o próximo cuidado." };
    statements.push(d.prepare("INSERT INTO workflow_records(id,kind,client_id,parent_id,status,data,created_at,updated_at) SELECT ?::text,'followup',?::int,?::text,'aberto',?::jsonb,?::text,?::text WHERE EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text AND status='entregue') ON CONFLICT DO NOTHING").bind(vitrification ? `vitrification-${id}` : `followup-${id}`, cid, id, json(followupData), stamp, stamp, id));
  }
  await d.batch(statements);
  return reply({ ok: true, id });
}

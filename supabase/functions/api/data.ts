import { catalog } from "../_shared/catalog.ts";
import { BLOCK_OVERLAP_SQL, BOOKING_OVERLAP_SQL, checkAvailability, db, ensureBookingOrder, identity, json, localDate, now, reply, reserveBooking } from "./lib.ts";

const PRICE_RECOMMENDATION_ID = "price-recommendations-bh-2026-v1";
const denied = () => reply({ error: "Acesso não autorizado" }, 401);
const fail = (message: string, status = 400) => reply({ error: message }, status);
const clean = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => Math.round(Number(value) * 100);
// A tela de gestão ainda lê o campo `data` dos registros como texto JSON.
const asText = (row: any) => ({ ...row, data: JSON.stringify(row.data) });

export async function dataGet(request: Request) {
  if (!(await identity(request)).admin) return denied();
  try {
    const d = db();
    const count = await d.prepare("SELECT COUNT(*)::int AS total FROM services").first<{ total: number }>();
    if (!count?.total) await d.batch(catalog.map(item => d.prepare("INSERT INTO services (name,category,price,duration,booking_duration,description) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING").bind(item.name, item.category, item.price, item.duration, item.bookingDuration ?? 30, item.description)));
    const [clients, services, bookings, transactions, plans, vehicles, orders, referralEvents] = await Promise.all([
      d.prepare("SELECT * FROM clients ORDER BY name").all(),
      d.prepare("SELECT * FROM services ORDER BY name").all(),
      d.prepare("SELECT b.*,s.name AS service_name,s.duration AS service_duration,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration FROM bookings b JOIN services s ON s.id=b.service_id ORDER BY b.start_at DESC").all(),
      d.prepare("SELECT * FROM transactions ORDER BY date DESC, id DESC").all(),
      d.prepare("SELECT * FROM plan_subscriptions ORDER BY requested_at DESC").all(),
      d.prepare("SELECT * FROM workflow_records WHERE kind='vehicle' ORDER BY created_at DESC").all(),
      d.prepare("SELECT * FROM workflow_records WHERE kind='order' AND status='entregue' ORDER BY updated_at DESC").all(),
      d.prepare("SELECT r.*,c.name AS referred_name FROM referral_events r LEFT JOIN clients c ON c.id=r.referred_client_id ORDER BY r.created_at DESC").all(),
    ]);
    const pricingApplied = await d.prepare("SELECT id FROM workflow_records WHERE id=?").bind(PRICE_RECOMMENDATION_ID).first();
    return reply({ clients: clients.results, services: services.results, bookings: bookings.results, transactions: transactions.results, plans: plans.results, vehicles: vehicles.results.map(asText), orders: orders.results.map(asText), referralEvents: referralEvents.results, pricingRecommendationsApplied: Boolean(pricingApplied) });
  } catch (e) { return fail(e instanceof Error ? e.message : "Falha ao carregar", 500); }
}

export async function dataPost(request: Request) {
  if (!(await identity(request)).admin) return denied();
  try {
    const p = await request.json() as Record<string, unknown>;
    const d = db();
    if (p.table === "price_recommendations") {
      if (await d.prepare("SELECT id FROM workflow_records WHERE id=?").bind(PRICE_RECOMMENDATION_ID).first()) return fail("Os valores de referência já foram aplicados. Você pode editar cada serviço individualmente.", 409);
      const current = await d.prepare("SELECT name FROM services").all<{ name: string }>();
      const available = new Set(current.results.map(row => row.name));
      if (catalog.filter(item => !available.has(item.name)).length) return fail("O catálogo mudou desde a preparação dos valores. Atualize a gestão antes de aplicar.");
      const stamp = now();
      const statements = catalog.map(item => d.prepare("UPDATE services SET price=?,duration=?,booking_duration=? WHERE name=?").bind(item.price, item.duration, item.bookingDuration ?? 30, item.name));
      statements.push(d.prepare("INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES (?,'settings','aplicado',?::jsonb,?,?)").bind(PRICE_RECOMMENDATION_ID, json({ title: "Valores de referência BH · 2026", version: 1 }), stamp, stamp));
      await d.batch(statements);
      return reply({ ok: true, pricingRecommendationsApplied: true });
    }
    if (p.table === "clients") {
      if (!clean(p.name)) return fail("Informe o nome do cliente.");
      const referredBy = Number(p.referredByClientId) || null;
      const additionalVehicles = Array.isArray(p.additionalVehicles) ? p.additionalVehicles.map((item: unknown) => {
        const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { title: clean(value.vehicle ?? value.title).slice(0,100), plate: clean(value.plate).slice(0,12).toUpperCase() };
      }) : [];
      if (additionalVehicles.length > 9 || additionalVehicles.some(vehicle => !vehicle.title)) return fail("Confira os veículos adicionais (máximo de 9).");
      if (referredBy && !await d.prepare("SELECT id FROM clients WHERE id=?").bind(referredBy).first()) return fail("Cliente indicador não encontrado.");
      const added = await d.prepare("INSERT INTO clients (name,phone,vehicle,plate,notes,address,referred_by_client_id) VALUES (?,?,?,?,?,?,?) RETURNING id").bind(clean(p.name), clean(p.phone), clean(p.vehicle), clean(p.plate).toUpperCase(), clean(p.notes), clean(p.address), referredBy).first<{ id: number }>();
      if (added && additionalVehicles.length) {
        const stamp = now();
        await d.batch(additionalVehicles.map(vehicle => d.prepare("INSERT INTO workflow_records (id,kind,client_id,status,data,created_at,updated_at) VALUES (?,'vehicle',?,'aberto',?::jsonb,?,?)")
          .bind(`vehicle-${crypto.randomUUID()}`, added.id, JSON.stringify(vehicle), stamp, stamp)));
      }
      if (referredBy && added) await d.prepare("INSERT INTO referral_events (client_id,referred_client_id,event_type,description,created_at) VALUES (?,?, 'indicacao', ?, ?)").bind(referredBy, added.id, `Indicou ${clean(p.name)}`, now()).run();
    } else if (p.table === "referralEvents") {
      const clientId = Number(p.clientId), description = clean(p.description);
      if (!clientId || !description) return fail("Informe a cortesia e o cliente.");
      if (!await d.prepare("SELECT id FROM clients WHERE id=?").bind(clientId).first()) return fail("Cliente não encontrado.");
      await d.prepare("INSERT INTO referral_events (client_id,event_type,description,created_at) VALUES (?, 'cortesia', ?, ?)").bind(clientId, description, now()).run();
    } else if (p.table === "services") {
      if (!clean(p.name) || !Number.isFinite(money(p.price)) || money(p.price) < 0) return fail("Informe nome e preço válido.");
      await d.prepare("INSERT INTO services (name,category,price,duration,booking_duration,description) VALUES (?,?,?,?,?,?)").bind(clean(p.name), clean(p.category) || "Outros", money(p.price), Math.max(1, Number(p.duration) || 60), Math.max(1, Number(p.bookingDuration) || 30), clean(p.description)).run();
    } else if (p.table === "bookings") {
      const clientId = Number(p.clientId), serviceId = Number(p.serviceId), startAt = clean(p.startAt);
      if (!clientId || !serviceId || !startAt) return fail("Selecione cliente, serviço e horário.");
      const service = await d.prepare("SELECT price,booking_duration FROM services WHERE id=?").bind(serviceId).first<{ price: number; booking_duration: number }>();
      if (!service) return fail("Serviço não encontrado.");
      if (!Number.isFinite(new Date(startAt).getTime())) return fail("Horário inválido.");
      await checkAvailability(startAt, service.booking_duration);
      const added = await reserveBooking(clientId, serviceId, startAt, service.booking_duration, service.price, 0, clean(p.notes));
      if (added) await ensureBookingOrder(added.id);
    } else if (p.table === "transactions") {
      const kind = clean(p.kind), amount = money(p.amount);
      if (!["entrada", "saida"].includes(kind) || !clean(p.description) || !Number.isFinite(amount) || amount <= 0) return fail("Preencha tipo, descrição e valor válido.");
      await d.prepare("INSERT INTO transactions (date,kind,category,description,amount) VALUES (?,?,?,?,?)").bind(clean(p.date) || new Date().toISOString().slice(0, 10), kind, clean(p.category), clean(p.description), amount).run();
    } else return fail("Cadastro inválido.");
    return reply({ ok: true });
  } catch (e) { return fail(e instanceof Error ? e.message : "Falha ao salvar", 500); }
}

export async function dataPatch(request: Request) {
  if (!(await identity(request)).admin) return denied();
  try {
    const p = await request.json() as Record<string, unknown>;
    const d = db();
    if (p.table === "services") {
      const id = Number(p.id), name = clean(p.name), rawPrice = Number(p.price), price = money(p.price), duration = Number(p.duration), bookingDuration = Number(p.bookingDuration);
      if (!id || !name || !Number.isFinite(rawPrice) || rawPrice < 0 || !Number.isInteger(duration) || duration < 1 || !Number.isInteger(bookingDuration) || bookingDuration < 1 || bookingDuration > 240) return fail("Informe nome, preço e durações válidos.");
      const updated = await d.prepare("UPDATE services SET name=?,category=?,price=?,duration=?,booking_duration=?,description=? WHERE id=? RETURNING id").bind(name, clean(p.category) || "Outros", price, duration, bookingDuration, clean(p.description), id).first();
      if (!updated) return fail("Serviço não encontrado.", 404);
      return reply({ ok: true });
    }
    if (p.table === "clients") {
      const id = Number(p.id), name = clean(p.name);
      if (!id || !name) return fail("Informe o nome do cliente.");
      const updated = await d.prepare("UPDATE clients SET name=?,phone=?,vehicle=?,plate=?,address=?,notes=? WHERE id=? RETURNING id").bind(name, clean(p.phone), clean(p.vehicle), clean(p.plate).toUpperCase(), clean(p.address), clean(p.notes), id).first();
      if (!updated) return fail("Cliente não encontrado.", 404);
      return reply({ ok: true });
    }
    if (p.table === "bookings" && p.action === "edit") {
      const id = Number(p.id), serviceId = Number(p.serviceId), startAt = clean(p.startAt), notes = clean(p.notes);
      if (!id || !serviceId || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startAt)) return fail("Informe serviço, data e horário válidos.");
      const booking = await d.prepare("SELECT status,paid FROM bookings WHERE id=?").bind(id).first<{ status: string; paid: number }>();
      if (!booking || !["solicitado", "agendado"].includes(booking.status)) return fail("Somente agendamentos ainda não iniciados podem ser editados.");
      const service = await d.prepare("SELECT name,price,booking_duration FROM services WHERE id=?").bind(serviceId).first<{ name: string; price: number; booking_duration: number }>();
      if (!service) return fail("Serviço não encontrado.");
      if (booking.paid > service.price) return fail("O valor do novo serviço é menor que o pagamento já recebido.");
      await checkAvailability(startAt, service.booking_duration, id);
      const changed = await d.prepare(`UPDATE bookings SET service_id=?,start_at=?,booking_duration=?,notes=?,amount=?,status='agendado' WHERE id=? AND status IN ('solicitado','agendado')
        AND NOT ${BOOKING_OVERLAP_SQL} AND NOT ${BLOCK_OVERLAP_SQL} RETURNING id`)
        .bind(serviceId, startAt, service.booking_duration, notes, service.price, id, id, startAt, startAt, service.booking_duration, startAt, startAt, service.booking_duration).first<{ id: number }>();
      if (!changed) return fail("Horário ocupado. Atualize a agenda e escolha outro horário.");
      await ensureBookingOrder(id);
      const linked = await d.prepare("SELECT id,data FROM workflow_records WHERE kind='order' AND data->>'bookingId'=?").bind(String(id)).first<{ id: string; data: Record<string, any> }>();
      if (linked) {
        const item = { ...linked.data, title: service.name, items: [{ name: service.name, qty: 1, price: service.price }], total: service.price, delivery: startAt, notes };
        await d.prepare("UPDATE workflow_records SET data=?::jsonb,status='aguardando entrada',version=version+1,updated_at=? WHERE id=?").bind(json(item), now(), linked.id).run();
      }
      return reply({ ok: true });
    }
    if (p.table === "bookings" && p.action === "set_amount") {
      const linked = await d.prepare("SELECT id FROM workflow_records WHERE kind='order' AND data->>'bookingId'=?").bind(String(Number(p.id))).first();
      if (linked) return fail("Altere o valor pela ordem de serviço vinculada.");
      const amount = money(p.amount);
      if (!Number(p.id) || !Number.isFinite(amount) || amount < 0) return fail("Valor inválido.");
      await d.prepare("UPDATE bookings SET amount=? WHERE id=? AND status<>'cancelado'").bind(amount, Number(p.id)).run();
      return reply({ ok: true });
    }
    if (p.table === "plans") {
      const id = Number(p.id), action = clean(p.action);
      if (!id || !["authorize", "reject"].includes(action)) return fail("Ação inválida.");
      if (action === "reject") {
        await d.prepare("UPDATE plan_subscriptions SET status='recusado' WHERE id=? AND status='pendente'").bind(id).run();
        return reply({ ok: true });
      }
      const row = await d.prepare("SELECT p.amount,p.status,c.name AS client_name,s.name AS plan_name FROM plan_subscriptions p JOIN clients c ON c.id=p.client_id JOIN services s ON s.id=p.plan_service_id WHERE p.id=?").bind(id).first<{ amount: number; status: string; client_name: string; plan_name: string }>();
      if (!row || row.status !== "pendente") return fail("Solicitação já analisada.");
      const today = new Date(), expires = new Date(today);
      expires.setUTCMonth(expires.getUTCMonth() + 1);
      await d.batch([
        d.prepare("INSERT INTO transactions (date,kind,category,description,amount,record_id,payment_method) SELECT ?::text,'entrada','Planos mensais',?::text,?::int,?::text,'Pix' WHERE EXISTS (SELECT 1 FROM plan_subscriptions WHERE id=?::int AND status='pendente')").bind(localDate(), `${row.plan_name} · ${row.client_name}`, row.amount, `plan:${id}`, id),
        d.prepare("UPDATE plan_subscriptions SET status='ativo',authorized_at=?,expires_at=? WHERE id=? AND status='pendente'").bind(today.toISOString(), expires.toISOString(), id),
      ]);
      return reply({ ok: true });
    }
    if (p.table === "bookings" && p.action === "receive") {
      const id = Number(p.id);
      const linked = await d.prepare("SELECT id FROM workflow_records WHERE kind='order' AND data->>'bookingId'=?").bind(String(id)).first();
      if (linked) return fail("Registre o pagamento na ordem de serviço vinculada.");
      const row = await d.prepare("SELECT b.amount,b.paid,s.name AS service_name,c.name AS client_name FROM bookings b JOIN services s ON s.id=b.service_id JOIN clients c ON c.id=b.client_id WHERE b.id=? AND b.status<>'cancelado'").bind(id).first<{ amount: number; paid: number; service_name: string; client_name: string }>();
      if (!row || row.paid >= row.amount) return fail("Este atendimento já foi recebido ou está cancelado.");
      await d.batch([
        d.prepare("UPDATE bookings SET paid=amount WHERE id=? AND paid<amount").bind(id),
        d.prepare("INSERT INTO transactions (date,kind,category,description,amount,booking_id) VALUES (?,?,?,?,?,?)").bind(new Date().toISOString().slice(0, 10), "entrada", "Serviços", `${row.service_name} · ${row.client_name}`, row.amount - row.paid, id),
      ]);
      return reply({ ok: true });
    }
    if (p.table !== "bookings" || !Number(p.id) || !["solicitado", "agendado", "em andamento", "concluido", "cancelado"].includes(clean(p.status))) return fail("Alteração inválida.");
    const bookingStatus = clean(p.status), bookingId = Number(p.id);
    if (bookingStatus === "agendado") {
      const target = await d.prepare("SELECT b.start_at,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=?").bind(bookingId).first<{ start_at: string; duration: number }>();
      if (!target) return fail("Atendimento não encontrado.");
      await checkAvailability(target.start_at, target.duration, bookingId);
    }
    const orderStatus = bookingStatus === "concluido" ? "entregue" : bookingStatus === "cancelado" ? "cancelado" : bookingStatus === "em andamento" ? "execução" : bookingStatus === "agendado" ? "aguardando entrada" : null;
    const statements = [d.prepare("UPDATE bookings SET status=? WHERE id=?").bind(bookingStatus, bookingId)];
    if (orderStatus) statements.push(d.prepare("UPDATE workflow_records SET status=?::text,data=CASE WHEN ?::text='entregue' THEN jsonb_set(data,'{completedDate}',to_jsonb(COALESCE(data->>'completedDate',?::text))) ELSE data END,version=version+1,updated_at=? WHERE kind='order' AND data->>'bookingId'=?").bind(orderStatus, orderStatus, localDate(), now(), String(bookingId)));
    await d.batch(statements);
    if (bookingStatus === "agendado") await ensureBookingOrder(bookingId);
    return reply({ ok: true });
  } catch (e) { return fail(e instanceof Error ? e.message : "Falha ao atualizar", 500); }
}

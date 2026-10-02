import { catalog } from "../_shared/catalog.ts";
import { availableBookingSlots, isWithinBusinessHours, brazilNow } from "../_shared/availability.ts";
import { offerIsVisible } from "../_shared/site-display.ts";
import { db, identity, reply, ensureBookingOrder, reserveBooking } from "./lib.ts";
import { readSiteDisplay } from "./site.ts";

const jsonError = (message: string, status = 400) => reply({ error: message }, status);
const value = (input: unknown, max: number) => String(input ?? "").trim().slice(0, max);
const noStore = { "Cache-Control": "no-store" };

async function ensureCatalog() {
  const count = await db().prepare("SELECT COUNT(*)::int AS total FROM services").first<{ total: number }>();
  if (!count?.total) await db().batch(catalog.map(item => db().prepare("INSERT INTO services (name,category,price,duration,booking_duration,description) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING").bind(item.name, item.category, item.price, item.duration, item.bookingDuration ?? 30, item.description)));
}

export async function publicGet(request: Request) {
  try {
    await ensureCatalog();
    const { settings } = await readSiteDisplay();
    const url = new URL(request.url);
    if (url.searchParams.get("availability") === "1") {
      const day = value(url.searchParams.get("date"), 10), serviceId = Number(url.searchParams.get("serviceId"));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(serviceId) || serviceId < 1) return jsonError("Escolha um serviço e um dia válidos.");
      const service = await db().prepare("SELECT booking_duration FROM services WHERE id=? AND category<>'Planos mensais'").bind(serviceId).first<{ booking_duration: number }>();
      if (!service || settings.hiddenServiceIds.includes(serviceId)) return jsonError("Serviço indisponível.");
      const [booked, blocks] = await Promise.all([
        db().prepare(`SELECT b.start_at,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration
          FROM bookings b JOIN services s ON s.id=b.service_id
          WHERE b.status IN ('solicitado','agendado','em andamento') AND b.start_at>=? AND b.start_at<=?`).bind(`${day}T00:00`, `${day}T23:59`).all<{ start_at: string; duration: number }>(),
        db().prepare("SELECT data FROM workflow_records WHERE kind='block' AND status<>'cancelado'").all<{ data: { start?: string; end?: string } }>(),
      ]);
      return reply({ date: day, slots: availableBookingSlots(day, service.booking_duration, booked.results, blocks.results.map(row => row.data)) }, 200, noStore);
    }
    const [services, rules, popular] = await Promise.all([
      db().prepare("SELECT id,name,category,price,duration,booking_duration,description FROM services ORDER BY category,name").all<{ id: number; category: string }>(),
      db().prepare("SELECT id,data FROM workflow_records WHERE kind='planrule'").all(),
      db().prepare("SELECT service_name,clicks FROM service_interest WHERE clicks>0 ORDER BY clicks DESC,service_name LIMIT 3").all<{ service_name: string; clicks: number }>(),
    ]);
    // O cliente do site esperava `data` como texto JSON nas regras de plano.
    const planRules = rules.results.map((row: any) => ({ id: row.id, data: JSON.stringify(row.data) }));
    return reply({ services: services.results.filter(service => offerIsVisible(settings, service)), rules: planRules, popular: popular.results, settings }, 200, noStore);
  } catch {
    return jsonError("Catálogo indisponível. Tente novamente mais tarde.", 503);
  }
}

export async function publicPost(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return jsonError("Formato inválido.", 415);
  try {
    const raw = await request.text();
    if (raw.length > 8192) return jsonError("Solicitação muito grande.", 413);
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (payload.website) return reply({ ok: true });
    const type = value(payload.type, 12), d = db();
    if (type === "interest") {
      const serviceName = value(payload.serviceName, 100);
      if (!serviceName) return jsonError("Serviço inválido.");
      // Guarda apenas um rótulo agregado; a tela só exibe popularidade para nomes que ela conhece.
      await d.prepare("INSERT INTO service_interest (service_name,clicks,updated_at) VALUES (?,1,?) ON CONFLICT(service_name) DO UPDATE SET clicks=service_interest.clicks+1,updated_at=EXCLUDED.updated_at").bind(serviceName, new Date().toISOString()).run();
      return reply({ ok: true }, 200, noStore);
    }
    const name = value(payload.name, 80), phone = value(payload.phone, 30).replace(/\D/g, ""), vehicle = value(payload.vehicle, 80), plate = value(payload.plate, 12).toUpperCase(), notes = value(payload.notes, 400);
    if (!["booking", "plan"].includes(type) || name.length < 2 || !/^\d{10,13}$/.test(phone) || vehicle.length < 2) return jsonError("Preencha nome, WhatsApp e veículo corretamente.");
    const serviceId = Number(payload.serviceId);
    if (!Number.isInteger(serviceId) || serviceId < 1) return jsonError("Selecione um serviço.");
    const service = await d.prepare("SELECT id,category,price,booking_duration FROM services WHERE id=?").bind(serviceId).first<{ id: number; category: string; price: number; booking_duration: number }>();
    const { settings } = await readSiteDisplay();
    if (type === "plan" && settings.hiddenTabs.includes("planos")) return jsonError("Esta opção está indisponível no site.", 403);
    if (!service || !offerIsVisible(settings, service) || (type === "plan") !== (service.category === "Planos mensais")) return jsonError("Serviço indisponível.");
    let desiredAt = "";
    if (type === "booking") {
      desiredAt = value(payload.desiredAt, 16);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(desiredAt) || !Number.isFinite(new Date(desiredAt).getTime())) return jsonError("Informe uma data e horário válidos.");
      if (desiredAt <= brazilNow()) return jsonError("Escolha um horário futuro.");
      if (!isWithinBusinessHours(desiredAt, service.booking_duration)) return jsonError("Escolha um horário disponível de segunda a sábado dentro do expediente.");
    }
    const { user, client } = await identity(request);
    const existing = client ? { id: client.id } : user ? await d.prepare("SELECT id FROM clients WHERE user_id=?").bind(user.userId).first<{ id: number }>() : null;
    let clientId = existing?.id;
    if (!clientId) {
      const inserted = await d.prepare("INSERT INTO clients (name,phone,vehicle,plate,notes,user_id,email) VALUES (?,?,?,?,?,?,?) RETURNING id").bind(name, phone, vehicle, plate, "", user?.userId || null, user?.email || "").first<{ id: number }>();
      clientId = inserted?.id;
    }
    if (!clientId) throw new Error("Cliente não salvo");
    if (type === "booking") {
      let inserted;
      try { inserted = await reserveBooking(clientId, serviceId, desiredAt, service.booking_duration, service.price, 0, notes || "Agendado pelo catálogo"); }
      catch (error) {
        if (error instanceof Error && error.message.toLocaleLowerCase("pt-BR").includes("horário")) return jsonError("Esse horário acabou de ficar indisponível. Escolha outro.", 409);
        throw error;
      }
      await ensureBookingOrder(inserted.id);
      return reply({ ok: true, requestId: inserted.id, status: "agendado" }, 201, noStore);
    }
    const duplicate = await d.prepare("SELECT id FROM plan_subscriptions WHERE client_id=? AND plan_service_id=? AND (status='pendente' OR (status='ativo' AND expires_at>?)) LIMIT 1").bind(clientId, serviceId, new Date().toISOString()).first();
    if (duplicate) return jsonError("Já existe uma solicitação ou plano ativo para este cliente.", 409);
    const inserted = await d.prepare("INSERT INTO plan_subscriptions (client_id,plan_service_id,status,amount,requested_at) VALUES (?,?,?,?,?) RETURNING id").bind(clientId, serviceId, "pendente", service.price, new Date().toISOString()).first<{ id: number }>();
    return reply({ ok: true, requestId: inserted?.id, status: "pendente" }, 201);
  } catch { return jsonError("Não foi possível enviar a solicitação. Tente novamente.", 500); }
}

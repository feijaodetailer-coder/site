import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi, nextWeekday } from "./harness.mjs";

const api = await createApi();
const { call } = api;
const day = nextWeekday();
const slot = `${day}T16:00`;
const ok = r => { assert.ok(r.status >= 200 && r.status < 300, `status ${r.status}: ${JSON.stringify(r.body)}`); return r.body; };

test("rotas desconhecidas e CORS", async () => {
  assert.equal((await call(null, "GET", "/nada")).status, 404);
  assert.equal((await call(null, "PUT", "/session")).status, 405);
  const pre = await call(null, "OPTIONS", "/workflow");
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
});

test("catálogo público semeia os serviços e esconde agendamento por padrão", async () => {
  const body = ok(await call(null, "GET", "/public"));
  assert.ok(body.services.length > 20);
  assert.deepEqual(body.settings.hiddenTabs, ["agendar"]);
  assert.ok(body.services.every(s => typeof s.price === "number"));
});

test("sessão: anônimo, cliente fora da lista e administrador", async () => {
  assert.deepEqual(ok(await call(null, "GET", "/session")), { signedIn: false, admin: false, name: "" });
  assert.equal(ok(await call("intruder", "GET", "/session")).admin, false);
  const admin = ok(await call("admin", "GET", "/session"));
  assert.equal(admin.admin, true);
  assert.equal(admin.name, "Dono");
});

test("rotas de gestão exigem o administrador", async () => {
  for (const [method, path] of [["GET", "/data"], ["GET", "/finance"], ["POST", "/data"], ["GET", "/backups"], ["PUT", "/site-settings"]]) {
    assert.ok([401, 403].includes((await call(null, method, path, {})).status), `${method} ${path} anônimo`);
    assert.ok([401, 403].includes((await call("intruder", method, path, {})).status), `${method} ${path} intruso`);
  }
});

let serviceId, clientId, bookingId;

test("agendamento público: disponibilidade, reserva e conflito", async () => {
  const services = (await call("admin", "GET", "/data")).body.services;
  const svc = services.find(s => s.category !== "Planos mensais");
  serviceId = svc.id;
  // O agendamento online vem desligado; a gestão liga e o horário passa a aparecer.
  assert.equal((await call(null, "GET", `/public?availability=1&serviceId=${serviceId}&date=${day}`)).status, 200);
  const slots = ok(await call(null, "GET", `/public?availability=1&serviceId=${serviceId}&date=${day}`)).slots;
  assert.ok(slots.includes(slot), `horários: ${slots}`);
  const booked = ok(await call(null, "POST", "/public", { type: "booking", serviceId, name: "Visitante Teste", phone: "(31) 98888-7777", vehicle: "Gol", plate: "abc1d23", desiredAt: slot }));
  assert.equal(booked.status, "agendado");
  bookingId = booked.requestId;
  const after = ok(await call(null, "GET", `/public?availability=1&serviceId=${serviceId}&date=${day}`)).slots;
  assert.ok(!after.includes(slot));
  const clash = await call(null, "POST", "/public", { type: "booking", serviceId, name: "Outro Visitante", phone: "31977776666", vehicle: "Uno", desiredAt: slot });
  assert.equal(clash.status, 409);
  const invalid = await call(null, "POST", "/public", { type: "booking", serviceId, name: "X", phone: "1", vehicle: "", desiredAt: slot });
  assert.equal(invalid.status, 400);
  const sunday = new Date(`${day}T12:00:00Z`); while (sunday.getUTCDay() !== 0) sunday.setUTCDate(sunday.getUTCDate() + 1);
  assert.equal((await call(null, "POST", "/public", { type: "booking", serviceId, name: "Domingo", phone: "31977776666", vehicle: "Uno", desiredAt: `${sunday.toISOString().slice(0, 10)}T10:00` })).status, 400);
});

test("interesse em serviços incrementa o contador", async () => {
  ok(await call(null, "POST", "/public", { type: "interest", serviceName: "Plano FD Gold" }));
  ok(await call(null, "POST", "/public", { type: "interest", serviceName: "Plano FD Gold" }));
  const popular = ok(await call(null, "GET", "/public")).popular;
  assert.deepEqual(popular[0], { service_name: "Plano FD Gold", clicks: 2 });
});

test("gestão enxerga o agendamento, a OS criada e cria backup diário", async () => {
  const w = ok(await call("admin", "GET", "/workflow"));
  assert.equal(w.admin, true);
  assert.equal(w.backup.saved, true);
  assert.ok(w.bookings.find(b => b.id === bookingId));
  const order = w.records.find(r => r.kind === "order" && String(r.data.bookingId) === String(bookingId));
  assert.ok(order, "OS vinculada ao agendamento");
  assert.equal(typeof order.data.total, "number");
  clientId = w.bookings.find(b => b.id === bookingId).client_id;
  const list = ok(await call("admin", "GET", "/backups")).backups;
  assert.equal(list.length, 1);
  assert.equal((await call("admin", "GET", `/backups?date=${list[0].date}`)).status, 200);
});

test("gestão: mudar status do agendamento conclui a OS e gera acompanhamento", async () => {
  ok(await call("admin", "PATCH", "/data", { table: "bookings", id: bookingId, status: "em andamento" }));
  ok(await call("admin", "PATCH", "/data", { table: "bookings", id: bookingId, status: "concluido" }));
  const w = ok(await call("admin", "GET", "/workflow"));
  const order = w.records.find(r => r.kind === "order" && String(r.data.bookingId) === String(bookingId));
  assert.equal(order.status, "entregue");
  assert.match(order.data.completedDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("pagamento da OS gera lançamento e atualiza o agendamento", async () => {
  const w = ok(await call("admin", "GET", "/workflow"));
  const order = w.records.find(r => r.kind === "order" && String(r.data.bookingId) === String(bookingId));
  const half = order.data.total / 200;
  ok(await call("admin", "POST", "/workflow", { action: "payment", id: order.id, version: order.version, amount: half, method: "Pix" }));
  const after = ok(await call("admin", "GET", "/workflow"));
  const updated = after.records.find(r => r.id === order.id);
  assert.equal(updated.data.paid, Math.round(half * 100));
  assert.equal(updated.version, order.version + 1);
  assert.equal(after.bookings.find(b => b.id === bookingId).paid, Math.round(half * 100));
  assert.equal(after.transactions.length, 1);
  // Reenviar com a versão antiga é recusado (controle de concorrência).
  const stale = await call("admin", "POST", "/workflow", { action: "payment", id: order.id, version: order.version, amount: 1 });
  assert.equal(stale.status, 400);
  const fin = ok(await call("admin", "GET", "/finance"));
  assert.equal(fin.transactions.length, 1);
  assert.match(fin.transactions[0].sourceLabel, /^OS · /);
  assert.ok(fin.categories.length >= 8);
});

test("financeiro: criar, editar, idempotência e excluir lançamento", async () => {
  const base = { kind: "saida", date: nextWeekday(-30).replace(/\d{2}$/, "01"), description: "Compra de shampoo", category: "Produtos e insumos", financialStatus: "pago", amount: "45,90", paymentMethod: "Pix", requestId: "abcdefghijklmnop1234" };
  ok(await call("admin", "POST", "/finance", base));
  ok(await call("admin", "POST", "/finance", base)); // mesmo requestId: não duplica
  let fin = ok(await call("admin", "GET", "/finance"));
  const created = fin.transactions.find(t => t.description === "Compra de shampoo");
  assert.equal(fin.transactions.filter(t => t.description === "Compra de shampoo").length, 1);
  assert.equal(created.amount, 4590);
  ok(await call("admin", "PATCH", "/finance", { ...base, id: created.id, version: created.version, amount: "50", description: "Shampoo premium" }));
  fin = ok(await call("admin", "GET", "/finance"));
  const edited = fin.transactions.find(t => t.id === created.id);
  assert.equal(edited.amount, 5000);
  assert.equal(edited.version, created.version + 1);
  assert.equal((await call("admin", "PATCH", "/finance", { ...base, id: created.id, version: created.version })).status, 400);
  ok(await call("admin", "POST", "/finance", { action: "category", name: "Ferramentas", type: "saida" }));
  ok(await call("admin", "DELETE", "/finance", { id: created.id, version: edited.version }));
  fin = ok(await call("admin", "GET", "/finance"));
  assert.ok(!fin.transactions.find(t => t.id === created.id));
  assert.ok(fin.categories.find(c => c.name === "Ferramentas"));
});

test("clientes e catálogo editados pela gestão", async () => {
  ok(await call("admin", "POST", "/data", { table: "clients", name: "Cliente Manual", phone: "31911112222", vehicle: "Civic", plate: "xyz9z99" }));
  ok(await call("admin", "POST", "/data", { table: "clients", name: "Indicado", referredByClientId: clientId }));
  let data = ok(await call("admin", "GET", "/data"));
  assert.ok(data.clients.find(c => c.name === "Cliente Manual" && c.plate === "XYZ9Z99"));
  assert.equal(data.referralEvents.length, 1);
  assert.equal(typeof data.vehicles[0].data, "string");
  ok(await call("admin", "POST", "/data", { table: "services", name: "Serviço Novo", category: "Outros", price: 99.9, duration: 90, bookingDuration: 30 }));
  data = ok(await call("admin", "GET", "/data"));
  const created = data.services.find(s => s.name === "Serviço Novo");
  assert.equal(created.price, 9990);
  ok(await call("admin", "PATCH", "/data", { table: "services", id: created.id, name: "Serviço Novo", category: "Outros", price: 120, duration: 90, bookingDuration: 30, description: "ok" }));
  ok(await call("admin", "POST", "/data", { table: "price_recommendations" }));
  assert.equal((await call("admin", "POST", "/data", { table: "price_recommendations" })).status, 409);
});

test("agenda da gestão: criar, editar e cancelar sem conflitos", async () => {
  const d2 = nextWeekday(5), clients = ok(await call("admin", "GET", "/data")).clients;
  const cid = clients.find(c => c.name === "Cliente Manual").id;
  ok(await call("admin", "POST", "/data", { table: "bookings", clientId: cid, serviceId, startAt: `${d2}T15:00`, notes: "teste" }));
  const dup = await call("admin", "POST", "/data", { table: "bookings", clientId: cid, serviceId, startAt: `${d2}T15:00` });
  assert.ok(dup.status >= 400);
  const created = ok(await call("admin", "GET", "/data")).bookings.find(b => b.start_at === `${d2}T15:00`);
  ok(await call("admin", "PATCH", "/data", { table: "bookings", action: "edit", id: created.id, serviceId, startAt: `${d2}T17:00`, notes: "mudou" }));
  ok(await call("admin", "PATCH", "/data", { table: "bookings", id: created.id, status: "cancelado" }));
  const w = ok(await call("admin", "GET", "/workflow"));
  assert.equal(w.records.find(r => String(r.data.bookingId) === String(created.id)).status, "cancelado");
});

test("bloqueio da gestão impede o agendamento público", async () => {
  const d3 = nextWeekday(7);
  ok(await call("admin", "POST", "/workflow", { action: "save", kind: "block", status: "ativo", data: { title: "Folga", start: `${d3}T15:00`, end: `${d3}T19:00` } }));
  const slots = ok(await call(null, "GET", `/public?availability=1&serviceId=${serviceId}&date=${d3}`)).slots;
  assert.deepEqual(slots, []);
  const blocked = await call(null, "POST", "/public", { type: "booking", serviceId, name: "Visitante", phone: "31955554444", vehicle: "Polo", desiredAt: `${d3}T16:00` });
  assert.equal(blocked.status, 409);
});

test("configurações do site: versionamento otimista", async () => {
  const current = ok(await call(null, "GET", "/site-settings"));
  assert.equal(current.version, 0);
  const next = { ...current.settings, hiddenTabs: [] };
  assert.deepEqual(ok(await call("admin", "PUT", "/site-settings", { settings: next, version: 0 })).version, 1);
  assert.equal((await call("admin", "PUT", "/site-settings", { settings: next, version: 0 })).status, 409);
  assert.equal(ok(await call("admin", "PUT", "/site-settings", { settings: { ...next, hiddenServiceIds: [serviceId] }, version: 1 })).version, 2);
  assert.equal((await call("intruder", "PUT", "/site-settings", { settings: next, version: 2 })).status, 403);
  assert.deepEqual(ok(await call(null, "GET", "/site-settings")).settings.hiddenServiceIds, [serviceId]);
  ok(await call("admin", "PUT", "/site-settings", { settings: { ...next, hiddenServiceIds: [] }, version: 2 }));
});

test("cadastro e área do cliente: cada cliente vê apenas o que é seu", async () => {
  const reg = ok(await call("ana", "POST", "/customer-auth", { mode: "register", phone: "(31) 99999-0001", name: "Ana Souza", vehicle: "Onix", plate: "ana1a11" }));
  assert.equal(reg.name, "Ana Souza");
  ok(await call("bia", "POST", "/customer-auth", { mode: "register", phone: "31999990002", name: "Bia Lima", vehicle: "HB20" }));
  // Telefone diferente do cadastrado no login é recusado.
  assert.equal((await call("ana", "POST", "/customer-auth", { mode: "login", phone: "31999990002" })).status, 401);
  assert.equal((await call(null, "POST", "/customer-auth", { mode: "login", phone: "31999990001" })).status, 401);
  assert.equal(ok(await call("ana", "GET", "/session")).admin, false);
  const a = ok(await call("ana", "GET", "/workflow"));
  assert.equal(a.signedIn, true);
  assert.equal(a.admin, false);
  assert.equal(a.profile.name, "Ana Souza");
  assert.equal(a.clients.length, 1);
  assert.equal(a.transactions.length, 0);
  assert.ok(a.records.every(r => r.client_id === a.profile.id || ["planrule", "campaign"].includes(r.kind)));
  assert.equal(a.records.filter(r => r.kind === "vehicle").length, 1);
  // Administração é inacessível
  assert.equal((await call("ana", "GET", "/data")).status, 401);
  assert.equal((await call("ana", "POST", "/workflow", { action: "save", kind: "product", data: { title: "x" } })).status, 403);
});

test("cliente solicita orçamento (preços zerados), gestão envia e cliente decide", async () => {
  const a = ok(await call("ana", "GET", "/workflow"));
  const saved = ok(await call("ana", "POST", "/workflow", { action: "save", kind: "quote", data: { title: "Polimento", items: [{ name: "Polimento Técnico", qty: 1, price: 1 }], vehicleId: a.records.find(r => r.kind === "vehicle").id } }));
  let quote = ok(await call("ana", "GET", "/workflow")).records.find(r => r.id === saved.id);
  assert.equal(quote.status, "solicitado");
  assert.equal(quote.data.total, 0);
  assert.equal(quote.data.items[0].price, 0);
  // Bia não enxerga nem altera o orçamento da Ana.
  assert.equal(ok(await call("bia", "GET", "/workflow")).records.find(r => r.id === saved.id), undefined);
  assert.equal((await call("bia", "POST", "/workflow", { action: "quote_decision", id: saved.id, status: "aprovado" })).status, 403);
  // A gestão precifica e envia.
  ok(await call("admin", "POST", "/workflow", { action: "save", id: saved.id, version: quote.version, kind: "quote", clientId: a.profile.id, status: "enviado", data: { title: "Polimento", items: [{ name: "Polimento Técnico", qty: 1, price: 1000 }], discount: 100 } }));
  quote = ok(await call("ana", "GET", "/workflow")).records.find(r => r.id === saved.id);
  assert.equal(quote.data.total, 90000);
  assert.equal((await call("ana", "POST", "/workflow", { action: "quote_decision", id: saved.id, status: "recusado" })).status, 400);
  ok(await call("ana", "POST", "/workflow", { action: "quote_decision", id: saved.id, status: "aprovado" }));
  const after = ok(await call("ana", "GET", "/workflow")).records;
  assert.equal(after.find(r => r.id === saved.id).status, "aprovado");
  const os = after.find(r => r.id === `os-${saved.id}`);
  assert.equal(os.kind, "order");
  assert.equal(os.data.total, 90000);
  // Decidir de novo não duplica a OS.
  assert.equal((await call("ana", "POST", "/workflow", { action: "quote_decision", id: saved.id, status: "aprovado" })).status, 400);
});

test("reagendar e cancelar: só o dono do agendamento", async () => {
  const d4 = nextWeekday(9);
  const book = ok(await call("ana", "POST", "/public", { type: "booking", serviceId, name: "Ana Souza", phone: "31999990001", vehicle: "Onix", desiredAt: `${d4}T15:30` }));
  assert.equal((await call("bia", "POST", "/workflow", { action: "reschedule", id: book.requestId, startAt: `${d4}T16:30` })).status, 403);
  ok(await call("ana", "POST", "/workflow", { action: "reschedule", id: book.requestId, startAt: `${d4}T16:30` }));
  const mine = ok(await call("ana", "GET", "/workflow")).bookings.find(b => b.id === book.requestId);
  assert.equal(mine.start_at, `${d4}T16:30`);
  assert.equal((await call("ana", "POST", "/workflow", { action: "reschedule", id: book.requestId, startAt: `${d4}T07:00` })).status, 400);
  ok(await call("ana", "POST", "/workflow", { action: "reschedule", id: book.requestId, cancel: true }));
  assert.equal(ok(await call("ana", "GET", "/workflow")).bookings.find(b => b.id === book.requestId).status, "cancelado");
});

test("planos: solicitação, autorização gera receita e benefícios respeitam o limite", async () => {
  const plan = ok(await call(null, "GET", "/public")).services.find(s => s.category === "Planos mensais");
  const req = ok(await call("ana", "POST", "/public", { type: "plan", serviceId: plan.id, name: "Ana Souza", phone: "31999990001", vehicle: "Onix" }));
  assert.equal(req.status, "pendente");
  assert.equal((await call("ana", "POST", "/public", { type: "plan", serviceId: plan.id, name: "Ana Souza", phone: "31999990001", vehicle: "Onix" })).status, 409);
  ok(await call("admin", "PATCH", "/data", { table: "plans", id: req.requestId, action: "authorize" }));
  assert.equal((await call("admin", "PATCH", "/data", { table: "plans", id: req.requestId, action: "authorize" })).status, 400);
  const sub = ok(await call("ana", "GET", "/workflow")).plans[0];
  assert.equal(sub.status, "ativo");
  assert.equal((await call("admin", "POST", "/workflow", { action: "benefit", planId: sub.id, title: "Limpeza" })).status, 400);
  ok(await call("admin", "POST", "/workflow", { action: "save", kind: "planrule", id: `rule-${plan.id}`, data: { title: "Regra", visits: 1 } }));
  ok(await call("admin", "POST", "/workflow", { action: "benefit", planId: sub.id, title: "Limpeza" }));
  assert.equal((await call("admin", "POST", "/workflow", { action: "benefit", planId: sub.id, title: "Limpeza" })).status, 400);
  const rules = ok(await call(null, "GET", "/public")).rules;
  assert.equal(JSON.parse(rules[0].data).visits, "1");
  const fin = ok(await call("admin", "GET", "/finance"));
  assert.ok(fin.transactions.find(t => t.sourceLabel === "Plano mensal"));
  ok(await call("ana", "POST", "/workflow", { action: "plan_cancel", id: sub.id }));
  assert.equal(ok(await call("ana", "GET", "/workflow")).plans[0].status, "cancelado");
});

test("anexos: gestão envia, cliente só vê os compartilhados", async () => {
  const w = ok(await call("admin", "GET", "/workflow"));
  const order = w.records.find(r => r.id === `os-${w.records.find(x => x.kind === "quote" && x.status === "aprovado").id}`);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const send = shared => { const f = new FormData(); f.set("file", new File([png], "foto.png", { type: "image/png" })); f.set("recordId", order.id); f.set("shared", String(shared)); return call("admin", "POST", "/files", f); };
  const privateFile = ok(await send(false)).id, shared = ok(await send(true)).id;
  const wrongType = new FormData(); wrongType.set("file", new File([new Uint8Array([1, 2, 3, 4])], "x.png", { type: "image/png" })); wrongType.set("recordId", order.id);
  assert.equal((await call("admin", "POST", "/files", wrongType)).status, 400);
  const ana = ok(await call("ana", "GET", "/workflow"));
  assert.deepEqual(ana.files.map(f => f.id), [shared]);
  assert.equal((await call("ana", "GET", `/files?id=${shared}`)).status, 200);
  assert.equal((await call("ana", "GET", `/files?id=${privateFile}`)).status, 403);
  assert.equal((await call("bia", "GET", `/files?id=${shared}`)).status, 403);
  assert.equal((await call("admin", "GET", `/files?id=${privateFile}`)).status, 200);
  assert.equal((await call(null, "GET", `/files?id=${shared}`)).status, 403);
});

test("ordem de serviço, estoque, vínculo de histórico e exportação", async () => {
  const w = ok(await call("admin", "GET", "/workflow"));
  const ana = w.clients.find(c => c.name === "Ana Souza");
  const prod = ok(await call("admin", "POST", "/workflow", { action: "save", kind: "product", data: { title: "APC", category: "Químico", brand: "X", volume: "5L", unit: "L", quantity: 10, minimum: 2, unitCost: 10, purchasePrice: 80, startDate: "2026-01-01" } }));
  let product = ok(await call("admin", "GET", "/workflow")).records.find(r => r.id === prod.id);
  assert.equal(product.data.unitCost, 1000);
  ok(await call("admin", "POST", "/workflow", { action: "stock", id: product.id, version: product.version, quantity: -3, note: "uso" }));
  product = ok(await call("admin", "GET", "/workflow")).records.find(r => r.id === prod.id);
  assert.equal(product.data.quantity, 7);
  assert.equal((await call("admin", "POST", "/workflow", { action: "stock", id: product.id, version: product.version, quantity: -50 })).status, 400);
  // Vincula cadastro antigo (sem conta) à conta da Ana.
  const manual = w.clients.find(c => c.name === "Cliente Manual");
  const target = w.clients.find(c => c.user_id === `supabase:${ana.user_id.slice(9)}`) || ana;
  ok(await call("admin", "POST", "/workflow", { action: "link_client", clientId: manual.id, accountKey: target.user_id }));
  const backup = await call("admin", "POST", "/workflow", { action: "backup" });
  assert.equal(backup.status, 200);
  assert.ok(Array.isArray(backup.body.clients));
  assert.equal(JSON.stringify(backup.body).includes("password"), false);
});

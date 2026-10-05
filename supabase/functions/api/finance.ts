import { expenseCategories, parseMovement, cash, type Tx, type FinanceData, type FinanceRecord, type Category } from "../_shared/finance.ts";
import { db, identity, json, reply } from "./lib.ts";
import type { Statement } from "./db.ts";

const stamp = () => new Date().toISOString();
const metaId = (id: number) => `finance-meta:${id}`;
const productId = (id: number) => `finance-product:${id}`;
const productCycle = (value: ReturnType<typeof parseMovement>) => {
  const p = value.product!;
  const quantity = Number(p.size);
  return { title: p.name, supplier: "", unit: p.unit, quantity, minimum: 0, unitCost: Math.round(value.amount / quantity), purchasePrice: value.amount, category: p.classification, brand: p.brand, volume: `${p.size} ${p.unit}`, startDate: p.startedOn || value.date, endDate: p.finishedOn };
};
const fields = ["date", "kind", "category", "subcategory", "description", "amount", "payment_method", "financial_status", "notes", "is_stock_purchase", "is_recurring", "recurrence_key"] as const;

export async function initializeCategories() {
  const d = db();
  const marker = "finance-categories-v2";
  if (await d.prepare("SELECT id FROM workflow_records WHERE id=?").bind(marker).first()) return;
  const all = [...expenseCategories.map(name => ({ name, type: "saida" })), { name: "Serviços", type: "entrada" }, { name: "Planos mensais", type: "entrada" }, { name: "Outras entradas", type: "entrada" }];
  await d.batch([
    ...all.map(c => d.prepare("INSERT INTO financial_categories(name,type,active) SELECT ?::text,?::text,1 WHERE NOT EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text) ON CONFLICT DO NOTHING").bind(c.name, c.type, marker)),
    d.prepare("INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES(?,'finance_config','ativo','{}'::jsonb,?,?) ON CONFLICT DO NOTHING").bind(marker, stamp(), stamp()),
  ]);
}

export async function readFinance(): Promise<FinanceData> {
  const d = db();
  const [tx, rs, cats, bs] = await Promise.all([
    d.prepare("SELECT * FROM transactions ORDER BY date DESC,id DESC").all<any>(),
    d.prepare("SELECT * FROM workflow_records WHERE kind IN ('order','bill','finance_meta')").all<any>(),
    d.prepare("SELECT * FROM financial_categories WHERE active=1 ORDER BY type,name").all<Category>(),
    d.prepare("SELECT id,amount,paid,status,start_at FROM bookings").all<FinanceData["bookings"][number]>(),
  ]);
  const parsed = rs.results as FinanceRecord[], records = parsed.filter(r => r.kind !== "finance_meta"), metas = new Map(parsed.filter(r => r.kind === "finance_meta").map(r => [r.id, r]));
  const transactions: Tx[] = tx.results.map(t => {
    const meta = metas.get(metaId(t.id));
    let sourceId = t.record_id || null, warning = "";
    if (!sourceId && t.booking_id) sourceId = records.find(r => r.kind === "order" && Number(r.data.bookingId) === t.booking_id)?.id || null;
    const suffix = String(t.description).match(/ #([\w-]{8})$/)?.[1];
    if (!sourceId && suffix) { const matches = records.filter(r => r.id.endsWith(suffix)); if (matches.length === 1) sourceId = matches[0].id; else warning = "Vínculo antigo não identificado com segurança. Revise a origem antes de alterar."; }
    if (!sourceId && !t.booking_id && t.category === "Planos mensais") warning = "Recebimento antigo de plano sem vínculo identificável. Preserve este lançamento e ajuste pelo plano.";
    const record = records.find(r => r.id === sourceId);
    if (sourceId && !record && !sourceId.startsWith("plan:")) warning = "Registro de origem não encontrado.";
    const knownPartial = meta?.data.paidAmount;
    if (t.financial_status === "parcial" && knownPartial === undefined) warning = "Pagamento parcial antigo sem valor recebido informado. Edite para conciliar o valor real.";
    const parts = String(t.category).split(" · "), method = t.payment_method || parts.slice(1).join(" · ") || "Não informado";
    return { ...t, product: meta?.data.product || null, tool: meta?.data.tool || null, expenseType: meta?.data.expenseType || (meta?.data.product ? "produto" : meta?.data.tool ? "ferramenta" : "geral"), category: parts[0], payment_method: method, version: meta?.version || 0, paidAmount: t.financial_status === "pago" ? t.amount : Number(knownPartial || 0), paidDate: meta?.data.paidDate || t.date, sourceId, sourceLabel: record ? `${record.kind === "order" ? "OS" : "Conta"} · ${record.data.title}` : t.booking_id ? `Agendamento #${t.booking_id}` : sourceId?.startsWith("plan:") ? "Plano mensal" : "Lançamento manual", warning };
  });
  return { transactions, categories: cats.results, records, bookings: bs.results };
}

/** Registro de histórico; com `condition` falsa o id fica nulo e a transação inteira é desfeita. */
function history(id: string, actor: string, data: unknown, condition = "TRUE", bindings: unknown[] = []) {
  return db().prepare(`INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES(CASE WHEN ${condition} THEN ?::text ELSE NULL END,'finance_history','registrado',?::jsonb,?,?)`)
    .bind(...bindings, id, json({ actor, ...data as object }), stamp(), stamp());
}

export async function createMovement(p: Record<string, unknown>, actor: string) {
  const d = db();
  const value = parseMovement(p), key = String(p.requestId || "");
  if (!/^[\w-]{16,80}$/.test(key)) throw Error("Atualize o formulário antes de salvar.");
  const event = `finance-create:${key}`;
  if (await d.prepare("SELECT id FROM workflow_records WHERE id=?").bind(event).first()) return;
  // O marcador único e as escritas compartilham a transação: repetir o envio não duplica o lançamento.
  await d.batch([
    history(event, actor, { action: "criar", value }),
    d.prepare(`INSERT INTO transactions(${fields.join(",")}) VALUES(${fields.map(() => "?").join(",")})`).bind(...fields.map(k => (value as Record<string, unknown>)[k])),
    d.prepare("INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES('finance-meta:'||currval(pg_get_serial_sequence('transactions','id')),'finance_meta','ativo',?::jsonb,?,?)").bind(json({ paidAmount: value.paidAmount, paidDate: value.paidDate, expenseType: value.expenseType, product: value.product, tool: value.tool }), stamp(), stamp()),
    ...(value.product ? [d.prepare("INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES('finance-product:'||currval(pg_get_serial_sequence('transactions','id')),'product','ativo',?::jsonb,?,?)").bind(json(productCycle(value)), stamp(), stamp())] : []),
  ]);
}

export async function changeMovement(p: Record<string, unknown>, actor: string, remove = false) {
  const d = db();
  const all = await readFinance(), id = Number(p.id), t = all.transactions.find(t => t.id === id);
  if (!t) throw Error("Movimentação não encontrada.");
  if (t.version !== Number(p.version)) throw Error("Este lançamento mudou. Atualize a página antes de editar.");
  if (t.warning && !t.warning.startsWith("Pagamento parcial")) throw Error(t.warning);
  const value = remove ? null : parseMovement(p), delta = (value ? cash(value as any) : 0) - cash(t);
  const linkedProduct = t.product ? await d.prepare("SELECT id FROM workflow_records WHERE id=? AND kind='product'").bind(productId(t.id)).first<{ id: string }>() : null;
  if ((remove || (value && !value.product)) && linkedProduct) {
    const used = await d.prepare("SELECT id FROM workflow_records WHERE kind IN ('movement','order') AND (parent_id=? OR data->'productsUsed' @> ?::jsonb) LIMIT 1").bind(linkedProduct.id, json([linkedProduct.id])).first();
    if (used) throw Error("Este produto já foi usado em uma OS ou movimentação. Para preservar o histórico, não é possível excluir essa compra nem mudar seu tipo.");
  }
  const source = t.sourceId ? all.records.find(r => r.id === t.sourceId) : undefined;
  if ((source || t.booking_id || t.sourceId?.startsWith("plan:")) && value && (value.kind !== t.kind || value.financial_status !== "pago")) throw Error("Um pagamento vinculado deve permanecer recebido/pago. Para desfazer, exclua o pagamento; o saldo da origem será reaberto.");
  const conditions = ["EXISTS(SELECT 1 FROM transactions WHERE id=?::int)", "COALESCE((SELECT version FROM workflow_records WHERE id=?::text),0)=?::int"];
  const binds: unknown[] = [id, metaId(id), t.version];
  const extra: Statement[] = [];
  if (source) {
    const newPaid = Number(source.data.paid || 0) + delta;
    if (newPaid < 0 || newPaid > Number(source.data.total || 0)) throw Error("O valor ultrapassa o saldo da OS/conta. Revise o total na origem.");
    conditions.push("EXISTS(SELECT 1 FROM workflow_records WHERE id=?::text AND version=?::int)"); binds.push(source.id, source.version);
    extra.push(d.prepare("UPDATE workflow_records SET data=jsonb_set(data,'{paid}',?::jsonb),version=version+1,updated_at=? WHERE id=?").bind(json(newPaid), stamp(), source.id));
    if (source.data.bookingId) extra.push(d.prepare("UPDATE bookings SET paid=? WHERE id=?").bind(newPaid, Number(source.data.bookingId)));
  } else if (t.booking_id) {
    const b = all.bookings.find(b => b.id === t.booking_id);
    if (!b || b.paid + delta < 0 || b.paid + delta > b.amount) throw Error("Saldo do agendamento inconsistente.");
    conditions.push("EXISTS(SELECT 1 FROM bookings WHERE id=?::int AND paid=?::int AND amount=?::int)"); binds.push(b.id, b.paid, b.amount);
    extra.push(d.prepare("UPDATE bookings SET paid=paid+? WHERE id=?").bind(delta, b.id));
  } else if (t.sourceId?.startsWith("plan:")) {
    if (!remove && delta !== 0) throw Error("O valor do pagamento do plano deve corresponder ao valor contratado.");
    if (remove) extra.push(d.prepare("UPDATE plan_subscriptions SET status='pendente',authorized_at=NULL,expires_at=NULL WHERE id=?").bind(Number(t.sourceId.slice(5))));
  }
  const change = value
    ? d.prepare(`UPDATE transactions SET ${fields.map(k => k + "=?").join(",")},record_id=? WHERE id=?`).bind(...fields.map(k => (value as Record<string, unknown>)[k]), t.sourceId, id)
    : d.prepare("DELETE FROM transactions WHERE id=?").bind(id);
  await d.batch([
    history(crypto.randomUUID(), actor, { action: remove ? "excluir" : "editar", before: t, after: value }, conditions.join(" AND "), binds),
    change,
    ...extra,
    d.prepare("INSERT INTO workflow_records(id,kind,status,data,version,created_at,updated_at) VALUES(?,'finance_meta','ativo',?::jsonb,1,?,?) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,version=workflow_records.version+1,updated_at=EXCLUDED.updated_at").bind(metaId(id), json({ paidAmount: value?.paidAmount || 0, paidDate: value?.paidDate || t.paidDate, expenseType: value?.expenseType || "geral", product: value?.product || null, tool: value?.tool || null }), stamp(), stamp()),
    ...(value?.product ? [d.prepare("INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES(?,'product','ativo',?::jsonb,?,?) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,version=workflow_records.version+1,updated_at=EXCLUDED.updated_at").bind(productId(id), json(productCycle(value)), stamp(), stamp())] : []),
    ...(linkedProduct && (remove || !value?.product) ? [d.prepare("DELETE FROM workflow_records WHERE id=? AND kind='product'").bind(linkedProduct.id)] : []),
  ]);
}

export async function saveCategory(p: Record<string, unknown>, actor: string) {
  const d = db();
  const name = String(p.name || "").trim().slice(0, 80), type = String(p.type), id = Number(p.id || 0);
  if (!name || !["entrada", "saida"].includes(type)) throw Error("Informe nome e tipo da categoria.");
  const duplicate = await d.prepare("SELECT id FROM financial_categories WHERE lower(name)=lower(?) AND type=? AND id<>?").bind(name, type, id).first();
  if (duplicate) throw Error("Já existe uma categoria com esse nome.");
  if (!id) { await d.batch([d.prepare("INSERT INTO financial_categories(name,type,active) VALUES(?,?,1)").bind(name, type), history(crypto.randomUUID(), actor, { action: "criar categoria", name, type })]); return; }
  const old = await d.prepare("SELECT * FROM financial_categories WHERE id=?").bind(id).first<Category>();
  if (!old || old.name !== p.previousName) throw Error("Categoria alterada. Atualize antes de salvar.");
  if (old.type !== type) throw Error("O tipo de uma categoria existente não pode ser alterado.");
  await d.batch([
    history(crypto.randomUUID(), actor, { action: "editar categoria", before: old, name }, "EXISTS(SELECT 1 FROM financial_categories WHERE id=?::int AND name=?::text)", [id, old.name]),
    d.prepare("UPDATE financial_categories SET name=? WHERE id=?").bind(name, id),
    d.prepare("UPDATE transactions SET category=?::text||substr(category,length(?::text)+1) WHERE kind=? AND (category=?::text OR substr(category,1,length(?::text)+3)=?::text||' · ')").bind(name, old.name, type, old.name, old.name, old.name),
    d.prepare("UPDATE workflow_records SET data=jsonb_set(data,'{category}',?::jsonb),version=version+1,updated_at=? WHERE kind='bill' AND data->>'category'=? AND data->>'direction'=?").bind(json(name), stamp(), old.name, type === "saida" ? "pagar" : "receber"),
  ]);
}

const fail = (e: unknown) => reply({ error: e instanceof Error && !/constraint|violates|duplicate key/i.test(e.message) ? e.message : "O registro mudou ou não pôde ser salvo. Atualize e tente novamente." }, 400);

export async function financeGet(request: Request) {
  try {
    const who = await identity(request);
    if (!who.admin) return reply({ error: "Acesso não autorizado" }, 403);
    await initializeCategories();
    return reply(await readFinance(), 200, { "Cache-Control": "private, no-store" });
  } catch (e) { return fail(e); }
}

export async function financeMutate(request: Request, method: string) {
  try {
    const who = await identity(request);
    if (!who.admin || !who.user) return reply({ error: "Acesso não autorizado" }, 403);
    const raw = await request.text();
    if (raw.length > 16000) throw Error("Lançamento muito grande.");
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (method === "DELETE") await changeMovement(p, who.user.userId, true);
    else if (p.action === "category") await saveCategory(p, who.user.userId);
    else if (method === "POST") await createMovement(p, who.user.userId);
    else await changeMovement(p, who.user.userId);
    return reply({ ok: true });
  } catch (e) { return fail(e); }
}

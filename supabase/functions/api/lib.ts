import type { Database } from "./db.ts";

export type AuthUser = { id: string; email: string; name: string; confirmed: boolean };
export type StoredFile = { body: Blob; type: string };
export type Storage = {
  put(bucket: string, key: string, bytes: ArrayBuffer | Uint8Array | string, contentType: string): Promise<void>;
  get(bucket: string, key: string): Promise<StoredFile | null>;
  has(bucket: string, key: string): Promise<boolean>;
  remove(bucket: string, key: string): Promise<void>;
  list(bucket: string, prefix: string): Promise<{ name: string; size: number }[]>;
};
export type Runtime = {
  db: Database;
  storage: Storage;
  ownerEmails: string[];
  verifyToken(token: string): Promise<AuthUser | null>;
};

let current: Runtime | null = null;
export const setRuntime = (runtime: Runtime) => { current = runtime; };
export const runtime = () => { if (!current) throw Error("Servidor não configurado."); return current; };
export const db = () => runtime().db;

export type Row = { id: string; kind: string; client_id: number | null; parent_id: string | null; status: string; data: Record<string, any>; version: number; created_at: string; updated_at: string };
export type ClientRow = { id: number; name: string; phone: string; vehicle: string; plate: string; email: string };
export const now = () => new Date().toISOString();
export const localDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
export const text = (v: unknown, max = 2000) => String(v ?? "").trim().slice(0, max);
export const amount = (v: unknown) => { const n = Math.round(Number(v) * 100); if (!Number.isSafeInteger(n) || n < 0 || n > 100000000) throw Error("Valor inválido"); return n; };
export const json = JSON.stringify;

export async function identity(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const auth = token ? await runtime().verifyToken(token).catch(() => null) : null;
  if (!auth) return { user: null, admin: false, client: null as ClientRow | null };
  const userId = `supabase:${auth.id}`;
  const email = auth.email.trim().toLowerCase();
  const admin = auth.confirmed && !!email && runtime().ownerEmails.includes(email);
  const client = await db().prepare("SELECT id,name,phone,vehicle,plate,email FROM clients WHERE user_id=?").bind(userId).first<ClientRow>();
  // Contas de cliente usam um e-mail técnico de login; o contato real fica no cadastro.
  const user = { userId, displayName: auth.name || client?.name || auth.email, email: admin ? auth.email : client?.email || "", fullName: auth.name || null };
  return { user, admin, client };
}

export const record = (id: string) => db().prepare("SELECT * FROM workflow_records WHERE id=?").bind(id).first<Row>();
/** Insere um registro ignorando duplicados (mesma semântica do antigo INSERT OR IGNORE). */
export function insert(id: string, kind: string, client: number | null, parent: string | null, status: string, data: unknown) {
  const stamp = now();
  return db().prepare("INSERT INTO workflow_records(id,kind,client_id,parent_id,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?::jsonb,?,?) ON CONFLICT (id) DO NOTHING")
    .bind(id, kind, client, parent, status, json(data), stamp, stamp);
}
export function audit(actor: string, action: string, id: string) {
  return db().prepare("INSERT INTO audit_log(actor,action,record_id,created_at) VALUES(?,?,?,?)").bind(actor, action, id, now());
}
export const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers });
export const failure = (e: unknown) => reply({ error: e instanceof Error ? e.message : "Não foi possível concluir." }, 400);
export const noAccess = () => reply({ error: "Entre com uma conta autorizada." }, 403);

/** Sobreposição entre [inicio, inicio+duração) e outro atendimento ativo (exceto `exclude`). */
export const BOOKING_OVERLAP_SQL = `EXISTS(SELECT 1 FROM bookings b JOIN services s ON s.id=b.service_id
  WHERE b.id<>? AND b.status IN ('solicitado','agendado','em andamento')
  AND ?::timestamp < b.start_at::timestamp + COALESCE(b.booking_duration,s.booking_duration,s.duration) * interval '1 minute'
  AND ?::timestamp + ?::int * interval '1 minute' > b.start_at::timestamp)`;
export const BLOCK_OVERLAP_SQL = `EXISTS(SELECT 1 FROM workflow_records WHERE kind='block' AND status<>'cancelado'
  AND ?::timestamp < (data->>'end')::timestamp AND ?::timestamp + ?::int * interval '1 minute' > (data->>'start')::timestamp)`;

export async function checkAvailability(startAt: string, duration: number, exclude = 0) {
  const start = new Date(startAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration < 1) throw Error("Data ou duração inválida.");
  const end = start + duration * 60000;
  const booked = await db().prepare("SELECT b.start_at,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id<>? AND b.status IN ('solicitado','agendado','em andamento')").bind(exclude).all<{ start_at: string; duration: number }>();
  if (booked.results.some(b => start < new Date(b.start_at).getTime() + b.duration * 60000 && end > new Date(b.start_at).getTime())) throw Error("Horário ocupado por outro atendimento.");
  const blocks = await db().prepare("SELECT data FROM workflow_records WHERE kind='block' AND status<>'cancelado'").all<{ data: { start: string; end: string } }>();
  if (blocks.results.some(b => start < new Date(b.data.end).getTime() && end > new Date(b.data.start).getTime())) throw Error("Horário bloqueado pela gestão.");
}

export async function reserveBooking(clientId: number, serviceId: number, startAt: string, duration: number, amountCents: number, paid: number, notes: string) {
  await checkAvailability(startAt, duration);
  const added = await db().prepare(`INSERT INTO bookings(client_id,service_id,start_at,booking_duration,status,amount,paid,notes)
    SELECT ?::int,?::int,?::text,?::int,'agendado',?::int,?::int,?::text WHERE EXISTS(SELECT 1 FROM clients WHERE id=?::int)
    AND NOT ${BOOKING_OVERLAP_SQL.replace("b.id<>?", "TRUE")}
    AND NOT ${BLOCK_OVERLAP_SQL}
    AND (?::text NOT LIKE 'OS:%' OR NOT EXISTS(SELECT 1 FROM bookings WHERE notes=?::text)) RETURNING id`)
    .bind(clientId, serviceId, startAt, duration, amountCents, paid, notes, clientId, startAt, startAt, duration, startAt, startAt, duration, notes, notes).first<{ id: number }>();
  if (!added) throw Error("Horário ocupado, OS já agendada ou cliente inválido. Atualize a agenda.");
  return added;
}

export async function ensureBookingOrder(id: number) {
  const b = await db().prepare("SELECT b.*,s.name FROM bookings b JOIN services s ON b.service_id=s.id WHERE b.id=?").bind(id).first<any>();
  if (!b) return;
  const linked = await db().prepare("SELECT id FROM workflow_records WHERE kind='order' AND data->>'bookingId'=?").bind(String(id)).first();
  if (linked) return;
  await insert(`booking-${id}`, "order", b.client_id, null, "aguardando entrada", { title: b.name, items: [{ name: b.name, qty: 1, price: b.amount }], discount: 0, total: b.amount, paid: b.paid, bookingId: id, delivery: b.start_at, notes: b.notes, checkIn: [], checkOut: [], minutes: 0 }).run();
}

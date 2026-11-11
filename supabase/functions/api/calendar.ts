import {db,identity,reply} from './lib.ts';
const secretId='google-calendar-feed-secret-v1';
const feedBase='https://dqgyhlfsethmucylxcao.supabase.co/functions/v1/api/calendar';
const escape=(value:unknown)=>String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const stamp=(date:string)=>date.replace(/[-:]/g,'').slice(0,15);
export async function calendarGet(request:Request){
 const token=new URL(request.url).searchParams.get('token');
 const existing=await db().prepare("SELECT data->>'token' AS token FROM workflow_records WHERE id=? AND kind='settings'").bind(secretId).first<{token:string}>();
 if(!token||!existing||token!==existing.token)return reply({error:'Agenda indisponível.'},404);
 const bookings=await db().prepare("SELECT b.id,b.start_at,COALESCE(b.booking_duration,s.booking_duration,s.duration) AS duration,b.status,s.name AS service_name,c.name AS client_name,c.vehicle,c.plate FROM bookings b JOIN services s ON s.id=b.service_id JOIN clients c ON c.id=b.client_id WHERE b.status IN ('agendado','solicitado','em andamento') ORDER BY b.start_at").all<{id:number;start_at:string;duration:number;status:string;service_name:string;client_name:string;vehicle:string;plate:string}>();
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Feijao Detailer//Agenda//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Feijão Detailer · Agendamentos','X-WR-TIMEZONE:America/Sao_Paulo'];
 for(const b of bookings.results){
  const start=b.start_at.slice(0,16),end=new Date(Date.parse(start+':00-03:00')+Math.max(1,Number(b.duration))*60000);
  const localEnd=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(end).replace(' ','T');
  lines.push('BEGIN:VEVENT',`UID:booking-${b.id}@feijaodetailer.com.br`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;TZID=America/Sao_Paulo:${stamp(start)}`,`DTEND;TZID=America/Sao_Paulo:${stamp(localEnd)}`,`SUMMARY:${escape(b.client_name+' · '+b.service_name)}`,`DESCRIPTION:${escape([b.vehicle,b.plate,b.status].filter(Boolean).join(' · '))}`,'END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return new Response(lines.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'private, max-age=300'}});
}
export async function calendarManage(request:Request){
 const who=await identity(request);if(!who.admin)return reply({error:'Acesso não autorizado'},403);
 const d=db();let row=await d.prepare("SELECT data->>'token' AS token FROM workflow_records WHERE id=? AND kind='settings'").bind(secretId).first<{token:string}>();
 if(!row){const token=crypto.randomUUID()+crypto.randomUUID(),time=new Date().toISOString();await d.prepare("INSERT INTO workflow_records(id,kind,status,data,created_at,updated_at) VALUES(?,'settings','ativo',?::jsonb,?,?) ON CONFLICT(id) DO NOTHING").bind(secretId,JSON.stringify({token}),time,time).run();row=await d.prepare("SELECT data->>'token' AS token FROM workflow_records WHERE id=?").bind(secretId).first<{token:string}>()}
 return reply({url:`${feedBase}?token=${encodeURIComponent(row!.token)}`},200,{'Cache-Control':'private, no-store'});
}

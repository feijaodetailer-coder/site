import { db, now } from './lib.ts';
import type { Database } from './db.ts';
import { clientLoginEmail } from './customer.ts';

type Client = {id:number;name:string;phone:string;user_id:string|null;vehicle:string;plate:string;notes:string;address:string;email:string;referred_by_client_id:number|null};
export const phoneKey=(phone:unknown)=>{try{return clientLoginEmail(phone).digits;}catch{return null;}};

async function mergeInTransaction(d:Database,sourceId:number,targetId:number,actor:string,samePhone:boolean){
  const rows=await d.prepare('SELECT * FROM clients WHERE id IN (?,?) ORDER BY id FOR UPDATE').bind(sourceId,targetId).all<Client>();
  const source=rows.results.find(c=>c.id===sourceId),target=rows.results.find(c=>c.id===targetId);
  if(!source||!target||sourceId===targetId)throw Error('Os cadastros mudaram. Atualize a base de clientes.');
  if(source.user_id)throw Error('Mantenha como principal o cadastro com acesso ao site. Duas contas com acesso não podem ser unidas aqui.');
  if(samePhone&&(!phoneKey(source.phone)||phoneKey(source.phone)!==phoneKey(target.phone)))throw Error('Os telefones precisam ser iguais, incluindo o DDD.');
  const stamp=now(),vehicleId=`legacy-vehicle-${source.id}`;
  // Preserve both primary vehicles and point the source history to its original vehicle.
  if(source.vehicle){
    await d.prepare("INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at) VALUES (?,'vehicle',?,'aberto',?::jsonb,?,?) ON CONFLICT(id) DO NOTHING").bind(vehicleId,source.id,JSON.stringify({title:source.vehicle,plate:source.plate}),stamp,stamp).run();
    await d.prepare("UPDATE workflow_records SET data=jsonb_set(data,'{vehicleId}',to_jsonb(?::text)),version=version+1 WHERE client_id=? AND kind IN ('order','quote') AND COALESCE(data->>'vehicleId','')='' AND jsonb_typeof(data)='object'").bind(vehicleId,source.id).run();
  }
  for(const table of ['bookings','plan_subscriptions','workflow_records','attachments','referral_events'])await d.prepare(`UPDATE ${table} SET client_id=? WHERE client_id=?`).bind(target.id,source.id).run();
  await d.prepare('UPDATE referral_events SET referred_client_id=? WHERE referred_client_id=?').bind(target.id,source.id).run();
  await d.prepare('UPDATE clients SET referred_by_client_id=? WHERE referred_by_client_id=?').bind(target.id,source.id).run();
  await d.prepare("UPDATE clients SET notes=?,address=?,email=?,referred_by_client_id=? WHERE id=?").bind([target.notes,source.notes].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join('\n'),target.address||source.address,target.email||source.email,([source.id,target.id].includes(target.referred_by_client_id||0)?null:target.referred_by_client_id)||([source.id,target.id].includes(source.referred_by_client_id||0)?null:source.referred_by_client_id),target.id).run();
  // Keep a recoverable admin-only snapshot, without leaving duplicate clients in selectors.
  await d.prepare("INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at) VALUES (?,'merged_client',?,'unificado',?::jsonb,?,?)").bind(`merged-client-${source.id}`,target.id,JSON.stringify({source,targetBefore:target}),stamp,stamp).run();
  await d.prepare('DELETE FROM clients WHERE id=? AND user_id IS NULL').bind(source.id).run();
  await d.prepare('INSERT INTO audit_log(actor,action,record_id,created_at) VALUES (?,?,?,?)').bind(actor,`Cadastro ${source.id} unido ao cliente ${target.id}`,String(target.id),stamp).run();
}
export async function mergeClients(sourceId:number,targetId:number,actor:string,samePhone=false){
  await db().transaction(d=>mergeInTransaction(d,sourceId,targetId,actor,samePhone));
}
export async function mergeVerifiedPhone(actor:string,verifiedPhone?:string){
  const key=phoneKey(verifiedPhone);if(!key)return;
  await db().transaction(async d=>{
    // Serialize with manual merges and profile creation during verified automatic linking.
    await d.prepare('LOCK TABLE clients IN SHARE ROW EXCLUSIVE MODE').run();
    const target=await d.prepare('SELECT * FROM clients WHERE user_id=?').bind(actor).first<Client>();
    if(!target||phoneKey(target.phone)!==key)return;
    const rows=await d.prepare('SELECT * FROM clients WHERE user_id IS NULL ORDER BY id').all<Client>();
    for(const source of rows.results.filter(c=>phoneKey(c.phone)===key))await mergeInTransaction(d,source.id,target.id,actor,true);
  });
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from './harness.mjs';
test('agenda privada inclui agendamentos ativos e atualiza alterações',async()=>{
 const {pg,call}=await createApi();
 try{
 assert.equal((await call(null,'GET','/calendar')).status,404);
 assert.equal((await call('ana','GET','/calendar-manage')).status,403);
 const managed=await call('admin','GET','/calendar-manage');assert.equal(managed.status,200);
 const url=new URL(managed.body.url);assert.ok(url.searchParams.get('token'));
 const token=url.searchParams.get('token');
 await pg.exec("INSERT INTO clients(id,name,phone) VALUES(90,'Ana Teste','31999990000'); INSERT INTO services(id,name,category,price) VALUES(90,'Lavagem','Limpeza',10000); INSERT INTO bookings(id,client_id,service_id,start_at,booking_duration,status,amount) VALUES(90,90,90,'2026-11-20T15:00',30,'agendado',10000)");
 const req=key=>new Request(`https://x.supabase.co/functions/v1/api/calendar?token=${key}`);
 const {handle}=await import('../functions/api/router.ts');
 let res=await handle(req(token));assert.equal(res.status,200);let feed=await res.text();assert.match(feed,/Ana Teste · Lavagem/);assert.match(feed,/20261120T1500/);
 assert.equal((await handle(req('wrong'))).status,404);
 await pg.exec("UPDATE bookings SET status='cancelado' WHERE id=90");res=await handle(req(token));feed=await res.text();assert.doesNotMatch(feed,/Ana Teste/);
 }finally{await pg.close()}
});

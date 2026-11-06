import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi,users} from './harness.mjs';
import {clientReturnAlerts} from '../functions/_shared/overview.ts';
import {dayInBrazil,addDays} from '../functions/_shared/vehicle-hub.ts';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('mensagens persistem, podem ser desfeitas e cada ciclo gera novas pendências',async()=>{
 const {pg,call}=await createApi();
 try{
 const today=dayInBrazil(),date=addDays(today,-16);
 await pg.query("INSERT INTO clients(id,name,phone) VALUES(100,'Cliente','31999990000')");
 await pg.query("INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at) VALUES('os','order',100,'entregue',$1,$2,$2)",[{completedDate:date,sendReminders:true},today]);
 const alert=clientReturnAlerts((await pg.query('SELECT * FROM workflow_records')).rows,[],today)[0];
 assert.equal((await call('ana','POST','/workflow',{action:'message_sent',alertId:alert.id})).status,403);
 ok(await call('admin','POST','/workflow',{action:'message_sent',alertId:alert.id}));
 ok(await call('admin','POST','/workflow',{action:'message_sent',alertId:alert.id}));
 let rows=(await pg.query('SELECT * FROM workflow_records')).rows;
 assert.equal(rows.filter(r=>r.kind==='message_sent').length,1);
 assert.equal(clientReturnAlerts(rows,[],today).length,0);
 assert.equal(clientReturnAlerts(rows,[],addDays(date,30))[0].stage,30);
 ok(await call('admin','POST','/workflow',{action:'undo_message_sent',id:alert.id}));
 rows=(await pg.query('SELECT * FROM workflow_records')).rows;
 assert.equal(clientReturnAlerts(rows,[],today).length,1);
 assert.equal((await call('admin','POST','/workflow',{action:'message_sent',alertId:'inventado'})).status,400);
 }finally{await pg.close();}
});
test('união por telefone preserva relações e não permite apropriação de histórico',async()=>{
 const {pg,call}=await createApi();
 try{
 await pg.exec("INSERT INTO clients(id,name,phone,vehicle,notes,address) VALUES(100,'Ana antiga','(31) 99999-0001','Carro antigo','Nota antiga','Endereço antigo'); INSERT INTO clients(id,name,phone) VALUES(101,'Outro','31988880000');");
 ok(await call('ana','POST','/workflow',{action:'profile',name:'Ana nova',phone:'+55 31 99999-0001'}));
 const target=(await pg.query('SELECT * FROM clients WHERE user_id=$1',['supabase:'+users.ana.id])).rows[0];
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM clients')).rows[0].n,3,'telefone digitado não comprova posse');
 const stamp=new Date().toISOString();
 await pg.query("INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at) VALUES('os-old','order',100,'entregue',$1,$2,$2)",[{title:'Serviço',total:12300},stamp]);
 await pg.exec("INSERT INTO bookings(client_id,service_id,start_at,amount) VALUES(100,1,'2026-01-01',12300); INSERT INTO plan_subscriptions(client_id,plan_service_id,amount,requested_at) VALUES(100,1,10000,'2026-01-01'); INSERT INTO attachments(id,record_id,client_id,name,type,created_at) VALUES('file','os-old',100,'foto','image/jpeg','2026-01-01'); INSERT INTO referral_events(client_id,referred_client_id,event_type,description,created_at) VALUES(101,100,'indicacao','Teste','2026-01-01');");
 const request={action:'merge_clients',sourceId:100,targetId:target.id};
 assert.equal((await call('ana','POST','/workflow',request)).status,403);
 assert.equal((await call('admin','POST','/workflow',{...request,sourceId:101})).status,400);
 const own=ok(await call('ana','GET','/workflow'));
 assert.ok(!own.records.some(r=>r.id==='os-old'));
 ok(await call('admin','POST','/workflow',request));
 assert.equal((await pg.query('SELECT * FROM clients WHERE id=100')).rows.length,0);
 for(const table of ['bookings','attachments','plan_subscriptions'])assert.equal((await pg.query(`SELECT client_id FROM ${table}`)).rows[0].client_id,target.id);
 const order=(await pg.query("SELECT * FROM workflow_records WHERE id='os-old'")).rows[0];
 assert.equal(order.client_id,target.id);assert.equal(order.data.total,12300);assert.equal(order.data.vehicleId,'legacy-vehicle-100');
 assert.equal((await pg.query('SELECT referred_client_id FROM referral_events')).rows[0].referred_client_id,target.id);
 assert.equal((await pg.query('SELECT notes FROM clients WHERE id=$1',[target.id])).rows[0].notes,'Nota antiga');
 assert.ok(ok(await call('ana','GET','/workflow')).records.some(r=>r.id==='os-old'));
 assert.ok(!ok(await call('ana','GET','/workflow')).records.some(r=>r.kind==='merged_client'));
 assert.equal((await call('admin','POST','/workflow',request)).status,400,'retry cannot merge again');
 }finally{await pg.close();}
});
test('telefone verificado une cadastro antigo automaticamente; outra conta permanece isolada',async()=>{
 const {pg,call}=await createApi();
 try{
 users.ana.verifiedPhone='+5531999990001';
 await pg.exec("INSERT INTO clients(id,name,phone) VALUES(100,'Ana antiga','(31) 99999-0001');");
 ok(await call('ana','POST','/customer-auth',{mode:'register',name:'Ana',phone:'31999990001',vehicle:'Carro novo'}));
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM clients')).rows[0].n,1);
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM workflow_records WHERE kind='merged_client'")).rows[0].n,1);
 }finally{delete users.ana.verifiedPhone;await pg.close();}
});

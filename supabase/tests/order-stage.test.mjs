import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from './harness.mjs';
test('etapa rápida salva sem alterar valores, conclui agenda e gera lembrete uma vez',async()=>{
 const {pg,call}=await createApi();
 try{
 await pg.exec("INSERT INTO clients(id,name,phone) VALUES(90,'Cliente','31999990000'); INSERT INTO services(id,name,category,price) VALUES(90,'Serviço','Limpeza',15000); INSERT INTO bookings(id,client_id,service_id,start_at,amount,paid) VALUES(90,90,90,'2026-11-20T15:00',15000,5000)");
 const stamp=new Date().toISOString();
 await pg.query("INSERT INTO workflow_records(id,kind,client_id,status,data,created_at,updated_at) VALUES('os-90','order',90,'aguardando entrada',$1,$2,$2)",[{title:'Serviço',items:[{name:'Serviço',qty:1,price:15000}],total:15000,paid:5000,bookingId:90},stamp]);
 const change=(as,status,version)=>call(as,'POST','/workflow',{action:'order_stage',id:'os-90',status,version});
 assert.equal((await change('ana','execução',1)).status,403);
 assert.equal((await change('admin','execução',1)).status,200);
 assert.equal((await change('admin','revisão',1)).status,400);
 let order=(await pg.query("SELECT * FROM workflow_records WHERE id='os-90'")).rows[0];
 assert.equal(order.data.total,15000);assert.equal(order.data.paid,5000);assert.equal(order.status,'execução');
 assert.equal((await pg.query('SELECT status,amount,paid FROM bookings WHERE id=90')).rows[0].status,'em andamento');
 assert.equal((await change('admin','entregue',2)).status,200);
 order=(await pg.query("SELECT * FROM workflow_records WHERE id='os-90'")).rows[0];
 assert.equal(order.status,'entregue');assert.match(order.data.completedDate,/^\d{4}-\d{2}-\d{2}$/);
 assert.equal((await pg.query('SELECT status,amount,paid FROM bookings WHERE id=90')).rows[0].status,'concluido');
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM workflow_records WHERE kind='followup'")).rows[0].n,1);
 assert.equal((await change('admin','execução',3)).status,400);
 assert.equal((await change('admin','cancelado',3)).status,400);
 }finally{await pg.close()}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clientReturnAlerts,whatsappNumber,returnMessage} from './overview.ts';

const order=(id,client_id,completedDate,status='entregue')=>({id,kind:'order',client_id,parent_id:null,status,version:1,created_at:'2026-09-01T12:00:00Z',data:{title:'Lavagem',completedDate}});
test('gera um aviso interno aos 15 dias e elegibilidade aos 30',()=>{
  const records=[order('first',1,'2026-09-01')];
  assert.equal(clientReturnAlerts(records,[],'2026-09-15').length,0);
  assert.deepEqual(clientReturnAlerts(records,[],'2026-09-16').map(a=>a.stage),[15]);
  assert.deepEqual(clientReturnAlerts(records,[],'2026-10-01').map(a=>a.stage),[30]);
});
test('não duplica cliente e reinicia a contagem após serviço novo',()=>{
  const records=[order('first',1,'2026-09-01'),order('second',1,'2026-09-20')];
  assert.equal(clientReturnAlerts(records,[],'2026-10-01').length,0);
  const alerts=clientReturnAlerts(records,[],'2026-10-05');
  assert.equal(alerts.length,1);
  assert.equal(alerts[0].lastServiceDay,'2026-09-20');
  assert.equal(alerts[0].stage,15);
  assert.deepEqual(clientReturnAlerts(records,[],'2026-10-05'),alerts);
});
test('ignora serviços cancelados e não conta agendamento vinculado duas vezes',()=>{
  const bookings=[{id:7,client_id:1,start_at:'2026-09-01T10:00:00',status:'concluido',service_name:'Lavagem',amount:10000,paid:10000}];
  const records=[{...order('linked',1,undefined),data:{title:'Lavagem',bookingId:7}},order('cancelled',2,'2026-08-01','cancelado')];
  const alerts=clientReturnAlerts(records,bookings,'2026-10-01');
  assert.equal(alerts.length,1);
  assert.equal(alerts[0].clientId,1);
  assert.equal(alerts[0].stage,30);
});
test('normaliza apenas telefones brasileiros válidos',()=>{
  assert.equal(whatsappNumber('(31) 99344-4280'),'5531993444280');
  assert.equal(whatsappNumber('+55 31 99344-4280'),'5531993444280');
  assert.equal(whatsappNumber('123'),null);
});
test('mensagem de 15 dias pergunta sobre o atendimento; a de 30 oferece 10%',()=>{
  const reminder=returnMessage('Ana Maria',15);
  assert.match(reminder,/está tudo certo/);
  assert.match(reminder,/agendar algum novo serviço/);
  assert.doesNotMatch(reminder,/desconto/);
  const offer=returnMessage('Ana Maria',30);
  assert.match(offer,/10% de desconto/);
  assert.match(offer,/Ana/);
});

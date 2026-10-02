import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reminders,serviceHistory,completedDay,activeCampaign,campaignData,validDay,addDays} from './vehicle-hub.ts';
const order=(id,data={},status='entregue')=>({id,kind:'order',client_id:1,parent_id:null,status,version:1,created_at:'2026-09-24T12:00:00Z',data:{title:'Lavagem',completedDate:'2026-09-09',...data}});
test('avisos vencem exatamente nos dias 15 e 30, incluindo virada de mês',()=>{
 assert.deepEqual(reminders([order('a')],[],'2026-09-23').map(n=>n.due),[false,false]);
 const day15=reminders([order('a')],[],'2026-09-24');assert.equal(day15.filter(n=>n.due).length,1);assert.equal(day15.find(n=>n.due)?.days,15);
 assert.equal(reminders([order('a')],[],'2026-10-09').filter(n=>n.due).length,2);
 assert.equal(addDays('2028-02-14',15),'2028-02-29');
});
test('cancelamento ou reabertura remove os lembretes de atendimento concluído',()=>{
 for(const status of ['cancelado','execução','pronto'])assert.equal(reminders([order('a',{},status)],[]).length,0);
});
test('leitura é estável e individual por atendimento e prazo',()=>{
 const rows=[order('a'),order('b')];const id=reminders(rows,[],'2026-09-24').find(n=>n.orderId==='a'&&n.days===15).id;
 rows.push({...order('read'),kind:'notification_read',data:{notificationId:id}});
 const all=reminders(rows,[],'2026-10-09');assert.equal(all.filter(n=>n.read).length,1);assert.equal(all.find(n=>n.read)?.orderId,'a');
});
test('histórico antigo não duplica agendamento e não inventa data de importação',()=>{
 const booking={id:3,start_at:'2026-08-01T14:00',status:'concluido',service_name:'Lavagem',amount:10000,paid:10000};
 const old=order('old',{completedDate:undefined,bookingId:3});assert.equal(completedDay(old,[booking]),'2026-08-01');
 assert.equal(serviceHistory([old],[booking]).length,1);assert.equal(serviceHistory([],[booking]).length,1);
 const unknown=order('unknown',{completedDate:undefined});assert.equal(completedDay(unknown,[]),null);assert.equal(reminders([unknown],[]).length,0);
});
test('vínculos de veículos permanecem explícitos, sem adivinhar veículo de histórico antigo',()=>{
 const result=reminders([order('a',{vehicleId:'v1'}),order('b')],[],'2026-09-24');
 assert.equal(result.filter(n=>n.vehicleId==='v1').length,2);assert.equal(result.filter(n=>n.vehicleId==='').length,2);
});
test('campanhas respeitam estado e período inclusive no último dia',()=>{
 const c={...order('campaign'),kind:'campaign',status:'ativa',data:{starts:'2026-09-01',ends:'2026-09-30'}};
 assert.equal(activeCampaign(c,'2026-08-31'),false);assert.equal(activeCampaign(c,'2026-09-30'),true);assert.equal(activeCampaign(c,'2026-10-01'),false);
 assert.equal(activeCampaign({...c,status:'rascunho'},'2026-09-24'),false);assert.equal(activeCampaign({...c,status:'encerrada'},'2026-09-24'),false);
});
test('campanhas exigem condições, benefício e datas válidas',()=>{
 const good={title:'Cuidados',description:'Descrição',offer:'10%',terms:'Somente serviço indicado',starts:'2026-09-01',ends:'2026-09-30'};
 assert.equal(campaignData(good,'ativa').offer,'10%');
 for(const change of [{terms:''},{offer:''},{ends:'2026-02-30'},{starts:'2026-10-01'}])assert.throws(()=>campaignData({...good,...change},'ativa'));
 assert.equal(validDay('2026-02-30'),false);
});

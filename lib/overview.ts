import {completedDay,dayInBrazil,validDay,type HubBooking,type HubRecord} from './vehicle-hub.ts';

export type ClientReturnAlert={
  id:string;
  clientId:number;
  lastServiceDay:string;
  daysSinceService:number;
  stage:15|30;
};

type ClientBooking=HubBooking&{client_id:number};

// One current alert per client, based on the most recent completed service.
// Deriving it from service history avoids daily duplicate inserts and resets
// the clock automatically when a newer service is completed.
export function clientReturnAlerts(records:HubRecord[],bookings:ClientBooking[],today=dayInBrazil()):ClientReturnAlert[]{
  if(!validDay(today))return [];
  const latest=new Map<number,string>();
  const recordDay=(clientId:number|null,day:string|null)=>{
    if(!clientId||!day||!validDay(day)||day>today)return;
    if(!latest.has(clientId)||day>latest.get(clientId)!)latest.set(clientId,day);
  };
  const orders=records.filter(r=>r.kind==='order');
  for(const order of orders)recordDay(order.client_id,completedDay(order,bookings));
  const linked=new Set(orders.map(r=>Number(r.data.bookingId)).filter(Boolean));
  for(const booking of bookings){
    if(booking.status==='concluido'&&!linked.has(booking.id)){
      recordDay(booking.client_id,booking.start_at.slice(0,10));
    }
  }
  return [...latest].flatMap(([clientId,lastServiceDay])=>{
    const daysSinceService=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(lastServiceDay+'T12:00:00Z'))/86400000);
    if(daysSinceService<15)return [];
    const stage=daysSinceService>=30?30:15;
    return [{id:`return:${clientId}:${lastServiceDay}:${stage}`,clientId,lastServiceDay,daysSinceService,stage} as ClientReturnAlert];
  }).sort((a,b)=>b.daysSinceService-a.daysSinceService||a.clientId-b.clientId);
}

export function whatsappNumber(phone:unknown):string|null{
  const digits=String(phone??'').replace(/\D/g,'');
  if(/^\d{10,11}$/.test(digits))return '55'+digits;
  if(/^55\d{10,11}$/.test(digits))return digits;
  return null;
}

export function returnMessage(name:string,stage:15|30):string{
  const firstName=name.trim().split(/\s+/)[0]||'tudo bem';
  if(stage===15)return `Olá, ${firstName}! Aqui é da Feijão Detailer. Passando para saber se está tudo certo com seu veículo após o último atendimento. Ficou alguma dúvida ou você gostaria de agendar algum novo serviço? Estamos à disposição!`;
  return `Olá, ${firstName}! Aqui é da Feijão Detailer. Já faz um tempo desde o último cuidado com seu veículo. Preparamos uma condição especial de retorno: 10% de desconto em um novo serviço de estética automotiva. Gostaria de agendar? Podemos conversar sobre o melhor cuidado para o seu carro.`;
}

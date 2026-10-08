export type HubRecord = {id:string;kind:string;client_id:number|null;parent_id:string|null;status:string;version:number;created_at:string;data:Record<string,any>};
export type HubBooking = {id:number;start_at:string;status:string;service_name:string;amount:number;paid:number};
export const dayInBrazil = (value = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(value);
export function validDay(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function addDays(day:string,days:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function completedDay(order:HubRecord,bookings:HubBooking[]){
 if(order.status!=='entregue')return null;
 if(validDay(order.data.completedDate))return order.data.completedDate;
 // Old appointments retain their recorded service day; never substitute the import date.
 const booking=bookings.find(b=>b.id===Number(order.data.bookingId)&&b.status==='concluido');
 const day=booking?.start_at.slice(0,10);return validDay(day)?day:null;
}
export function serviceHistory(records:HubRecord[],bookings:HubBooking[]){
 const orders=records.filter(r=>r.kind==='order'&&r.status==='entregue'&&r.data.sendReminders!==false).map(r=>({...r,completedDay:completedDay(r,bookings)}));
 const linked=new Set(records.filter(r=>r.kind==='order').map(r=>Number(r.data.bookingId)));
 const legacy=bookings.filter(b=>b.status==='concluido'&&!linked.has(b.id)).map(b=>({id:`legacy-booking-${b.id}`,kind:'order',client_id:null,parent_id:null,status:'entregue',version:0,created_at:b.start_at,data:{title:b.service_name,total:b.amount,paid:b.paid,bookingId:b.id,items:[{name:b.service_name,qty:1,price:b.amount}]},completedDay:validDay(b.start_at.slice(0,10))?b.start_at.slice(0,10):null} as HubRecord&{completedDay:string|null}));
 return [...orders,...legacy].sort((a,b)=>(b.completedDay||'').localeCompare(a.completedDay||''));
}
export function reminders(records:HubRecord[],bookings:HubBooking[],today=dayInBrazil()){
 const read=new Set(records.filter(r=>r.kind==='notification_read').map(r=>r.data.notificationId));
 return serviceHistory(records,bookings).flatMap(order=>order.completedDay?[15,30].map(days=>({id:`care:${order.id}:${order.completedDay}:${days}`,orderId:order.id,vehicleId:String(order.data.vehicleId||''),title:order.data.title,days,date:addDays(order.completedDay!,days),read:read.has(`care:${order.id}:${order.completedDay}:${days}`)})):[]).map(n=>({...n,due:n.date<=today})).sort((a,b)=>b.date.localeCompare(a.date));
}
export function activeCampaign(r:HubRecord,today=dayInBrazil()){
 return r.kind==='campaign'&&r.status==='ativa'&&validDay(r.data.starts)&&validDay(r.data.ends)&&r.data.starts<=today&&r.data.ends>=today;
}
export function campaignData(input:Record<string,unknown>,status:string){
 const clean=(v:unknown,max:number)=>String(v??'').trim().slice(0,max);
 const data={title:clean(input.title,120),description:clean(input.description,1200),offer:clean(input.offer,120),terms:clean(input.terms,1200),starts:clean(input.starts,10),ends:clean(input.ends,10)};
 if(!data.title||!data.description||!data.offer||!data.terms)throw Error('Preencha título, descrição, benefício e condições da campanha.');
 if(!validDay(data.starts)||!validDay(data.ends)||data.ends<data.starts)throw Error('Informe um período válido para a campanha.');
 if(!['rascunho','ativa','encerrada'].includes(status))throw Error('Estado da campanha inválido.');
 return data;
}

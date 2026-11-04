export type OrderAmounts={status:string;data:{total?:number;paid?:number}};
export function paymentStatus(order:OrderAmounts){
 const total=Number(order.data.total||0),paid=Number(order.data.paid||0);
 return total<=0?'sem-valor':paid>=total?'pago':paid>0?'parcial':'nao-pago';
}
export function orderSummary(orders:OrderAmounts[]){
 const completed=orders.filter(order=>order.status==='entregue');
 const value=completed.reduce((sum,order)=>sum+Number(order.data.total||0),0);
 return {total:orders.filter(order=>order.status!=='cancelado').reduce((sum,order)=>sum+Number(order.data.total||0),0),completed:completed.length,value,ticket:completed.length?Math.round(value/completed.length):0,received:completed.reduce((sum,order)=>sum+Number(order.data.paid||0),0),outstanding:orders.filter(order=>order.status!=='cancelado').reduce((sum,order)=>sum+Math.max(0,Number(order.data.total||0)-Number(order.data.paid||0)),0)};
}

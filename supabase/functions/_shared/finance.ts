export const expenseCategories = ['Produtos e insumos','Contas fixas','Manutenção e reforma','Alimentação','Equipamentos','Marketing','Transporte','Outras despesas'];
export const paymentMethods = ['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Boleto','Outro','Não informado'];
export type Kind = 'entrada'|'saida';
export type ProductPurchase={classification:string;name:string;brand:string;size:string;unit:string;startedOn:string;finishedOn:string;services:number|null};
export const productClassifications=["Ácido","Alcalino","Shampoo","APC","Cera","Desengraxante","Selante","Polidor","Outro"];
export function productDays(p:ProductPurchase){return p.startedOn?Math.round((Date.parse((p.finishedOn||brazilToday())+"T12:00:00Z")-Date.parse(p.startedOn+"T12:00:00Z"))/86400000):null;}
export type Tx = {product:ProductPurchase|null;id:number;date:string;kind:Kind;category:string;subcategory:string;description:string;amount:number;booking_id:number|null;record_id:string|null;payment_method:string;financial_status:string;notes:string;is_stock_purchase:number;is_recurring:number;recurrence_key:string|null;version:number;paidAmount:number;paidDate:string;sourceId:string|null;sourceLabel:string;warning:string};
export type FinanceRecord = {id:string;kind:string;status:string;data:Record<string,any>;version:number;created_at:string;updated_at:string};
export type Category={id:number;name:string;type:Kind;active:number};
export type FinanceData={transactions:Tx[];categories:Category[];records:FinanceRecord[];bookings:{id:number;amount:number;paid:number;status:string;start_at:string}[]};
export const brazilToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
export const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export const cash=(t:Pick<Tx,'amount'|'financial_status'|'paidAmount'>)=>t.financial_status==='pago'?t.amount:t.financial_status==='parcial'?t.paidAmount:0;
export const remaining=(t:Tx)=>['pago','cancelado'].includes(t.financial_status)?0:Math.max(0,t.amount-cash(t));
export const inPeriod=(date:string,from:string,to:string)=>(!from||date>=from)&&(!to||date<=to);
export function summarize(data:FinanceData,from:string,to:string){
 const income=data.transactions.filter(t=>t.kind==='entrada'&&inPeriod(t.paidDate||t.date,from,to)).reduce((n,t)=>n+cash(t),0);
 const expense=data.transactions.filter(t=>t.kind==='saida'&&inPeriod(t.paidDate||t.date,from,to)).reduce((n,t)=>n+cash(t),0);
 const orders=new Map(data.records.filter(r=>r.kind==='order').map(r=>[r.id,r]));
 const linkedBookings=new Set([...orders.values()].map(o=>Number(o.data.bookingId)).filter(Boolean));
 const pending=data.transactions.filter(t=>t.kind==='entrada'&&!t.sourceId&&!t.booking_id).reduce((n,t)=>n+remaining(t),0);
 const receivable=pending+data.records.filter(r=>['order','bill'].includes(r.kind)&&r.status!=='cancelado'&&(r.kind==='order'||r.data.direction==='receber')).reduce((n,r)=>n+Math.max(0,Number(r.data.total||0)-Number(r.data.paid||0)),0)+data.bookings.filter(b=>!linkedBookings.has(b.id)&&!['cancelado','solicitado'].includes(b.status)).reduce((n,b)=>n+Math.max(0,b.amount-b.paid),0);
 const complete=[...orders.values()].filter(o=>o.status==='entregue');
 const dated=complete.map(o=>({o,date:String(o.data.completedDate||'')}));
 const periodOrders=dated.filter(x=>x.date&&inPeriod(x.date,from,to));
 return {income,expense,balance:income-expense,receivable,ticket:periodOrders.length?Math.round(periodOrders.reduce((n,{o})=>n+Number(o.data.total||0),0)/periodOrders.length):0,completed:periodOrders.length,undated:dated.filter(x=>!x.date).length};
}
export function expenseBreakdown(transactions:Tx[],from:string,to:string,category=''){
 const totals=new Map<string,number>();
 for(const t of transactions){if(t.kind!=='saida'||!inPeriod(t.paidDate||t.date,from,to)||!cash(t))continue;const name=t.category||'Sem categoria';totals.set(name,(totals.get(name)||0)+cash(t));}
 const total=[...totals.values()].reduce((a,b)=>a+b,0);
 return [...totals].filter(([name])=>!category||name===category).map(([name,value])=>({name,value,percent:total?value/total*100:0})).sort((a,b)=>b.value-a.value);
}
export function parseMovement(p:Record<string,unknown>){
 const str=(k:string,max=180)=>String(p[k]??'').trim().slice(0,max);
 const money=(v:unknown)=>{const s=String(v??'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Informe um valor em reais, com até duas casas decimais.');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>100000000)throw Error('Valor fora do limite permitido.');return n;};
 const kind=str('kind') as Kind,status=str('financialStatus'),amount=money(p.amount),date=str('date'),paidDate=str('paidDate')||date;
 if(!['entrada','saida'].includes(kind)||!['pago','pendente','parcial','cancelado'].includes(status)||!str('description')||!str('category')||!amount||!validDate(date)||!validDate(paidDate))throw Error('Preencha tipo, data, descrição, categoria, situação e valor válidos.');
 const paidAmount=status==='pago'?amount:status==='parcial'?money(p.paidAmount):0;
 if(status==='parcial'&&(!paidAmount||paidAmount>=amount))throw Error('O valor parcial deve ser maior que zero e menor que o total.');
 if(paidAmount&&paidDate>brazilToday())throw Error('Um pagamento realizado não pode ter data futura.');
 let product:ProductPurchase|null=null;
 if(kind==='saida'&&p.isStockPurchase===true){
 const raw=p.product as Record<string,unknown>|undefined;
 if(raw){const text=(k:string,max=120)=>String(raw[k]??'').trim().slice(0,max);
 const services=text('services')===''?null:Number(raw.services),size=text('size').replace(',','.');
 if(!text('classification')||!text('name')||!size||!Number.isFinite(Number(size))||Number(size)<=0||!['ml','L','g','kg','un'].includes(text('unit')))throw Error('Informe classificação, nome e tamanho válido do produto.');
 if(services!==null&&(!Number.isSafeInteger(services)||services<0))throw Error('Informe uma quantidade inteira de serviços, igual ou maior que zero.');
 const startedOn=text('startedOn'),finishedOn=text('finishedOn');
 if(startedOn&&(!validDate(startedOn)||startedOn<date||startedOn>brazilToday()))throw Error('O início do uso deve estar entre a compra e hoje.');
 if(finishedOn&&(!validDate(finishedOn)||!startedOn||finishedOn<startedOn||finishedOn>brazilToday()))throw Error('A data em que acabou deve estar entre o início do uso e hoje.');
 if(services!==null&&services>0&&!startedOn)throw Error('Informe quando começou a usar o produto.');
 product={classification:text('classification'),name:text('name'),brand:text('brand'),size,unit:text('unit'),startedOn,finishedOn,services};
 }
 }
 return {product,date,kind,category:str('category',80),subcategory:str('subcategory',80),description:str('description'),amount,payment_method:str('paymentMethod',40)||'Não informado',financial_status:status,notes:str('notes',1000),is_stock_purchase:kind==='saida'&&p.isStockPurchase===true?1:0,is_recurring:kind==='saida'&&p.isRecurring===true?1:0,recurrence_key:kind==='saida'&&p.isRecurring===true?(str('recurrenceKey',100)||crypto.randomUUID()):null,paidAmount,paidDate};
}

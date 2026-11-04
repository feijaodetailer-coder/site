// Compatibilidade com registros antigos cujo JSON ou total não veio normalizado.
export function normalizeWorkflowRecord<T extends {kind:string;data:unknown}>(record:T):T {
 let value=record.data;
 if(typeof value==='string'){try{value=JSON.parse(value)}catch{return record}}
 if(!value||typeof value!=='object'||Array.isArray(value))return record;
 const data={...value} as Record<string,unknown>;
 if(['order','quote'].includes(record.kind)&&Array.isArray(data.items)&&data.items.length){
  const total=data.items.reduce((sum:number,item:{price?:number;qty?:number})=>sum+Number(item.price||0)*Number(item.qty||0),0)-Number(data.discount||0);
  if(Number.isFinite(total)&&total>=0&&(data.total==null||Number(data.total)===0))data.total=total;
 }
 return {...record,data};
}

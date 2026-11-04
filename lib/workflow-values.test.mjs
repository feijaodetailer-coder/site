import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWorkflowRecord} from './workflow-values.ts';
test('recupera total de itens persistidos sem inventar pagamento',()=>{
 const row=normalizeWorkflowRecord({kind:'order',data:JSON.stringify({items:[{qty:2,price:12000}],discount:1000,total:0,paid:5000})});
 assert.equal(row.data.total,23000);assert.equal(row.data.paid,5000);
});
test('preserva desconto integral e total informado',()=>{
 assert.equal(normalizeWorkflowRecord({kind:'quote',data:{items:[{qty:1,price:100}],discount:100,total:0}}).data.total,0);
 assert.equal(normalizeWorkflowRecord({kind:'order',data:{total:200,items:[{qty:1,price:100}]}}).data.total,200);
});

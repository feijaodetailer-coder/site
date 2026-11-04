import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderSummary,paymentStatus} from './order-summary.ts';
const order=(status,total,paid)=>({status,data:{total,paid}});
test('conclusão soma valor executado, sem inventar recebimento ou perder dívida entregue',()=>{
 assert.deepEqual(orderSummary([order('entregue',10000,0),order('entregue',20000,5000),order('execução',5000,1000),order('cancelado',90000,0)]),{completed:2,value:30000,ticket:15000,received:5000,outstanding:29000});
});
test('situação de pagamento considera saldo, parcial e OS sem valor',()=>{
 assert.equal(paymentStatus(order('entregue',10000,0)),'nao-pago');
 assert.equal(paymentStatus(order('execução',10000,3000)),'parcial');
 assert.equal(paymentStatus(order('entregue',10000,10000)),'pago');
 assert.equal(paymentStatus(order('entregue',0,0)),'sem-valor');
 assert.equal(orderSummary([]).ticket,0);
});

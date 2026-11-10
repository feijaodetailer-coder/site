import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingMessage,bookingWhatsapp} from './booking-message.ts';
test('confirmação usa domínio legível, dados do agendamento e telefone sem duplicar DDI',()=>{
 const booking={name:'Ana Maria',phone:'+55 (31) 99999-0001',service:'Lavagem detalhada',startAt:'2026-11-20T15:30'};
 const message=bookingMessage(booking);
 assert.match(message,/Olá, Ana!/);
 assert.match(message,/20\/11\/2026, às 15:30/);
 assert.match(message,/https:\/\/www\.feijãodetailer\.com\.br/);
 assert.match(message,/Primeiro acesso/);
 const url=new URL(bookingWhatsapp(booking));
 assert.equal(url.pathname,'/5531999990001');
 assert.equal(url.searchParams.get('text'),message);
 assert.equal(bookingWhatsapp({...booking,phone:'123'}),null);
});

import {whatsappNumber} from './overview.ts';

export type BookingMessage = {name:string;phone?:string;service:string;startAt:string};
export function bookingMessage(booking:BookingMessage){
 const date=`${booking.startAt.slice(8,10)}/${booking.startAt.slice(5,7)}/${booking.startAt.slice(0,4)}`;
 return `Olá, ${booking.name.trim().split(/\s+/)[0]||'tudo bem'}! Seu agendamento na Feijão Detailer está confirmado. 🚗✨\n\nServiço: ${booking.service}\nData: ${date}, às ${booking.startAt.slice(11,16)}\n\nPara acompanhar seus serviços, acesse https://www.feijãodetailer.com.br, entre na área do cliente e escolha Primeiro acesso. Cadastre-se com este mesmo telefone. Se já possui cadastro, basta entrar.\n\nPrecisando reagendar, fale conosco por aqui!`;
}
export function bookingWhatsapp(booking:BookingMessage){
 const phone=whatsappNumber(booking.phone);
 return phone?`https://wa.me/${phone}?text=${encodeURIComponent(bookingMessage(booking))}`:null;
}

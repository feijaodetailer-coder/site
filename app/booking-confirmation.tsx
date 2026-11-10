import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {bookingMessage,bookingWhatsapp,type BookingMessage} from '../lib/booking-message';

export default function BookingConfirmation({booking,onClose}:{booking:BookingMessage|null;onClose:()=>void}){
 const url=booking?bookingWhatsapp(booking):null;
 return <Dialog open={!!booking} onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="agenda-dialog"><DialogHeader><DialogTitle>Confirmação do agendamento</DialogTitle><DialogDescription>O agendamento está salvo. Confira a mensagem e envie ao cliente pelo WhatsApp.</DialogDescription></DialogHeader>{booking&&<><textarea aria-label="Mensagem de confirmação" readOnly rows={12} value={bookingMessage(booking)} style={{width:'100%',padding:14,border:'1px solid #ddd',borderRadius:10,fontSize:14,lineHeight:1.6}}/><div className="agenda-dialog-actions">{url?<Button asChild><a href={url} target="_blank" rel="noopener noreferrer">Enviar confirmação no WhatsApp</a></Button>:<p>Cadastre um telefone com DDD para enviar pelo WhatsApp. Você também pode copiar o texto acima.</p>}<Button variant="outline" onClick={onClose}>Fechar</Button></div></>}</DialogContent></Dialog>;
}

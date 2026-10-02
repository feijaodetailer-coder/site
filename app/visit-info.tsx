import { ArrowUpRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import "./visit-info.css";

const mapsUrl = "https://www.google.com/maps/place/FEIJ%C3%83O+DETAILER/data=!4m2!3m1!1s0x0:0x4510808f38f70ca3";

export default function VisitInfo() {
  return <section className="visit-info" aria-labelledby="visit-info-title">
    <div className="visit-info-heading">
      <p>PLANEJE SUA VISITA</p>
      <h2 id="visit-info-title">Onde estamos e quando atendemos</h2>
    </div>
    <div className="visit-info-grid">
      <div className="visit-info-item">
        <MapPin size={21} aria-hidden="true"/>
        <div><h3>Endereço</h3><address>Rua Ipê Amarelo, 35<br/>Paraíso das Piabas, Ribeirão das Neves – MG<br/>CEP 33910-070</address><a href={mapsUrl} target="_blank" rel="noopener noreferrer">Ver no Google Maps <ArrowUpRight size={15}/></a></div>
      </div>
      <div className="visit-info-item">
        <Clock3 size={21} aria-hidden="true"/>
        <div><h3>Horário de funcionamento</h3><p>Segunda a sexta: 15h às 20h<br/>Sábado: 8h às 20h<br/>Domingo: 8h às 12h</p></div>
      </div>
      <div className="visit-info-item">
        <CalendarDays size={21} aria-hidden="true"/>
        <div><h3>Como funciona</h3><p>Atendimento somente com agendamento, um carro por vez. Confirme seu horário antes de levar o veículo.</p></div>
      </div>
    </div>
  </section>;
}

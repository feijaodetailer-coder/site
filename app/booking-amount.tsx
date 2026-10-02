"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BookingAmount({id,amount,onSave}:{id:number;amount:number;onSave:(id:number,amount:string)=>Promise<void>}){
  const [open,setOpen]=useState(false),[value,setValue]=useState((amount/100).toFixed(2));
  return <><Button size="sm" variant="outline" onClick={()=>setOpen(true)}><Pencil size={14}/> Valor</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Definir orçamento final</DialogTitle><DialogDescription>Informe o valor combinado após avaliar as condições do veículo.</DialogDescription></DialogHeader><label className="field"><span>Valor final (R$)</span><Input type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)}/></label><Button onClick={async()=>{await onSave(id,value);setOpen(false)}}>Salvar valor</Button></DialogContent></Dialog></>;
}

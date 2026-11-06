"use client";
import {useEffect,useId,useRef} from 'react';
import type {FinanzasData,Movimiento} from '@/lib/finanzas';
import DetalleFinanciero from '@/components/DetalleFinanciero';

export default function MovimientosDialog({data,rows,title,description,initialAccount,onClose,onEdit}:{data:FinanzasData;rows:Movimiento[];title:string;description:string;initialAccount?:string;onClose:()=>void;onEdit?:(account:string)=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  const node=dialog.current,previousOverflow=document.body.style.overflow;
  node?.showModal();document.body.style.overflow='hidden';
  return()=>{node?.close();document.body.style.overflow=previousOverflow;};
 },[]);
 return <dialog ref={dialog} className="fin-movements-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="fin-explorer-shell">
   <header className="fin-explorer-header"><div><p className="fin-kicker">Conciliaciones · Detalle del período</p><h3 id={titleId}>{title}</h3><p id={descriptionId}>{description}</p></div><button type="button" className="fin-explorer-close" autoFocus onClick={onClose} aria-label="Cerrar movimientos"><span aria-hidden="true">×</span> Cerrar</button></header>
   <div className="fin-explorer-body"><DetalleFinanciero data={data} rows={rows} initialAccount={initialAccount} onEdit={onEdit}/></div>
  </div>
 </dialog>;
}

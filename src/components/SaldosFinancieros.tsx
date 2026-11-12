"use client";
import {useEffect,useMemo,useState} from 'react';
import {apiPost} from '@/lib/api';
import {accountMonths,bankName,accountKind,balancePreview,numericBalance,type BalanceEdit} from '@/lib/business';
import {mesesFin,montoFin,type FinanzasData} from '@/lib/finanzas';
import {AccountNumberChip,BankBadge} from '@/components/BankAccounts';
import MovimientosDialog from '@/components/MovimientosDialog';
import Desplegable from '@/components/Desplegable';
type Preview=ReturnType<typeof balancePreview>;
export default function SaldosFinancieros({data,token,usuario,configured,onData,onMovimientos}:{data:FinanzasData;token?:string;usuario:string;configured:boolean;onData:(d:FinanzasData)=>void;onMovimientos?:(account:string,period:string)=>void}) {
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Caracas'});
 const [seleccion,setSeleccion]=useState<string[]>(()=>data.cuentas.map(c=>c.Cuenta)),[year,setYear]=useState(today.slice(0,4));
 const [detail,setDetail]=useState('');
 const [period,setPeriod]=useState(''),[value,setValue]=useState(''),[official,setOfficial]=useState(''),[reason,setReason]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const cuentas=data.cuentas.filter(c=>seleccion.includes(c.Cuenta));
 const cuentaUnica=cuentas.length===1?cuentas[0].Cuenta:'';
 const months=useMemo(()=>cuentaUnica?accountMonths(data,cuentaUnica,today):[],[data,cuentaUnica,today]);
 const monthsMulti=useMemo(()=>!cuentaUnica&&cuentas.length?mesesFin(data,cuentas.map(c=>c.Cuenta),today):[],[data,cuentas,cuentaUnica,today]);
 const cotejoMulti=useMemo(()=>{
  if(cuentaUnica||!cuentas.length)return new Map<string,{discrepancias:number;cotejadas:number;total:number}>();
  const mapa=new Map<string,{discrepancias:number;cotejadas:number;total:number}>();
  cuentas.forEach(c=>accountMonths(data,c.Cuenta,today).forEach(m=>{
   const item=mapa.get(m.periodo)||{discrepancias:0,cotejadas:0,total:0};
   item.total+=1;if(m.oficial!==null)item.cotejadas+=1;if(m.discrepancia)item.discrepancias+=1;
   mapa.set(m.periodo,item);
  }));
  return mapa;
 },[data,cuentas,cuentaUnica,today]);
 useEffect(()=>{const validas=seleccion.filter(id=>data.cuentas.some(c=>c.Cuenta===id));if(validas.length!==seleccion.length){setSeleccion(validas.length?validas:data.cuentas.map(c=>c.Cuenta));setPeriod('');setDetail('');setPreview(null);}},[data.cuentas,seleccion]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&period)setPeriod('');};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[period]);
 const fuente=cuentaUnica?months:monthsMulti;
 const displayed=Array.from({length:12},(_,i)=>{const p=year+'-'+String(i+1).padStart(2,'0');return {p,row:fuente.find(m=>m.periodo===p)};});
 const fmt=(n:number|null|undefined)=>n==null?'Pendiente':montoFin(n);
 function toggle(id:string){
  setPeriod('');setDetail('');setPreview(null);
  setSeleccion(prev=>{
   if(prev.includes(id))return prev.filter(x=>x!==id).length?prev.filter(x=>x!==id):prev;
   return [...prev,id];
  });
 }
 const conDatos=displayed.filter(({row})=>row);
 const totales=useMemo(()=>{
  if(!conDatos.length)return null;
  const sum=(k:'entradas'|'salidas'|'transferenciasEntrada'|'transferenciasSalida')=>conDatos.reduce((s,{row})=>s+(row?.[k]||0),0);
  return {entradas:sum('entradas'),salidas:sum('salidas'),transferenciasEntrada:sum('transferenciasEntrada'),transferenciasSalida:sum('transferenciasSalida'),
   inicial:conDatos[0].row?.inicial??null,final:conDatos[conDatos.length-1].row?.final??null,
   neto:sum('entradas')-sum('salidas')};
 },[conDatos]);
 async function inspect(){setBusy(true);setError('');try{if(configured){const r=await apiPost({action:'fin_saldo',token,cuenta:cuentaUnica,periodo:period,valor:value,oficial:official,motivo:reason});if(!r.ok)throw Error(r.msg);setPreview(r.preview);}else setPreview(balancePreview(data,cuentaUnica,period,value,official,today,reason));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function save(){if(!preview||busy)return;if(!window.confirm(`Se recalcularán ${preview.afectados.length} meses de esta cuenta, de ${period} hasta ${today.slice(0,7)}. ¿Confirmar cambio en cascada?`))return;setBusy(true);setError('');try{if(configured){const r=await apiPost({action:'fin_saldo',token,cuenta:cuentaUnica,periodo:period,valor:value,oficial:official,motivo:reason,revision:preview.revision,meses:preview.afectados.length,confirmar:true});if(!r.ok)throw Error(r.msg);onData(r.data);}else{const edit:BalanceEdit={...preview.edit,ID:crypto.randomUUID(),Usuario:usuario,Fecha:new Date().toISOString()};const updated={...data,ajustes:[...(data.ajustes||[]),edit]};localStorage.setItem('cs_demo_finanzas',JSON.stringify(updated));onData(updated);}setPeriod('');setPreview(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card"><h3>Saldos por cuenta · vista anual</h3><p>La corrección de un mes arrastra todos los siguientes hasta el actual, solo para esta cuenta. Los documentos ya emitidos conservan su versión.</p>
 <div className="account-picker" aria-label="Cuentas incluidas en la conciliación">
  <button type="button" className={"account-chip all"+(seleccion.length===data.cuentas.length?" on":"")} onClick={()=>{setPeriod('');setDetail('');setPreview(null);setSeleccion(data.cuentas.map(c=>c.Cuenta));}}>Todos los bancos ({data.cuentas.length})</button>
  <AccountOptionsChips cuentas={data.cuentas} seleccion={seleccion} onToggle={toggle}/>
 </div>
 <div className="fin-report-actions"><label>Año<input type="number" min="1900" max={today.slice(0,4)} value={year} onChange={e=>setYear(e.target.value)}/></label>{cuentaUnica?<AccountNumberChip account={cuentas[0]}/>:<span className="acct-number empty">{cuentas.length} cuentas seleccionadas · totales consolidados</span>}</div>
 {cuentaUnica&&<BankBadge key={cuentaUnica} account={cuentas[0]}/>}
 <div className="fin-scroll"><table>
  <thead><tr><th>Mes</th><th>Saldo inicial Bs</th><th>Ingresos Bs</th><th>Egresos Bs</th><th>Transferencias recibidas Bs</th><th>Transferencias enviadas Bs</th><th>Saldo final Bs</th><th>Cotejo oficial</th><th>Detalle</th></tr></thead>
  <tbody>{displayed.map(({p,row})=>{const cotejo=cotejoMulti.get(p);const mesUnico=cuentaUnica&&row&&'discrepancia' in row?row:undefined;const claseDiscrepancia=mesUnico?mesUnico.discrepancia:(cotejo?.discrepancias||0)>0;return <tr key={p} className={claseDiscrepancia?'fin-discrepancy':''}><td>{p}</td>
   <td>{mesUnico?<button onClick={()=>{setPeriod(p);setValue(mesUnico.inicial==null?'':String(mesUnico.inicial));setOfficial(mesUnico.oficial==null?'':String(mesUnico.oficial));setReason('');setPreview(null);setError('');}}>{fmt(mesUnico.inicial)} ✎</button>:row?<span>{fmt(row.inicial)}</span>:<span className="fin-off-period">Fuera del período</span>}</td>
   <td>{fmt(row?.entradas)}</td><td>{fmt(row?.salidas)}</td><td>{fmt(row?.transferenciasEntrada)}</td><td>{fmt(row?.transferenciasSalida)}</td><td>{fmt(row?.final)}</td>
   <td>{!row?'—':mesUnico?(mesUnico.discrepancia?'Discrepancia':mesUnico.oficial==null?'Sin saldo oficial para cotejar':'Coincide'):((cotejo?.discrepancias||0)>0?`${cotejo!.discrepancias} con discrepancia de ${cotejo!.total}`:(cotejo?.cotejadas||0)>0?`Coincide (${cotejo!.cotejadas} cotejadas)`:'Sin cotejo')}</td>
   <td>{row?<button aria-haspopup="dialog" onClick={()=>setDetail(p)}>Ver movimientos</button>:<span className="fin-off-period">—</span>}</td></tr>;})}</tbody>
  {totales&&<tfoot><tr className="fin-totals"><td><b>Totales {year}</b></td><td>{fmt(totales.inicial)}</td><td><b>{montoFin(totales.entradas)}</b></td><td><b>{montoFin(totales.salidas)}</b></td><td>{montoFin(totales.transferenciasEntrada)}</td><td>{montoFin(totales.transferenciasSalida)}</td><td>{fmt(totales.final)}</td><td colSpan={2}>Neto ingresos − egresos: <b>{montoFin(totales.neto)}</b></td></tr></tfoot>}
 </table></div>
 {detail&&<MovimientosDialog key={seleccion.join('|')+detail} data={data} title={new Date(detail+'-02T12:00:00').toLocaleDateString('es-VE',{month:'long',year:'numeric'})} description="Movimientos del mes seleccionado. Puedes cambiar de cuenta o combinar filtros sin salir de esta ventana." initialAccount={cuentaUnica} rows={data.movimientos.filter(r=>seleccion.includes(r.Cuenta)&&r.Fecha.startsWith(detail)&&r.Fecha<=today)} onClose={()=>setDetail('')} onEdit={onMovimientos?(selected)=>{setDetail('');onMovimientos(selected,detail);}:undefined}/>} <Desplegable className="fin-collapsible" id="historial-ajustes" summary="Historial de correcciones"><div className="fin-collapsible-body">{(data.ajustes||[]).filter(a=>seleccion.includes(String(a.Cuenta))).length?(data.ajustes||[]).filter(a=>seleccion.includes(String(a.Cuenta))).map(a=><p key={a.ID}>{a.Fecha} · {a.Usuario} · {a.Cuenta} → Bs {montoFin(a.Valor)} · {a.Motivo||'Sin motivo'}</p>):<p>Sin correcciones registradas para {cuentas.length===1?'esta cuenta':'las cuentas seleccionadas'}.</p>}</div></Desplegable>
 {period&&<div className="overlay open" onMouseDown={(e)=>{if(e.target===e.currentTarget)setPeriod('');}}><div className="modal wide" role="dialog" aria-modal="true" aria-label="Corregir saldo inicial"><button type="button" className="modal-close" aria-label="Cerrar" onClick={()=>setPeriod('')}>×</button><h3>Saldo inicial · {period}</h3><p>{bankName(cuentas[0])} · {accountKind(cuentas[0])}</p><p>Valor actual: Bs {fmt(months.find(m=>m.periodo===period)?.inicial)}</p><div className="grid2"><label>Nuevo saldo Bs<input type="number" step="0.000001" required value={value} onChange={e=>{setValue(e.target.value);setPreview(null);}}/></label><label>Saldo inicial del registro oficial (opcional)<input type="number" step="0.000001" value={official} onChange={e=>{setOfficial(e.target.value);setPreview(null);}}/></label><label>Motivo (opcional)<input value={reason} onChange={e=>{setReason(e.target.value);setPreview(null);}}/></label></div>{official!==''&&numericBalance(official)!==numericBalance(value)&&<p className="fin-notice">El valor sigue sin coincidir con el registro oficial. Puedes continuar y dejar constancia.</p>}{official===''&&<p className="fin-notice">No hay saldo oficial informado para comprobar si cuadra.</p>}{error&&<p role="alert">{error}</p>}{preview&&<><h4>Se recalcularán {preview.afectados.length} meses</h4>{preview.reemplazados>0&&<p className="fin-notice">El nuevo arrastre sustituye {preview.reemplazados} corrección(es) desde este mes. Su historial se conserva.</p>}<div className="fin-scroll"><table><thead><tr><th>Mes</th><th>Nuevo inicial</th><th>Nuevo final</th></tr></thead><tbody>{preview.afectados.map(m=><tr key={m.periodo}><td>{m.periodo}</td><td>{fmt(m.inicial)}</td><td>{fmt(m.final)}</td></tr>)}</tbody></table></div></>}<div className="modal-actions"><button className="btn ghost" disabled={busy} onClick={()=>setPeriod('')}>Cancelar</button><button className="btn" disabled={busy||numericBalance(value)===null} onClick={preview?save:inspect}>{busy?'Procesando…':preview?'Confirmar cambio en cascada':'Ver impacto'}</button></div></div></div>}
 </section>;
}
function AccountOptionsChips({cuentas,seleccion,onToggle}:{cuentas:FinanzasData['cuentas'];seleccion:string[];onToggle:(id:string)=>void}){
 return <>{(['Personal','Jurídico'] as const).map(kind=><span key={kind} className="account-chip-group">{cuentas.filter(c=>accountKind(c)===kind).map(c=><button key={c.Cuenta} type="button" className={"account-chip"+(seleccion.includes(c.Cuenta)?" on":"")} title={c.Numero?`N° ${c.Numero}`:bankName(c)} onClick={()=>onToggle(c.Cuenta)}>{bankName(c)}</button>)}</span>)}</>;
}

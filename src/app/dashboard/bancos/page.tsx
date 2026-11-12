"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/lib/auth';
import {apiPost,isConfigured,hasConnectionOverride,setUrl} from '@/lib/api';
import {accountKind,bankName,emptyFinance,withFinanceCategories,bankSavePlan,numericBalance,bankForDeletion,normalizedText} from '@/lib/business';
import {saveBankLocally,deleteBankLocally,bankOperationMessage} from '@/lib/bank-accounts';
import {montoFin,type CuentaFin,type FinanzasData} from '@/lib/finanzas';
import BankLogoInput from '@/components/BankLogoInput';
import {AccountNumberChip,BankBadge} from '@/components/BankAccounts';
import '../finanzas/finanzas.css';
const banks=['Banco de Venezuela','Banco Nacional de Crédito','Banco Mercantil','Banplus','Banco Provincial','Banco Activo','Banco del Tesoro'];
const blank=():CuentaFin=>({Cuenta:'',Banco:'',Titularidad:'Personal',Moneda:'Bs',Numero:'',SaldoInicial:0,FechaSaldoInicial:'2026-01-01',Logo:''});
function ConnectionHelp({override,onUseDefault}:{override:boolean;onUseDefault:()=>void}){
 return <div className="bank-connection-help"><Link href="/dashboard/configuracion" className="fin-link-action">Revisar conexión en Configuración</Link>{override&&<><p>Este navegador tiene una conexión personalizada. Volver a la principal descarta los cambios del formulario sin guardar.</p><button type="button" onClick={onUseDefault}>Usar conexión principal de la aplicación</button></>}</div>;
}
export default function Bancos(){
 const {user}=useAuth();
 const [data,setData]=useState<FinanzasData|null>(null),[edit,setEdit]=useState<CuentaFin|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[logoBusy,setLogoBusy]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const configured=isConfigured(),override=hasConnectionOverride(),canDelete=!configured||Number(data?.bancosVersion)>=2,canNumero=!configured||Number(data?.bancosVersion)>=3;
 const connectionError=/CONEXION|ACCION|BACKEND|CONTACTAR|SESION/.test(normalizedText(error));
 useEffect(()=>{let active=true;setLoading(true);setError('');(async()=>{try{
  let next:FinanzasData;
  if(isConfigured()){const r=await apiPost({action:'fin_list',token:user?.token});if(!r.ok)throw Error(r.msg||'No se pudieron cargar los bancos.');next=r as unknown as FinanzasData;}
  else{const raw=localStorage.getItem('cs_demo_finanzas');next=raw?withFinanceCategories(JSON.parse(raw)):emptyFinance();localStorage.setItem('cs_demo_finanzas',JSON.stringify(next));}
  if(active)setData(next);
 }catch(e){if(active)setError(bankOperationMessage((e as Error).message));}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[user?.token,refresh]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&edit)setEdit(null);};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[edit]);
 function useDefault(){setEdit(null);setUrl('');window.location.reload();}
 async function save(e:React.FormEvent){
  e.preventDefault();if(!edit||!data||busy||logoBusy)return;setBusy(true);setError('');setMessage('');
  try{
   const operation=edit.Cuenta?'editar':'crear',plan=bankSavePlan(edit,data.cuentas,operation);let next:FinanzasData;
   if(configured){const r=await apiPost({action:'fin_cuenta',operacion:operation,token:user?.token,data:plan.row});if(!r.ok)throw Error(r.msg||'No se pudo guardar el banco.');next=r.data;}
   else{next=saveBankLocally(data,plan.row,operation,'CTA-'+crypto.randomUUID(),user?.usuario||'');localStorage.setItem('cs_demo_finanzas',JSON.stringify(next));}
   setData(next);setEdit(null);setMessage(operation==='editar'?'Cambios guardados en el banco existente.':'Banco registrado.');
  }catch(e){setError(bankOperationMessage((e as Error).message));}finally{setBusy(false);}
 }
 async function remove(account:CuentaFin){
  if(!data||busy||edit)return;setError('');setMessage('');
  try{
   bankForDeletion(data,account.Cuenta);
   if(!window.confirm('¿Eliminar '+bankName(account)+' · '+accountKind(account)+'?\nSaldo base: Bs '+(numericBalance(account.SaldoInicial)===null?'pendiente':montoFin(Number(account.SaldoInicial)))+'.\nNo tiene movimientos. Se quitará de los bancos disponibles; los reportes ya emitidos se conservan.'))return;
   setBusy(true);let next:FinanzasData;
   if(configured){const r=await apiPost({action:'fin_cuenta_eliminar',token:user?.token,cuenta:account.Cuenta});if(!r.ok)throw Error(r.msg||'No se pudo eliminar el banco.');next=r.data;}
   else{next=deleteBankLocally(data,account.Cuenta);localStorage.setItem('cs_demo_finanzas',JSON.stringify(next));}
   setData(next);setMessage('Banco eliminado.');
  }catch(e){setError(bankOperationMessage((e as Error).message));}finally{setBusy(false);}
 }
 return <div className="finance">
  <div className="fin-heading"><div><p className="fin-kicker">Administración de cuentas bancarias</p><h3>Bancos y cuentas</h3><p>Registra aquí los bancos que utilizarás en Finanzas y Conciliaciones.</p></div><div className="bank-card-actions"><button disabled={loading||busy||!!edit} onClick={()=>setRefresh(n=>n+1)}>Actualizar</button><button className="btn" disabled={!data||busy||!!edit} onClick={()=>{setError('');setMessage('');setEdit(blank());}}>+ Registrar banco</button></div></div>
  {error&&<div role="alert" className="fin-notice">{error}{connectionError&&<ConnectionHelp override={override} onUseDefault={useDefault}/>}</div>}
  {message&&<p role="status" className="logo-input-message">{message}</p>}{loading&&<p role="status">Cargando bancos…</p>}
  {data&&configured&&!canDelete&&<div className="fin-notice"><p>Para habilitar la eliminación, actualiza y publica la nueva versión de Apps Script y pulsa «Actualizar».</p><ConnectionHelp override={override} onUseDefault={useDefault}/></div>}
  {data&&configured&&!canNumero&&<div className="fin-notice"><p>El número de cuenta es obligatorio, pero esta conexión usa una versión de Apps Script que no lo guarda. Actualiza y publica la nueva versión de Apps Script, pulsa «Actualizar» y registra los números.</p><ConnectionHelp override={override} onUseDefault={useDefault}/></div>}
  {data&&(['Personal','Jurídico'] as const).map(kind=><section key={kind} className="card"><h3>{kind==='Personal'?'Cuentas personales':'Cuentas jurídicas'}</h3><div className="bank-grid">{data.cuentas.filter(c=>accountKind(c)===kind).map(c=>{const count=data.movimientos.filter(r=>r.Cuenta===c.Cuenta).length;return <div key={c.Cuenta} className="bank-card"><BankBadge account={c}/><AccountNumberChip account={c}/><p>Saldo base: <b>Bs {numericBalance(c.SaldoInicial)===null?'Pendiente':montoFin(Number(c.SaldoInicial))}</b></p><p>Desde {c.FechaSaldoInicial}</p><div className="bank-card-actions"><button disabled={busy||!!edit} onClick={()=>{setError('');setMessage('');setEdit({...c});}}>Editar banco y saldo base</button><button className="bank-delete-button" disabled={busy||!!edit||!canDelete||count>0} title={count?'Tiene movimientos vinculados':!canDelete?'Requiere actualizar Apps Script':'Eliminar banco'} onClick={()=>void remove(c)}>Eliminar banco</button></div>{count>0&&<small>Conserva {count} movimiento(s); no se puede eliminar.</small>}</div>;})}</div>{!data.cuentas.some(c=>accountKind(c)===kind)&&<p>No hay bancos registrados.</p>}</section>)}
  {edit&&<div className="overlay open" onMouseDown={(e)=>{if(e.target===e.currentTarget)setEdit(null);}}><form className="modal wide" role="dialog" aria-modal="true" aria-labelledby="bank-edit-title" onSubmit={save}><button type="button" className="modal-close" aria-label="Cerrar" onClick={()=>setEdit(null)}>×</button><h3 id="bank-edit-title">{edit.Cuenta?'Editar banco':'Registrar banco'}</h3><div className="grid2"><label>Titularidad<select disabled={busy} value={accountKind(edit)} onChange={e=>setEdit({...edit,Titularidad:e.target.value})}><option>Personal</option><option>Jurídico</option></select></label><label>Nombre completo del banco<input list="bank-names" required disabled={busy} value={edit.Banco} onChange={e=>setEdit({...edit,Banco:e.target.value})}/><datalist id="bank-names">{banks.map(b=><option key={b} value={b}/>)}</datalist></label><label>Número de cuenta<input required inputMode="numeric" placeholder="0000-0000-0000-0000-0000" disabled={busy} value={edit.Numero||''} onChange={e=>setEdit({...edit,Numero:e.target.value})}/></label><label>Saldo base Bs<input type="number" step="0.000001" required disabled={busy} value={edit.SaldoInicial} onChange={e=>setEdit({...edit,SaldoInicial:e.target.value})}/></label><label>Fecha de saldo base<input type="date" min="2026-01-01" required disabled={busy} value={edit.FechaSaldoInicial} onChange={e=>setEdit({...edit,FechaSaldoInicial:e.target.value})}/><small>Utiliza el primer día del mes.</small></label><div className="bank-logo-field"><span className="bank-field-label">Logo del banco</span><BankLogoInput bank={edit.Banco} value={edit.Logo||''} onChange={logo=>setEdit(c=>c?{...c,Logo:logo}:c)} onBusyChange={setLogoBusy} disabled={busy}/></div><BankBadge key={edit.Logo} account={edit}/></div>{edit.Logo&&<button type="button" disabled={busy||logoBusy} onClick={()=>setEdit({...edit,Logo:''})}>Quitar logo</button>}<p>{edit.Cuenta?'Se actualizará este banco sin crear otro registro. ':''}Modificar el saldo base recalcula los meses siguientes de esta cuenta.</p>{error&&<div role="alert" className="fin-notice">{error}<ConnectionHelp override={override} onUseDefault={useDefault}/></div>}<div className="modal-actions"><button type="button" className="btn ghost" disabled={busy} onClick={()=>setEdit(null)}>Cancelar</button><button className="btn" disabled={busy||logoBusy}>{busy?'Guardando…':edit.Cuenta?'Guardar cambios':'Registrar banco'}</button></div></form></div>}
 </div>;
}

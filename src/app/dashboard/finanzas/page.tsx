"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Ic, Icons } from "@/components/icons";
import { apiPost, isConfigured } from "@/lib/api";
import { FIN_DEMO, flujos, mesesFin, montoFin, saldoBase, redondearFin, finMes, semanasFin, inicioSemana, moverFecha, etiquetaSemana, fechaLegible, type FinanzasData, type Movimiento } from "@/lib/finanzas";
import ReportesFinancieros from "@/components/ReportesFinancieros";
import Link from 'next/link';
import {AccountOptions,BankBadge} from '@/components/BankAccounts';
import {withFinanceCategories,emptyFinance,isOwnTransfer,validateMovementCategory} from '@/lib/business';
import SaldosFinancieros from "@/components/SaldosFinancieros";
import {PAYMENT_METHODS,paymentMethod,methodTotals,accountKind,bankName,incompleteMovement,accountBalance} from "@/lib/business";
import CalendarioFinanciero from "@/components/CalendarioFinanciero";
import FinanzasSkeleton from "@/components/FinanzasSkeleton";
import "./finanzas.css";

const blank = (): Movimiento => ({ ID:"", Fecha:new Date().toLocaleDateString("sv-SE",{timeZone:"America/Caracas"}), Cuenta:"", Tipo:"SALIDA", Monto:0, Referencia:"", Concepto:"", Contraparte:"", Metodo:"TRANSFERENCIA", Factura:"", Codigo:"", Conciliado:"Pendiente", Origen:"WebApp", Fuente:"Registro manual", Revision:"", TraspasoID:"", Actualizado:"" });
const nombreMes = (p:string) => new Date(p+"-02T12:00:00").toLocaleDateString("es-VE", {month:"long",year:"numeric"});
export default function Finanzas() {
  const { user, logout } = useAuth(); const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [data,setData] = useState<FinanzasData|null>(null), [error,setError] = useState(""), [loading,setLoading] = useState(true);
  const [desde,setDesde] = useState("2026-08-01"), [hasta,setHasta] = useState("2026-08-31");
  const [vista,setVista] = useState<"mes"|"semana"|"rango">("mes"), [mes,setMes] = useState("2026-08"), [semana,setSemana] = useState("2026-08-01");
  const [panel,setPanel] = useState<"consulta"|"gerencia">("consulta");
  const [cuenta,setCuenta] = useState(""), [titular,setTitular] = useState(""), [codigo,setCodigo] = useState(""), [tipo,setTipo] = useState(""), [q,setQ] = useState("");
  const [metodo,setMetodo]=useState("");
  const [pagina,setPagina] = useState(1), [orden,setOrden] = useState<"Fecha"|"Codigo">("Fecha");
  const [edit,setEdit] = useState<Movimiento|null>(null), [saving,setSaving] = useState(false), [formError,setFormError] = useState("");
  const configured = isConfigured();
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("panel")==="gerencia")setPanel("gerencia");},[]);
  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!isConfigured()) { const raw=localStorage.getItem("cs_demo_finanzas"); const updated=raw?withFinanceCategories(JSON.parse(raw)):emptyFinance();setData(updated);localStorage.setItem('cs_demo_finanzas',JSON.stringify(updated)); }
      else {
        if(!user?.token) throw new Error("Vuelve a iniciar sesión para activar el acceso a Finanzas.");
        const r=await apiPost({action:"fin_list",token:user.token});
        if(!r.ok) throw new Error(r.msg||"No se pudo cargar Finanzas");
        setData({movimientos:r.movimientos,cuentas:r.cuentas,categorias:r.categorias,control:r.control,ajustes:r.ajustes||[]});
      }
    } catch(e) { setError((e as Error).message); } finally { setLoading(false); }
  },[user?.token]);
  useEffect(()=>{cargar();},[cargar]);
  useEffect(()=>{setPagina(1);},[desde,hasta,cuenta,titular,codigo,tipo,q,orden,metodo]);
  const cuentas=useMemo(()=>data?.cuentas.filter(c=>(!cuenta||c.Cuenta===cuenta)&&(!titular||accountKind(c)===titular)).map(c=>c.Cuenta)||[],[data,cuenta,titular]);
  const base=useMemo(()=>data?.movimientos.filter(r=>cuentas.includes(r.Cuenta))||[],[data,cuentas]);
  const filtrados=useMemo(()=>base.filter(r=>(!metodo||paymentMethod(r.Metodo)===metodo)&&(!tipo||r.Tipo===tipo)&&(!codigo||(codigo==="pendiente"?!r.Codigo:r.Codigo===codigo))&&(!q||[r.Fecha,r.Referencia,r.Concepto,r.Contraparte,r.Codigo,r.Factura,r.Metodo].join(" ").toLocaleLowerCase().includes(q.toLocaleLowerCase()))),[base,tipo,codigo,q,metodo]);
  const rows=useMemo(()=>filtrados.filter(r=>r.Fecha>=desde&&r.Fecha<=hasta).sort((a,b)=>String(a[orden]).localeCompare(String(b[orden]))||a.ID.localeCompare(b.ID)),[filtrados,desde,hasta,orden]);
  const flow=flujos(rows), pendientes=rows.filter(r=>!r.Codigo).length;
  const inicial=data?saldoBase(data,cuentas):null;
  const acumulado=flujos(base.filter(r=>data&&r.Fecha>=String(data.control.FechaSaldoInicial)&&r.Fecha<=hasta));
  const balances=data?cuentas.map(c=>accountBalance(data,c,hasta)):[];
  const saldo=balances.length&&!balances.some(b=>b===null)?redondearFin(balances.reduce<number>((s,b)=>s+(b||0),0)):null;
  const ultimo=base.filter(r=>r.Fecha<=hasta).reduce((d,r)=>r.Fecha>d?r.Fecha:d,"");
  const meses=useMemo(()=>data?mesesFin(data,cuentas,hasta):[],[data,cuentas,hasta]);
  const gastos=useMemo(()=>{
    const m=new Map<string,number>(); rows.filter(r=>r.Tipo==="SALIDA"&&!isOwnTransfer(r)).forEach(r=>m.set(r.Codigo||"pendiente",redondearFin((m.get(r.Codigo||"pendiente")||0)+Number(r.Monto))));
    return [...m].sort((a,b)=>b[1]-a[1]);
  },[rows]);
  const catNombre=(code:string)=>code==="pendiente"||!code?"Sin clasificar":data?.categorias.find(c=>c.Codigo===code)?.Nombre||code;
  const semanas=useMemo(()=>semanasFin(desde,hasta,rows),[desde,hasta,rows]);
  const opcionesSemana=useMemo(()=>mes?semanasFin(mes+"-01",finMes(mes)):[],[mes]);
  function elegirSemana(inicio:string) { setVista("semana");setSemana(inicio);if(inicio>finMes(mes)||moverFecha(inicio,6)<mes+"-01")setMes(moverFecha(inicio,3).slice(0,7));setDesde(inicio);setHasta(moverFecha(inicio,6)); }
  function elegirMes(p:string) { if(!p)return;setVista("mes");setMes(p);setDesde(p+"-01");setHasta(finMes(p)); }
  const mesCalendario = vista==="mes" ? mes : (vista==="semana" ? moverFecha(desde,3) : desde).slice(0,7);
  function navegarCalendario(delta:number) {
    if(vista==="semana") elegirSemana(moverFecha(desde,delta*7));
    else { const [y,m]=mesCalendario.split("-").map(Number);elegirMes(new Date(Date.UTC(y,m-1+delta,1,12)).toISOString().slice(0,7)); }
  }
  function elegirDia(fecha:string) {setVista("rango");setDesde(fecha);setHasta(fecha);setMes(fecha.slice(0,7));setSemana(inicioSemana(fecha));}
  function limpiarDetalle() { setCuenta("");setTitular("");setCodigo("");setTipo("");setQ("");setMetodo(""); }
  const paginas=Math.max(1,Math.ceil(rows.length/50)); const actual=Math.min(pagina,paginas);
  async function guardar(e:React.FormEvent) {
    e.preventDefault(); if(!edit||!data||saving)return; setSaving(true);setFormError("");
    try {
      if(configured) {
        let r=await apiPost({action:"fin_save",token:user?.token,data:edit});
        if(r.duplicado&&window.confirm(r.msg+" ¿Guardar de todos modos?")) r=await apiPost({action:"fin_save",token:user?.token,data:edit,permitirDuplicado:true});
        if(!r.ok) throw new Error(r.msg||"No se pudo guardar");
        await cargar();
      } else {
        const row={...edit,ID:edit.ID||"demo-"+crypto.randomUUID(),Actualizado:new Date().toISOString()};
        const updated={...data,movimientos:[...data.movimientos.filter(r=>r.ID!==row.ID),row]};
        setData(updated);localStorage.setItem("cs_demo_finanzas",JSON.stringify(updated));
      }
      setEdit(null);
    } catch(e) {setFormError((e as Error).message);} finally {setSaving(false);}
  }
  if(loading&&!data)return <FinanzasSkeleton/>;
  if(!data)return <div className="card"><h3>Acceso a Finanzas</h3><p role="alert">{error}</p><button className="btn" onClick={()=>{logout();router.push("/");}}>Volver a iniciar sesión</button><button className="btn ghost" onClick={cargar}>Reintentar</button></div>;
  const historico=false;
  function campo(k:keyof Movimiento,label:string,kind="text",required=false){return <label>{label}<input type={kind} value={String(edit?.[k]??"")} required={required} step={kind==="number"?"0.000001":undefined} min={kind==="number"?"0.000001":undefined} disabled={!!historico} onChange={e=>setEdit(edit?{...edit,[k]:kind==="number"?Number(e.target.value):e.target.value}:null)}/></label>;}
  return <div className="finance" aria-busy={loading}>
    <div className="fin-heading"><div><p className="fin-kicker">Control financiero administrativo</p><h3>¿Cuánto salió y en qué se usó?</h3><p>Consulta por semana, mes o fechas · Importes en bolívares.</p></div><button className="btn" disabled={!data.cuentas.length} onClick={()=>{setFormError("");setEdit({...blank(),Cuenta:data.cuentas[0]?.Cuenta||""});}}>+ Nuevo movimiento</button></div>
    {!configured&&<p className="fin-notice">Demostración: estos movimientos son ficticios y se guardan solo en este navegador.</p>}
    {error&&<p role="alert" className="fin-notice">{error} <button onClick={cargar}>Reintentar</button></p>}
    {loading&&<div className="fin-refresh" role="status"><span className="fin-refresh-bar"/><span>Actualizando datos financieros…</span></div>}
    <div className="fin-control-row">
      <div className="fin-tabs" aria-label="Sección financiera"><button aria-pressed={panel==="consulta"} onClick={()=>setPanel("consulta")}>Consultar movimientos</button><button aria-pressed={panel==="gerencia"} onClick={()=>setPanel("gerencia")}>Conciliaciones · Saldos y reportes</button></div>
      <Link href="/dashboard/bancos" className="fin-link-action"><Ic d={Icons.wallet}/><span>{data.cuentas.length?"Administrar bancos y cuentas":"Registra tu primer banco para comenzar"}</span></Link>
    </div>
    {panel==="gerencia"?<m.div key="gerencia" className="fin-panel-content" initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.2,ease:"easeOut"}}><SaldosFinancieros onMovimientos={(account,period)=>{limpiarDetalle();setCuenta(account);elegirMes(period);setPanel('consulta');}} data={data} token={user?.token} usuario={user?.nombre||user?.usuario||"Administrador"} configured={configured} onData={setData}/><ReportesFinancieros data={data} token={user?.token} usuario={user?.nombre||user?.usuario||"Administrador"} configured={configured}/></m.div>:<m.div key="consulta" className="fin-panel-content" initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.2,ease:"easeOut"}}>
    <section className="card fin-filters" aria-label="Filtros financieros">
      <div className="fin-period-choice"><span>1. Elige el período</span><div className="fin-tabs">{([['mes','Ver por mes'],['semana','Ver por semana'],['rango','Elegir fechas']] as const).map(([v,label])=><button key={v} aria-pressed={vista===v} onClick={()=>{if(v==='mes')elegirMes(mes);else if(v==='semana')elegirSemana(inicioSemana(desde));else setVista('rango');}}>{label}</button>)}</div></div>
      {vista!=="rango"&&<label>Mes<input type="text" value={nombreMes(mes)} readOnly title="Usa las flechas del calendario para cambiar de mes"/></label>}
      {vista==="semana"&&<label>Semana empresarial · sábado a viernes<select value={semana} onChange={e=>{const s=e.target.value;setSemana(s);setDesde(s);setHasta(moverFecha(s,6));}}>{opcionesSemana.map(s=><option key={s.inicio} value={s.inicio}>{etiquetaSemana(s.inicio)} · {fechaLegible(s.inicio)} al {fechaLegible(s.fin)}</option>)}</select></label>}
      {vista==="rango"&&<><label>Desde<input type="date" value={desde} max={hasta} onChange={e=>{if(e.target.value)setDesde(e.target.value);}}/></label><label>Hasta<input type="date" value={hasta} min={desde} onChange={e=>{if(e.target.value)setHasta(e.target.value);}}/></label></>}
      <label>Cuenta<select value={cuenta} onChange={e=>setCuenta(e.target.value)}><option value="">Todas las cuentas</option><AccountOptions accounts={data.cuentas.filter(c=>!titular||accountKind(c)===titular)}/></select></label>
      <label>Titularidad<select value={titular} onChange={e=>{setTitular(e.target.value);setCuenta("");}}><option value="">Todas</option>{[...new Set(data.cuentas.map(accountKind))].map(t=><option key={t}>{t}</option>)}</select></label>
      <div className="fin-presets">{vista==="semana"&&<><button onClick={()=>elegirSemana(moverFecha(semana,-7))}>← Semana anterior</button><button onClick={()=>elegirSemana(moverFecha(semana,7))}>Semana siguiente →</button></>}<button onClick={()=>{setVista("rango");setDesde(String(data.control.FechaSaldoInicial));setHasta(String(data.control.CorteHistorico));}}>Todo el período registrado</button><button onClick={()=>elegirMes(String(data.control.CorteHistorico).slice(0,7))}>Último mes registrado</button><button onClick={limpiarDetalle}>Limpiar filtros</button><button onClick={cargar} disabled={loading}>{loading?"Actualizando…":"Actualizar datos"}</button></div>
    </section>
    <div className="fin-period-panel"><div className="fin-selection" aria-live="polite"><div><p className="fin-kicker">Estás consultando {desde===hasta?"los movimientos de un día":vista==="semana"?etiquetaSemana(desde):vista==="mes"?nombreMes(mes):"un período personalizado"}</p><h4>{fechaLegible(desde)} al {fechaLegible(hasta)}</h4><p>{cuenta?bankName(data.cuentas.find(c=>c.Cuenta===cuenta)):"Todas las cuentas"} · {titular||"Todas las titularidades"}{codigo?" · "+catNombre(codigo):""}{tipo?" · "+tipo:""}{q?' · Búsqueda: «'+q+'»':""}</p></div><span className="fin-tag">{rows.length.toLocaleString("es-VE")} movimientos</span></div>
    <CalendarioFinanciero mes={mesCalendario} desde={desde} hasta={hasta} semanal={vista==="semana"} movimientos={filtrados} onDia={elegirDia} onNavegar={navegarCalendario} onMes={()=>elegirMes(desde.slice(0,7))} onSemana={()=>elegirSemana(inicioSemana(desde))}/>
    </div>
    <div className="cards fin-kpis">
      <div className="card-kpi fin-spent"><small>Gastos de la selección</small><strong>Bs {montoFin(flow.salidas)}</strong><p>En el período y con los filtros elegidos.</p></div>
      <div className="card-kpi"><small>Ingresos de la selección</small><strong>Bs {montoFin(flow.entradas)}</strong><p>{desde} a {hasta}</p></div>
      <div className="card-kpi fin-balance"><small>{saldo===null?"Variación acumulada":"Saldo calculado"}</small><strong>Bs {montoFin(saldo??acumulado.variacion)}</strong><p>Al {hasta} · {cuentas.length} cuenta(s)</p><p>Último registro: {ultimo||"Sin movimientos"}</p>{saldo===null&&<p>Saldo inicial por cuenta pendiente.</p>}</div>
      <div className="card-kpi"><small>Movimientos de la selección</small><strong>{rows.length.toLocaleString("es-VE")}</strong><p>{pendientes.toLocaleString("es-VE")} sin clasificar</p></div>
    </div>
    <p className="fin-note">Transferencias propias del período: recibidas Bs {montoFin(flow.transferenciasEntrada)} · enviadas Bs {montoFin(flow.transferenciasSalida)}.</p><p className="fin-note">El saldo se calcula desde el inicio del control hasta la fecha «Hasta», para las cuentas elegidas. Categoría, tipo y búsqueda filtran el análisis y el detalle. Las clasificaciones 0001 y 0002 corresponden a transferencias propias: afectan el saldo bancario y se excluyen de ingresos y gastos.</p>
    {hasta>String(data.control.CorteHistorico)&&<p className="fin-notice">El período completo registrado llega hasta {String(data.control.CorteHistorico)}. Después de ese corte solo se incluyen los movimientos que se hayan registrado; el saldo no confirma que los meses posteriores estén completos.</p>}
    <section className="card fin-week-overview"><h3>Semana por semana</h3><p>Cuánto salió en cada semana de esta selección. Pulsa una para ver sus movimientos. Las semanas en los extremos se limitan a las fechas elegidas.</p><div className="fin-week-grid">{semanas.map(s=><button key={s.inicio} className="fin-week-card" onClick={()=>{setVista("rango");setDesde(s.desde);setHasta(s.hasta);}}><span>{etiquetaSemana(s.inicio)}</span><small>{fechaLegible(s.desde)} al {fechaLegible(s.hasta)}</small><strong>Bs {montoFin(s.salidas)}</strong><span>Salidas · {s.cantidad} movimientos</span><i style={{width:`${s.salidas/Math.max(1,...semanas.map(w=>w.salidas))*100}%`}}/></button>)}</div></section>
    <section className="card"><h3>Subtotales por método de pago</h3><div className="fin-scroll"><table><thead><tr><th>Método</th><th>Ingresos Bs</th><th>Egresos Bs</th></tr></thead><tbody>{(()=>{const t=Object.entries(methodTotals(rows));return t.length?t.map(([m,t])=><tr key={m}><td>{m}</td><td>{montoFin(t.entradas)}</td><td>{montoFin(t.salidas)}</td></tr>):<tr><td colSpan={3} className="fin-empty">Sin movimientos en esta selección.</td></tr>;})()}</tbody></table></div></section>
    <section className="card"><h3>2. Encuentra en qué se usó</h3><div className="fin-detail-filters"><label>Método de pago<select value={metodo} onChange={e=>setMetodo(e.target.value)}><option value="">Todos los métodos</option>{[...PAYMENT_METHODS,"Sin indicar"].map(m=><option key={m}>{m}</option>)}</select></label><label>Categoría<select value={codigo} onChange={e=>setCodigo(e.target.value)}><option value="">Todas las categorías</option><option value="pendiente">Sin clasificar</option>{data.categorias.map(c=><option key={c.Codigo} value={c.Codigo}>{c.Codigo} · {c.Nombre}</option>)}</select></label><label>Tipo<select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Entradas y salidas</option><option value="ENTRADA">Solo entradas</option><option value="SALIDA">Solo salidas</option></select></label><label>Buscar<input placeholder="Concepto, referencia, código, contraparte…" value={q} onChange={e=>setQ(e.target.value)}/></label><label>Ordenar por<select value={orden} onChange={e=>setOrden(e.target.value as "Fecha"|"Codigo")}><option value="Fecha">Fecha</option><option value="Codigo">Código</option></select></label></div>
      <div className="fin-analysis"><h4>Salidas por categoría · Bs</h4>{gastos.length?gastos.map(([c,n])=><button key={c} className="fin-bar" onClick={()=>setCodigo(c)}><span>{c==="pendiente"?"":c+" · "}{catNombre(c)}</span><b>{montoFin(n)}</b><i style={{width:`${n/gastos[0][1]*100}%`}}/></button>):<p>Sin salidas en esta selección.</p>}{codigo&&<button onClick={()=>setCodigo("")}>Ver todas las categorías</button>}</div>
      <h3>3. Revisa los movimientos</h3><div className="fin-scroll"><table><thead><tr><th>Fecha / semana / cuenta</th><th>Concepto / referencia</th><th>Contraparte</th><th>Código / categoría</th><th>Tipo</th><th>Monto Bs</th><th>Revisión</th></tr></thead><tbody>{rows.slice((actual-1)*50,actual*50).map(r=><tr key={r.ID}><td><b>{fechaLegible(r.Fecha)}</b><small>{etiquetaSemana(r.Fecha)}</small><BankBadge account={data.cuentas.find(c=>c.Cuenta===r.Cuenta)}/>{incompleteMovement(r,data)&&<strong className="fin-notice">Datos incompletos: banco o tipo de cuenta</strong>}</td><td><b>{r.Concepto||"Sin concepto"}</b><small>Ref. {r.Referencia||"Sin referencia"}</small>{r.Factura&&<small>Factura: {r.Factura}</small>}</td><td>{r.Contraparte}<small>{paymentMethod(r.Metodo)}</small></td><td>{r.Codigo||"—"}<small>{catNombre(r.Codigo)}</small></td><td><span className={r.Tipo==="ENTRADA"?"fin-in":"fin-out"}>{r.Tipo}</span></td><td className="fin-number"><b>{montoFin(Number(r.Monto))}</b></td><td><button onClick={()=>{setFormError("");setEdit({...r,Codigo:String(r.Codigo||"")});}}>Editar movimiento</button><small>{r.Conciliado}</small></td></tr>)}</tbody></table>{!rows.length&&<div className="fin-empty"><p>No hay movimientos para esta combinación de filtros.</p><button onClick={limpiarDetalle}>Limpiar filtros de cuenta y detalle</button></div>}</div>
      <div className="fin-pagination"><span>{rows.length} movimientos · página {actual} de {paginas}</span><button disabled={actual<=1} onClick={()=>setPagina(actual-1)}>Anterior</button><button disabled={actual>=paginas} onClick={()=>setPagina(actual+1)}>Siguiente</button></div>
    </section>
    <details className="fin-collapsible fin-months"><summary>Ver continuidad de los saldos mes a mes</summary><p className="fin-note">Saldos de las cuentas elegidas, hasta la fecha final. Categoría, tipo y búsqueda no intervienen en esta tabla.</p><div className="fin-scroll"><table><thead><tr><th>Mes</th><th>Saldo inicial</th><th>Entradas</th><th>Salidas</th><th>Transferencias recibidas</th><th>Transferencias enviadas</th><th>Neto de ingresos y gastos</th><th>Saldo final</th></tr></thead><tbody>{meses.map(m=><tr key={m.periodo}><td><button onClick={()=>elegirMes(m.periodo)}>{nombreMes(m.periodo)}{m.periodo===hasta.slice(0,7)&&hasta<finMes(m.periodo)?" · parcial":""}</button></td><td>{m.inicial===null?"Pendiente":montoFin(m.inicial)}</td><td>{montoFin(m.entradas)}</td><td>{montoFin(m.salidas)}</td><td>{montoFin(m.transferenciasEntrada)}</td><td>{montoFin(m.transferenciasSalida)}</td><td>{montoFin(m.variacion)}</td><td>{m.final===null?"Pendiente":montoFin(m.final)}</td></tr>)}</tbody></table></div></details>

    </m.div>}
    {edit&&<div className="overlay open"><form className="modal wide" onSubmit={guardar}><h3>{edit.ID?"Revisar movimiento":"Nuevo movimiento"}</h3><div className="grid2">
      {campo("Fecha","Fecha","date",true)}<label>Cuenta<select disabled={!!historico} value={edit.Cuenta} onChange={e=>setEdit({...edit,Cuenta:e.target.value})}><AccountOptions accounts={data.cuentas}/></select></label>
      <label>Tipo<select disabled={!!historico} value={edit.Tipo} onChange={e=>setEdit({...edit,Tipo:e.target.value as Movimiento["Tipo"],Codigo:""})}><option>SALIDA</option><option>ENTRADA</option></select></label>{campo("Monto","Monto Bs","number",true)}{campo("Referencia","Referencia")}{campo("Concepto","Concepto","text",true)}{campo("Contraparte","Contraparte")}<label>Método de pago<select value={paymentMethod(edit.Metodo)} onChange={e=>setEdit({...edit,Metodo:e.target.value})}>{!PAYMENT_METHODS.includes(paymentMethod(edit.Metodo) as typeof PAYMENT_METHODS[number])&&<option>{paymentMethod(edit.Metodo)}</option>}{PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}</select></label>{campo("Factura","Factura")}
      <label>Categoría<select value={edit.Codigo} onChange={e=>setEdit({...edit,Codigo:e.target.value})}><option value="">Sin clasificar</option>{data.categorias.filter(c=>c.Tipo===edit.Tipo).map(c=><option key={c.Codigo} value={c.Codigo}>{c.Codigo} · {c.Nombre}</option>)}</select></label>
      <label>Conciliado<select value={edit.Conciliado} onChange={e=>setEdit({...edit,Conciliado:e.target.value})}>{historico&&!["Pendiente","Sí","No"].includes(edit.Conciliado)&&<option value={edit.Conciliado}>{edit.Conciliado||"Sin indicar"}</option>}<option>Pendiente</option><option>Sí</option><option>No</option></select></label><label>Nota de revisión<input value={edit.Revision} onChange={e=>setEdit({...edit,Revision:e.target.value})}/></label>
    </div>{formError&&<p role="alert" className="fin-notice">{formError}</p>}<div className="modal-actions"><button type="button" className="btn ghost" disabled={saving} onClick={()=>setEdit(null)}>Cancelar</button><button className="btn" disabled={saving}>{saving?"Guardando…":"Guardar movimiento"}</button></div></form></div>}
  </div>;
}

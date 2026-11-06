"use client";
import {Fragment,useMemo,useState} from 'react';
import {bankName,accountKind,expenseCategories,isOwnTransfer,paymentMethod} from '@/lib/business';
import {flujos,montoFin,fechaLegible,type FinanzasData,type Movimiento} from '@/lib/finanzas';
import {EMPTY_MOVEMENT_FILTERS,filterMovementDetail,type MovementFilters} from '@/lib/movement-detail';
import {AccountOptions} from '@/components/BankAccounts';

export default function DetalleFinanciero({data,rows,initialAccount='',onEdit}:{data:FinanzasData;rows:Movimiento[];initialAccount?:string;onEdit?:(account:string)=>void}) {
 const [filters,setFilters]=useState<MovementFilters>({...EMPTY_MOVEMENT_FILTERS,account:initialAccount});
 const [page,setPage]=useState(1),[order,setOrder]=useState('date-desc'),[expanded,setExpanded]=useState('');
 const accounts=useMemo(()=>data.cuentas.filter(c=>rows.some(r=>r.Cuenta===c.Cuenta)||c.Cuenta===initialAccount),[data.cuentas,rows,initialAccount]);
 const filtered=useMemo(()=>filterMovementDetail(data,rows,filters),[data,rows,filters]);
 const ordered=useMemo(()=>[...filtered].sort((a,b)=>order==='amount-desc'?Number(b.Monto)-Number(a.Monto)||b.Fecha.localeCompare(a.Fecha)||a.ID.localeCompare(b.ID):order==='date-asc'?a.Fecha.localeCompare(b.Fecha)||a.ID.localeCompare(b.ID):b.Fecha.localeCompare(a.Fecha)||a.ID.localeCompare(b.ID)),[filtered,order]);
 const total=flujos(filtered),expenses=expenseCategories(data,filtered),pages=Math.max(1,Math.ceil(filtered.length/50)),current=Math.min(page,pages);
 const parties=useMemo(()=>[...new Set(rows.map(r=>r.Contraparte?.trim()||'Sin contraparte'))].sort((a,b)=>a.localeCompare(b,'es')),[rows]);
 const methods=useMemo(()=>[...new Set(rows.map(r=>paymentMethod(r.Metodo)))].sort(),[rows]);
 const categories=useMemo(()=>data.categorias.filter(c=>rows.some(r=>r.Codigo===c.Codigo)).sort((a,b)=>a.Codigo.localeCompare(b.Codigo)),[data.categorias,rows]);
 const active=Object.values(filters).filter(Boolean).length;
 function change(key:keyof MovementFilters,value:string){setFilters(f=>({...f,[key]:value,...(key==='kind'?{account:''}:{})}));setPage(1);setExpanded('');}
 function clear(){setFilters({...EMPTY_MOVEMENT_FILTERS});setPage(1);setExpanded('');}
 return <div className="fin-month-detail">
  <section className="fin-explorer-filters" aria-label="Filtros de los movimientos del período">
   <label className="fin-explorer-search">Buscar concepto, comercio o motivo<input type="search" placeholder="Ej. combustible, proveedor, factura o referencia…" value={filters.query} onChange={e=>change('query',e.target.value)}/></label>
   <label>Tipo de cuenta<select value={filters.kind} onChange={e=>change('kind',e.target.value)}><option value="">Personales y jurídicas</option>{(['Personal','Jurídico'] as const).filter(k=>accounts.some(c=>accountKind(c)===k)).map(k=><option key={k}>{k}</option>)}</select></label>
   <label>Banco / cuenta<select value={filters.account} onChange={e=>change('account',e.target.value)}><option value="">Todas las cuentas del período</option><AccountOptions accounts={accounts.filter(c=>!filters.kind||accountKind(c)===filters.kind)}/></select></label>
   <label>Clasificación<select value={filters.category} onChange={e=>change('category',e.target.value)}><option value="">Todas las clasificaciones</option><option value="unclassified">Sin clasificar</option>{categories.map(c=><option key={c.Codigo} value={c.Codigo}>{c.Codigo} · {c.Nombre}</option>)}</select></label>
   <label>Movimiento<select value={filters.type} onChange={e=>change('type',e.target.value)}><option value="">Entradas y salidas</option><option value="SALIDA">Salidas</option><option value="ENTRADA">Entradas</option></select></label>
   <label>Comercio / contraparte<select value={filters.party} onChange={e=>change('party',e.target.value)}><option value="">Todas las contrapartes</option>{parties.map(p=><option key={p}>{p}</option>)}</select></label>
   <label>Método de pago<select value={filters.method} onChange={e=>change('method',e.target.value)}><option value="">Todos los métodos</option>{methods.map(p=><option key={p}>{p}</option>)}</select></label>
   <label>Conciliación<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">Todos los estados</option><option value="SI">Sí</option><option value="NO">No</option><option value="PENDIENTE">Pendiente</option></select></label>
   <div className="fin-explorer-filter-note"><span>Los filtros se combinan dentro de este período.</span><button type="button" onClick={clear} disabled={!active}>Limpiar filtros{active?` (${active})`:''}</button></div>
  </section>
  <div className="fin-explorer-totals" aria-label="Totales de los movimientos filtrados">
   <div><span>Ingresos</span><strong>Bs {montoFin(total.entradas)}</strong><small>Sin transferencias propias</small></div>
   <div className="fin-explorer-spent"><span>Gastos</span><strong>Bs {montoFin(total.salidas)}</strong><small>Sin transferencias propias</small></div>
   <div><span>Transferencias recibidas</span><strong>Bs {montoFin(total.transferenciasEntrada)}</strong><small>Entre cuentas propias</small></div>
   <div><span>Transferencias enviadas</span><strong>Bs {montoFin(total.transferenciasSalida)}</strong><small>Entre cuentas propias</small></div>
  </div>
  <p className="fin-explorer-results" role="status"><b>{filtered.length}</b> de {rows.length} movimientos del período · Los totales corresponden a los filtros actuales.</p>
  <details className="fin-explorer-expenses" open>
   <summary>En qué se gastó <span>Bs {montoFin(total.salidas)}</span></summary>
   {expenses.length?<div className="fin-explorer-categories">{expenses.map(e=><button type="button" key={e.codigo} aria-pressed={filters.category===(e.codigo||'unclassified')} onClick={()=>change('category',e.codigo||'unclassified')}><span><small>{e.codigo||'Sin código'}</small>{e.nombre}</span><b>Bs {montoFin(e.monto)}</b></button>)}</div>:<p>No hay gastos con estos filtros.</p>}
   <p className="fin-explorer-help">Selecciona una clasificación para ver sus conceptos, contrapartes e importes.</p>
  </details>
  <div className="fin-explorer-list-heading"><h4>Movimientos a detalle</h4><label>Ordenar<select value={order} onChange={e=>{setOrder(e.target.value);setPage(1);}}><option value="date-desc">Más recientes</option><option value="date-asc">Más antiguos</option><option value="amount-desc">Mayor importe</option></select></label></div>
  {ordered.length?<div className="fin-scroll fin-explorer-table" tabIndex={0} role="region" aria-label="Tabla de movimientos, desplázate horizontalmente para ver todas las columnas"><table><thead><tr><th>Fecha / cuenta</th><th>Concepto / contraparte</th><th>Clasificación</th><th>Tipo</th><th className="fin-number">Monto Bs</th><th>Detalle</th></tr></thead><tbody>{ordered.slice((current-1)*50,current*50).map((r,index)=>{const c=data.cuentas.find(c=>c.Cuenta===r.Cuenta),open=expanded===r.ID,id=`movement-detail-${current}-${index}`;return <Fragment key={r.ID}><tr><td><b>{fechaLegible(r.Fecha)}</b><small>{bankName(c)} · {accountKind(c)}</small></td><td className="fin-explorer-concept">{r.Concepto}<small>{r.Contraparte||'Sin contraparte registrada'}</small></td><td>{r.Codigo&&<b className="fin-explorer-code">{r.Codigo}</b>}{data.categorias.find(c=>c.Codigo===r.Codigo)?.Nombre||'Sin clasificar'}</td><td><span className={isOwnTransfer(r)?'fin-transfer-tag':r.Tipo==='ENTRADA'?'fin-in':'fin-out'}>{isOwnTransfer(r)?'Transferencia propia':r.Tipo==='ENTRADA'?'Ingreso':'Gasto'}</span><small>{r.Tipo==='ENTRADA'?'Entrada':'Salida'}</small></td><td className="fin-number">{montoFin(Number(r.Monto))}</td><td><button type="button" aria-expanded={open} aria-controls={id} aria-label={`${open?'Ocultar':'Ver'} detalle de ${r.Concepto}, ${fechaLegible(r.Fecha)}`} onClick={()=>setExpanded(open?'':r.ID)}>{open?'Ocultar':'Ver detalle'}</button></td></tr>{open&&<tr className="fin-explorer-expanded"><td colSpan={6}><dl id={id}><div><dt>Concepto / motivo registrado</dt><dd>{r.Concepto}</dd></div><div><dt>Comercio / contraparte</dt><dd>{r.Contraparte||'Sin registrar'}</dd></div><div><dt>Referencia</dt><dd>{r.Referencia||'Sin registrar'}</dd></div><div><dt>Factura</dt><dd>{r.Factura||'Sin registrar'}</dd></div><div><dt>Método de pago</dt><dd>{paymentMethod(r.Metodo)}</dd></div><div><dt>Conciliado</dt><dd>{r.Conciliado||'Pendiente'}</dd></div><div><dt>Identificador</dt><dd>{r.ID}</dd></div></dl></td></tr>}</Fragment>;})}</tbody></table></div>:<div className="fin-explorer-empty"><h4>No hay movimientos con esta selección</h4><p>{rows.length?'Prueba otra clasificación, cuenta o término de búsqueda.':'No hay movimientos registrados en este período.'}</p>{active>0&&<button type="button" onClick={clear}>Ver todos los movimientos del período</button>}</div>}
  <div className="fin-pagination"><span>{filtered.length?`${(current-1)*50+1}–${Math.min(current*50,filtered.length)} de ${filtered.length} · `:''}Página {current} de {pages}</span><button type="button" disabled={current<=1} onClick={()=>{setPage(current-1);setExpanded('');}}>Anterior</button><button type="button" disabled={current>=pages} onClick={()=>{setPage(current+1);setExpanded('');}}>Siguiente</button></div>
  {onEdit&&<div className="fin-explorer-edit"><p>Para cambiar un movimiento o su clasificación, abre la consulta del mismo mes.</p><button type="button" onClick={()=>onEdit(filters.account)}>Editar movimientos en consulta</button></div>}
 </div>;
}

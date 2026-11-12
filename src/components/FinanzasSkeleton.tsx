"use client";

/**
 * Estado de carga de Finanzas (vista general y conciliaciones). Reproduce la
 * estructura y las medidas reales de la página — encabezado, pestañas + acción
 * bancaria, tarjeta de filtros (elección de período, campos y acciones), panel
 * del período (calendario + resumen oscuro), KPIs, notas, semanas y tabla de
 * métodos — para que al llegar los datos no haya saltos visuales.
 */
export default function FinanzasSkeleton() {
  return <div className="finance fin-skeleton" role="status" aria-label="Cargando datos financieros">
    <span className="sr-only">Cargando datos financieros y conciliaciones…</span>
    <div className="fin-skeleton-head"><div><div className="fin-shimmer fin-sk-eyebrow"/><div className="fin-shimmer fin-sk-title"/><div className="fin-shimmer fin-sk-subtitle"/></div><div className="fin-shimmer fin-sk-button"/></div>
    <div className="fin-skeleton-control"><div className="fin-skeleton-tabs"><div className="fin-shimmer fin-sk-tab-a"/><div className="fin-shimmer fin-sk-tab-b"/></div><div className="fin-shimmer fin-sk-link"/></div>
    <div className="fin-skeleton-filters">
      <div className="fin-sk-period-choice"><div className="fin-shimmer fin-sk-choice-title"/><div className="fin-sk-choice-tabs"><div className="fin-shimmer"/><div className="fin-shimmer"/><div className="fin-shimmer"/></div></div>
      <div className="fin-skeleton-fields">{Array.from({length:3},(_,i)=><div className="fin-sk-field" key={i}><div className="fin-shimmer fin-sk-field-label"/><div className="fin-shimmer fin-sk-field-box"/></div>)}</div>
      <div className="fin-sk-presets">{Array.from({length:4},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>
    </div>
    <div className="fin-skeleton-period">
      <div className="fin-sk-calendar">
        <div className="fin-sk-cal-head"><div className="fin-shimmer fin-sk-cal-title"/><div className="fin-sk-cal-nav"><div className="fin-shimmer"/><div className="fin-shimmer"/></div></div>
        <div className="fin-shimmer fin-sk-cal-help"/>
        <div className="fin-sk-cal-abbr">{Array.from({length:7},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>
        <div className="fin-skeleton-days">{Array.from({length:42},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>
        <div className="fin-shimmer fin-sk-cal-legend"/>
      </div>
      <div className="fin-skeleton-summary"><div className="fin-shimmer"/><div className="fin-shimmer"/><div className="fin-shimmer"/><div className="fin-shimmer"/><div className="fin-shimmer fin-sk-tag"/></div>
    </div>
    <div className="fin-skeleton-kpis">{Array.from({length:4},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>
    <div className="fin-sk-notes"><div className="fin-shimmer"/><div className="fin-shimmer"/><div className="fin-shimmer"/></div>
    <div className="fin-sk-weeks"><div className="fin-shimmer fin-sk-weeks-title"/><div className="fin-sk-weeks-grid">{Array.from({length:5},(_,i)=><div className="fin-shimmer" key={i}/>)}</div></div>
    <div className="fin-sk-table"><div className="fin-shimmer fin-sk-table-title"/><div className="fin-sk-table-head">{Array.from({length:3},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>{Array.from({length:3},(_,f)=><div className="fin-sk-table-row" key={f}>{Array.from({length:3},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>)}</div>
  </div>;
}

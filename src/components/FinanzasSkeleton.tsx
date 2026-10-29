export default function FinanzasSkeleton() {
  return <div className="finance fin-skeleton" role="status" aria-label="Cargando datos financieros">
    <span className="sr-only">Cargando datos financieros y conciliaciones…</span>
    <div className="fin-skeleton-head"><div><div className="fin-shimmer fin-sk-eyebrow"/><div className="fin-shimmer fin-sk-title"/><div className="fin-shimmer fin-sk-subtitle"/></div><div className="fin-shimmer fin-sk-button"/></div>
    <div className="fin-skeleton-tabs"><div className="fin-shimmer"/><div className="fin-shimmer"/></div>
    <div className="fin-skeleton-filters"><div className="fin-shimmer fin-sk-filter-title"/><div className="fin-skeleton-fields">{Array.from({length:4},(_,i)=><div className="fin-shimmer" key={i}/>)}</div></div>
    <div className="fin-skeleton-period"><div className="fin-skeleton-calendar"><div className="fin-shimmer fin-sk-calendar-title"/><div className="fin-skeleton-days">{Array.from({length:35},(_,i)=><div className="fin-shimmer" key={i}/>)}</div></div><div className="fin-skeleton-summary"><div className="fin-shimmer"/><div className="fin-shimmer"/><div className="fin-shimmer"/></div></div>
    <div className="fin-skeleton-kpis">{Array.from({length:4},(_,i)=><div className="fin-shimmer" key={i}/>)}</div>
  </div>;
}

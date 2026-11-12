"use client";

/**
 * Estado de carga de la vista de Nómina. Reproduce la estructura y las medidas
 * reales de la página (panel «Cerrar mes», barra de filtros, tabla del mes,
 * resumen del mes y la cabecera plegada del resumen anual de desembolso, que
 * ahora va al final y permanece cerrada) para que al llegar los datos no haya
 * saltos visuales. Mismo lenguaje visual que FinanzasSkeleton (shimmer).
 */
export default function NominaSkeleton() {
  return (
    <div className="nom-skeleton" role="status" aria-label="Cargando nómina">
      <span className="sr-only">Cargando nómina y pagos…</span>

      {/* Cerrar mes */}
      <div className="nom-sk-panel nom-sk-cierre">
        <div className="nom-shimmer nom-sk-h3" />
        <div className="nom-shimmer nom-sk-linea" />
        <div className="nom-sk-controles">
          <div className="nom-shimmer nom-sk-trigger" />
          <div className="nom-shimmer nom-sk-input" />
          <div className="nom-shimmer nom-sk-btn" />
        </div>
      </div>

      {/* Barra de filtros del mes */}
      <div className="nom-sk-toolbar">
        <div className="nom-sk-campo">
          <div className="nom-shimmer nom-sk-label" />
          <div className="nom-shimmer nom-sk-select" />
        </div>
        <div className="nom-shimmer nom-sk-busqueda" />
        <div className="nom-shimmer nom-sk-badge" />
        <div className="nom-shimmer nom-sk-btn" />
      </div>

      {/* Tabla del mes */}
      <div className="nom-sk-tabla nom-sk-tabla-mes">
        <div className="nom-sk-thead">{Array.from({ length: 9 }, (_, i) => <div className="nom-shimmer" key={i} />)}</div>
        {Array.from({ length: 8 }, (_, f) => (
          <div className="nom-sk-row" key={f}>
            <div className="nom-sk-celda nom-sk-celda-doble"><div className="nom-shimmer" /><div className="nom-shimmer" /></div>
            {Array.from({ length: 6 }, (_, i) => <div className="nom-sk-celda" key={i}><div className="nom-shimmer" /></div>)}
            <div className="nom-sk-celda nom-sk-celda-acc"><div className="nom-shimmer" /></div>
          </div>
        ))}
      </div>

      {/* Resumen del mes */}
      <div className="nom-sk-panel nom-sk-resumen">
        <div className="nom-shimmer nom-sk-h3" />
        <div className="nom-sk-kpis">{Array.from({ length: 3 }, (_, i) => <div className="nom-shimmer" key={i} />)}</div>
        {Array.from({ length: 5 }, (_, i) => (
          <div className="nom-sk-barra" key={i}>
            <div className="nom-shimmer nom-sk-barra-label" />
            <div className="nom-sk-barra-track"><div className="nom-shimmer" /></div>
            <div className="nom-shimmer nom-sk-barra-val" />
          </div>
        ))}
      </div>

      {/* Resumen anual de desembolso: debajo del resumen del mes y plegado por defecto */}
      <div className="nom-sk-details">
        <div className="nom-sk-summary">
          <div className="nom-shimmer nom-sk-summary-title" />
          <div className="nom-shimmer nom-sk-summary-meta" />
        </div>
      </div>
    </div>
  );
}

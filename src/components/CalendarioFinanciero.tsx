"use client";
import { useMemo } from "react";
import { fechaLegible, inicioSemana, moverFecha, type Movimiento } from "@/lib/finanzas";

export default function CalendarioFinanciero({ mes, desde, hasta, semanal, movimientos, onDia, onNavegar, onMes, onSemana }: {
  mes: string; desde: string; hasta: string; semanal: boolean; movimientos: Movimiento[];
  onDia: (fecha: string) => void; onNavegar: (delta: number) => void; onMes: () => void; onSemana: () => void;
}) {
  const cantidades = useMemo(() => {
    const m = new Map<string, number>();
    movimientos.forEach(r => m.set(r.Fecha, (m.get(r.Fecha) || 0) + 1)); return m;
  }, [movimientos]);
  const inicio = inicioSemana(mes + "-01");
  const dias = Array.from({ length: 42 }, (_, i) => moverFecha(inicio, i));
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
  const nombre = new Date(mes + "-01T12:00:00Z").toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });
  const unidad = semanal ? "semana" : "mes";
  return <section className="fin-calendar" aria-label="Calendario de movimientos">
    <div className="fin-calendar-heading"><div><p className="fin-kicker">Tu período en el calendario</p><h4>{nombre}</h4></div><div className="fin-calendar-nav"><button type="button" aria-label={unidad + " anterior en el calendario"} onClick={() => onNavegar(-1)}>←</button><button type="button" aria-label={unidad + " siguiente en el calendario"} onClick={() => onNavegar(1)}>→</button></div></div>
    <p className="fin-calendar-help">Pulsa un día para consultar sus registros. Las flechas cambian {semanal ? "de semana" : "de mes"}.</p>
    <div className="fin-calendar-grid" role="group" aria-label={nombre}>
      {[['S','Sábado'],['D','Domingo'],['L','Lunes'],['M','Martes'],['M','Miércoles'],['J','Jueves'],['V','Viernes']].map(([d,n]) => <abbr key={n} title={n}>{d}</abbr>)}
      {dias.map(fecha => {
        const cantidad = cantidades.get(fecha) || 0, elegido = fecha >= desde && fecha <= hasta;
        return <button type="button" key={fecha} className={`fin-calendar-day${fecha.slice(0,7) !== mes ? " outside" : ""}${elegido ? " selected" : ""}${desde === hasta && elegido ? " exact-day" : ""}`} aria-pressed={elegido} aria-current={fecha === hoy ? "date" : undefined} aria-label={`${fechaLegible(fecha)} · ${cantidad} movimientos${elegido ? " · en la selección" : ""}`} onClick={() => onDia(fecha)}>
          <span>{Number(fecha.slice(8))}</span><small>{cantidad ? cantidad : "—"}</small>
        </button>;
      })}
    </div>
    <div className="fin-calendar-legend"><span><i/> Período consultado</span><span>Número = movimientos con tus filtros</span></div>
    {desde === hasta && <div className="fin-calendar-expand"><button type="button" onClick={onSemana}>Ver semana completa</button><button type="button" onClick={onMes}>Ver mes completo</button></div>}
  </section>;
}

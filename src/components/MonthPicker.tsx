"use client";

import { useEffect, useId, useRef, useState } from "react";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function MonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(Number(value.slice(0, 4)));
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const elegido = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    elegido.current?.focus();
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAbierto(false); boton.current?.focus(); }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const mes = Number(value.slice(5, 7)) - 1;
  return (
    <div className="month-picker" ref={raiz} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
    }}>
      <button type="button" ref={boton} className="month-picker-trigger"
        aria-label={`Seleccionar período: ${MESES[mes]} de ${value.slice(0, 4)}`}
        aria-expanded={abierto} aria-controls={id} aria-haspopup="dialog"
        onClick={() => { setAnio(Number(value.slice(0, 4))); setAbierto(!abierto); }}>
        <span>{MESES[mes]} de {value.slice(0, 4)}</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
      </button>
      {abierto && <div className="month-picker-popover" id={id} role="dialog" aria-label="Elegir mes y año">
        <div className="month-picker-year">
          <button type="button" aria-label="Año anterior" disabled={anio <= 1} onClick={() => setAnio(anio - 1)}>‹</button>
          <strong aria-live="polite">{anio}</strong>
          <button type="button" aria-label="Año siguiente" disabled={anio >= 9999} onClick={() => setAnio(anio + 1)}>›</button>
        </div>
        <div className="month-picker-months">
          {MESES.map((nombre, i) => {
            const seleccionado = anio === Number(value.slice(0, 4)) && i === mes;
            return <button key={nombre} type="button" ref={i === mes ? elegido : undefined}
              aria-pressed={seleccionado} className={seleccionado ? "selected" : ""}
              onClick={() => {
                onChange(`${String(anio).padStart(4, "0")}-${String(i + 1).padStart(2, "0")}`);
                setAbierto(false); boton.current?.focus();
              }}>{nombre}</button>;
          })}
        </div>
      </div>}
    </div>
  );
}

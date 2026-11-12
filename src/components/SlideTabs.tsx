"use client";

/**
 * Grupo de botones horizontales con píldora deslizante.
 *
 * El estado activo no cambia "en seco": una píldora oscura (con su línea
 * amarilla) fluye desde el botón que estaba activo hasta el nuevo, midiendo
 * la posición real del botón destino (offsetLeft/offsetTop/offsetWidth).
 * Se re-mide al cambiar el valor, al redimensionar la ventana y al terminar
 * de cargar las fuentes, de modo que la píldora siempre encaja en su sitio.
 *
 * El botón activo deja de pintar su propio fondo (lo hace la píldora que va
 * por debajo); el color del texto sigue manejándolo el CSS original.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props<V extends string> = {
  /** Pares [valor, etiqueta] en el orden en que se muestran. */
  items: readonly (readonly [V, ReactNode])[];
  value: V;
  onChange: (v: V) => void;
  /** Clases del contenedor (p. ej. "tabs resumen-tabs" o "fin-tabs"). */
  className?: string;
  ariaLabel?: string;
  /** "tab" → role=tab + aria-selected; "toggle" → aria-pressed (por defecto). */
  variante?: "tab" | "toggle";
};

export default function SlideTabs<V extends string>({ items, value, onChange, className = "", ariaLabel, variante = "toggle" }: Props<V>) {
  const cont = useRef<HTMLDivElement>(null);
  const botones = useRef(new Map<V, HTMLButtonElement>());
  // Posición/tamaño de la píldora; null = aún sin medir (no se pinta).
  const [pastilla, setPastilla] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const btn = botones.current.get(value);
      if (!btn) return;
      setPastilla({ x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight });
    };
    medir();
    const contEl = cont.current;
    if (!contEl || typeof ResizeObserver === "undefined") return;
    // La píldora sigue los cambios de tamaño del grupo y de cada botón
    // (ajustes de pantalla, recarga de fuentes, textos que reflow…).
    const obs = new ResizeObserver(() => medir());
    obs.observe(contEl);
    botones.current.forEach((b) => obs.observe(b));
    if (document.fonts?.ready) document.fonts.ready.then(medir).catch(() => {});
    return () => obs.disconnect();
  }, [value]);

  // Limpieza al desmontar del mapa de referencias.
  useEffect(() => () => botones.current.clear(), []);

  return (
    <div className={className + " slide-tabs"} ref={cont} role={variante === "tab" ? "tablist" : "group"} aria-label={ariaLabel}>
      {pastilla && (
        <span
          aria-hidden
          className="slide-pill"
          style={{ transform: `translate(${pastilla.x}px, ${pastilla.y}px)`, width: pastilla.w, height: pastilla.h }}
        />
      )}
      {items.map(([v, etiqueta]) => {
        const activo = v === value;
        return (
          <button
            key={v}
            type="button"
            ref={(el) => { if (el) botones.current.set(v, el); else botones.current.delete(v); }}
            className={activo ? "active" : undefined}
            aria-pressed={variante === "toggle" ? activo : undefined}
            role={variante === "tab" ? "tab" : undefined}
            aria-selected={variante === "tab" ? activo : undefined}
            onClick={() => onChange(v)}
          >
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}

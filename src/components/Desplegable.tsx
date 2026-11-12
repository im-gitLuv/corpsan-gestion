"use client";

/**
 * <details> animado: despliegue y cierre tipo «persiana».
 *
 * La condición `open` nativa permanece activa (el navegador nunca llega a
 * ocultar el contenido de golpe); el estado visual lo controla `data-abierto`,
 * que anima el plegado con la técnica grid-rows (0fr ⇄ 1fr): la altura fluye
 * y la información entra deslizándose hacia abajo, con un pequeño fundido.
 *
 * Con `autoAbrir`, el plegado se abre una sola vez cuando el usuario llega a
 * él bajando con el scroll (si ya está a la vista al cargar la página, se
 * respeta el estado cerrado hasta que el usuario se desplace).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** Clases del <details> (p. ej. "panel" o "fin-collapsible fin-months"). */
  className?: string;
  /** Contenido de la cabecera (summary). */
  summary: ReactNode;
  children: ReactNode;
  /** Abrir automáticamente al entrar en pantalla (una sola vez). */
  autoAbrir?: boolean;
  /** Estado inicial del plegado. */
  abiertoInicial?: boolean;
  /** Identificador para aria-controls. */
  id?: string;
};

export default function Desplegable({ className = "", summary, children, autoAbrir = false, abiertoInicial = false, id }: Props) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const ref = useRef<HTMLDetailsElement>(null);
  // Si el usuario actúa sobre el plegado, el auto-apertura por scroll ya no interviene.
  const usuarioActuo = useRef(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!autoAbrir || !nodo || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          // A la vista al cargar (sin scroll previo): se queda cerrado;
          // se abrirá cuando el usuario baje hasta él.
          if (window.scrollY < 60 && nodo.getBoundingClientRect().top >= 0) continue;
          obs.disconnect();
          if (!usuarioActuo.current) setAbierto(true);
          break;
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(nodo);
    return () => obs.disconnect();
  }, [autoAbrir]);

  return (
    <details
      ref={ref}
      id={id}
      className={className + " desplegable"}
      data-abierto={abierto ? "true" : "false"}
      open
    >
      <summary
        aria-expanded={abierto}
        aria-controls={id}
        onClick={(e) => {
          // Se cancela el toggle nativo (que cambiaría de golpe) y el estado pasa a React.
          e.preventDefault();
          usuarioActuo.current = true;
          setAbierto((a) => !a);
        }}
      >
        {summary}
      </summary>
      <div className="desp-wrap">
        <div className="desp-inner">{children}</div>
      </div>
    </details>
  );
}

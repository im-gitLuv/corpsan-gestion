"use client";

/**
 * Pólizas, Solvencias y Certificaciones.
 *  · Pólizas, seguros y fianzas: vigencia calculada y alertas de vencimiento.
 *  · Solvencias y certificaciones: la última vigente escaneada en el sistema,
 *    con enlace al portal de cada ente (SENIAT, IVSS…).
 */
import { useMemo, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import SlideTabs from "@/components/SlideTabs";
import AdmModule, { type AdmColumnaExtra } from "@/components/AdmModule";
import { useAdm } from "@/lib/adm-store";
import { ADM_PORTALES, admDinero, admVigencia } from "@/lib/adm";
import { Ic, Icons } from "@/components/icons";
import "../administracion.css";

type Pestana = "polizas" | "solvencias";
const hoyCaracas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });

export default function CumplimientoPage() {
  const [pestana, setPestana] = useState<Pestana>("polizas");
  const reduceMotion = useReducedMotion();
  const api = useAdm(["POLIZAS", "SOLVENCIAS"]);
  const hoy = hoyCaracas();

  const polizas = api.datos.POLIZAS || [];
  const solvencias = api.datos.SOLVENCIAS || [];

  const resumen = useMemo(() => {
    const todas: Array<{ tipo: string; numero: string; vence: string; estado: string; coleccion: string }> = [];
    polizas.forEach((p) => todas.push({ tipo: `${p.Tipo} · ${p.Aseguradora}`, numero: String(p.Numero ?? ""), vence: String(p.Hasta ?? ""), estado: admVigencia(p.Hasta, hoy), coleccion: "Pólizas y seguros" }));
    solvencias.forEach((s) => todas.push({ tipo: String(s.Tipo ?? ""), numero: String(s.Numero ?? s.Ente ?? ""), vence: String(s.Vencimiento ?? ""), estado: admVigencia(s.Vencimiento, hoy), coleccion: "Solvencias" }));
    return {
      vigentes: todas.filter((t) => t.estado === "Vigente").length,
      porVencer: todas.filter((t) => t.estado === "Por vencer"),
      vencidas: todas.filter((t) => t.estado === "Vencida"),
    };
  }, [polizas, solvencias, hoy]);

  const columnaVigencia = (campo: string): AdmColumnaExtra => ({
    key: "vigencia",
    label: "Vigencia",
    render: (f) => {
      const v = admVigencia(f[campo], hoy);
      return <span className={"pill " + (v === "Vigente" ? "ok" : v === "Por vencer" ? "wa" : "danger")}>{v}</span>;
    },
  });

  const panelVencimientos = (
    <div className="adm-alertas">
      <h5>Vencimientos <b>({resumen.porVencer.length + resumen.vencidas.length})</b></h5>
      {resumen.porVencer.length + resumen.vencidas.length === 0 && <p className="empty" style={{ padding: "10px 0" }}>Todas las pólizas y solvencias están vigentes.</p>}
      <div className="adm-alerta-lista">
        {[...resumen.vencidas, ...resumen.porVencer].map((t, i) => (
          <div key={i} className={"adm-alerta-fila " + (t.estado === "Vencida" ? "vencida" : "proxima")}>
            <span><b>{t.tipo}</b><small>{t.coleccion}{t.numero ? ` · ${t.numero}` : ""}</small></span>
            <span className={"pill " + (t.estado === "Vencida" ? "danger" : "wa")}>{t.estado}</span>
            <small>Vence {t.vence || "sin fecha"}</small>
          </div>
        ))}
      </div>
      <p className="tiny" style={{ marginTop: 10 }}>Se considera «por vencer» todo documento que vence dentro de 30 días. El resumen general también lo avisa.</p>
    </div>
  );

  return (
    <div className="adm-page">
      <div className="adm-intro">
        <h3>Pólizas y solvencias</h3>
        <p>Control de vigencia con alertas automáticas para mantener pólizas, seguros, fianzas y solvencias activos.</p>
      </div>
      {api.error && <p className="adm-notice error" role="alert">{api.error} <button className="adm-texto-accion" onClick={() => void api.recargar()}>Reintentar</button></p>}

      <SlideTabs
        className="tabs"
        ariaLabel="Sección de cumplimiento"
        value={pestana}
        onChange={setPestana}
        items={([["polizas", "Pólizas, seguros y fianzas"], ["solvencias", "Solvencias y certificaciones"]] as const)}
      />

      <m.div key={pestana} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {pestana === "polizas" && (
          <AdmModule
            api={api}
            coleccion="POLIZAS"
            titulo="Pólizas, seguros y fianzas"
            descripcion="Fechas de vencimiento, alcances y alertas automáticas."
            textoNuevo="+ Nueva póliza"
            busqueda="Buscar por aseguradora, número, concepto…"
            columnasExtra={[columnaVigencia("Hasta")]}
            panelSuperior={
              <>
                <div className="cards">
                  <div className="card-kpi"><small>Vigentes</small><strong>{resumen.vigentes}</strong></div>
                  <div className="card-kpi"><small>Por vencer</small><strong>{resumen.porVencer.length}</strong></div>
                  <div className="card-kpi"><small>Vencidas</small><strong>{resumen.vencidas.length}</strong></div>
                  <div className="card-kpi"><small>Prima total</small><strong>{admDinero(polizas.reduce((s, p) => s + (Number(p.Prima) || 0), 0))}</strong></div>
                </div>
                {panelVencimientos}
              </>
            }
          />
        )}

        {pestana === "solvencias" && (
          <AdmModule
            api={api}
            coleccion="SOLVENCIAS"
            titulo="Solvencias y certificaciones"
            descripcion="La última solvencia vigente, escaneada en el sistema: Seguro Social, seguridad PDVSA, Ambiente, Bomberos, Alcaldía, RACDA, RUPDAE."
            textoNuevo="+ Nueva solvencia"
            busqueda="Buscar por tipo, ente, número…"
            columnasExtra={[columnaVigencia("Vencimiento")]}
            accionesExtra={(f) => (
              f.Enlace ? <a className="mini" title="Abrir portal del ente" href={String(f.Enlace)} target="_blank" rel="noopener noreferrer"><Ic d={Icons.wallet} /></a> : null
            )}
            panelSuperior={
              <>
                {panelVencimientos}
                <div className="adm-alertas">
                  <h5>Portales para verificar solvencias actualizadas</h5>
                  <p className="tiny" style={{ margin: 0 }}>
                    Cada solvencia guarda el enlace de su ente (botón «Abrir portal»). Estos son los portales generales:
                  </p>
                  <div className="adm-links">
                    {ADM_PORTALES.map((p) => (
                      <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"><Ic d={Icons.wallet} />{p.nombre}</a>
                    ))}
                  </div>
                </div>
              </>
            }
          />
        )}
      </m.div>
    </div>
  );
}

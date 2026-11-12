"use client";

/**
 * Comunicaciones y Requisiciones.
 *  · Comunicaciones internas y externas con generador automático de seriales
 *    consecutivos: CS-2026-I-AD-00001 (único consecutivo anual por empresa).
 *  · Requisiciones: correlativo estricto RQ-… con modelos de ficha imprimibles
 *    (oficina, activo fijo, consumible, servicio, genérica).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { m, useReducedMotion } from "motion/react";
import SlideTabs from "@/components/SlideTabs";
import AdmModule from "@/components/AdmModule";
import { admEtiqueta, useAdm } from "@/lib/adm-store";
import { ADM_ETIQUETAS, ADM_MODELOS_REQUISICION } from "@/lib/adm";
import { Ic, Icons } from "@/components/icons";
import "../administracion.css";

type Pestana = "comunicaciones" | "requisiciones";
const hoyCaracas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });

export default function ComunicacionesPage() {
  const [pestana, setPestana] = useState<Pestana>("comunicaciones");
  const reduceMotion = useReducedMotion();
  const api = useAdm(["COMUNICACIONES", "REQUISICIONES"]);
  const hoy = hoyCaracas();
  const anio = hoy.slice(0, 4);

  const comunicaciones = api.datos.COMUNICACIONES || [];
  const requisiciones = api.datos.REQUISICIONES || [];

  const delAnio = useMemo(() => comunicaciones.filter((c) => String(c.Fecha ?? "").startsWith(anio)), [comunicaciones, anio]);
  const siguiente = api.siguiente.COMUNICACIONES || "";
  const partes = siguiente.split("-");
  const siguienteNumero = partes[partes.length - 1] || "00001";

  return (
    <div className="adm-page">
      <div className="adm-intro">
        <h3>Comunicaciones y requisiciones</h3>
        <p>Codificación con consecutivo único anual por empresa y requisiciones con correlativo estricto y su ficha imprimible.</p>
      </div>
      {api.error && <p className="adm-notice error" role="alert">{api.error} <button className="adm-texto-accion" onClick={() => void api.recargar()}>Reintentar</button></p>}

      <SlideTabs
        className="tabs"
        ariaLabel="Sección de comunicaciones"
        value={pestana}
        onChange={setPestana}
        items={([["comunicaciones", "Comunicaciones"], ["requisiciones", "Requisiciones"]] as const)}
      />

      <m.div key={pestana} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {pestana === "comunicaciones" && (
          <AdmModule
            api={api}
            coleccion="COMUNICACIONES"
            titulo="Comunicaciones internas y externas"
            descripcion="Cartas, ofertas, solicitudes, circulares, SSO y Banahvi: un único consecutivo anual (1–5000) que solo varía por dirección y departamento."
            textoNuevo="+ Nueva comunicación"
            busqueda="Buscar por código, asunto, destinatario…"
            celda={(k, f) => (k === "Direccion" || k === "Departamento" ? admEtiqueta(k, f[k]) : undefined)}
            panelSuperior={
              <>
                <div className="adm-serial">
                  <span className="tag">Siguiente código</span>
                  <span className="codigo">CS-{anio}-[I|E]-[OP|AD|DIR]-{siguienteNumero}</span>
                  <small>
                    Se asigna al guardar. Dirección: <b>I</b>nterna / <b>E</b>xterna · Departamentos: <b>OP</b> {ADM_ETIQUETAS.OP}, <b>AD</b> {ADM_ETIQUETAS.AD}, <b>DIR</b> {ADM_ETIQUETAS.DIR}.
                  </small>
                </div>
                <div className="cards">
                  <div className="card-kpi"><small>Emitidas {anio}</small><strong>{delAnio.length}</strong></div>
                  <div className="card-kpi"><small>Último código</small><strong style={{ fontSize: 20 }}>{delAnio[0]?.ID || "—"}</strong></div>
                  <div className="card-kpi"><small>Internas</small><strong>{delAnio.filter((c) => c.Direccion === "I").length}</strong></div>
                  <div className="card-kpi"><small>Externas</small><strong>{delAnio.filter((c) => c.Direccion === "E").length}</strong></div>
                </div>
              </>
            }
          />
        )}

        {pestana === "requisiciones" && (
          <AdmModule
            api={api}
            coleccion="REQUISICIONES"
            titulo="Requisiciones de compra"
            descripcion="Correlativo estricto con soporte firmado y factura anexa; en activos fijos la factura se escanea para el expediente."
            textoNuevo="+ Nueva requisición"
            busqueda="Buscar por N°, descripción, solicitante…"
            celda={(k, f) => (k === "Departamento" ? admEtiqueta("Departamento", f[k]) : undefined)}
            accionesExtra={(f) => (
              <Link className="mini" title="Ficha imprimible" href={`/dashboard/administracion/comunicaciones/ficha?rq=${encodeURIComponent(String(f.ID ?? ""))}`}>
                <Ic d={Icons.doc} />
              </Link>
            )}
            panelSuperior={
              <div className="adm-alertas">
                <h5>Modelos de ficha <b>(imprimibles)</b></h5>
                <p className="tiny" style={{ margin: 0 }}>
                  Cada requisición trae su ficha lista para imprimir y firmar. También puedes imprimir una en blanco con el siguiente correlativo:
                </p>
                <div className="adm-links">
                  {ADM_MODELOS_REQUISICION.map((modelo) => (
                    <Link key={modelo} href={`/dashboard/administracion/comunicaciones/ficha?modelo=${encodeURIComponent(modelo)}&blanco=1`}>
                      <Ic d={Icons.doc} />Ficha {modelo.toLowerCase()}
                    </Link>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 10 }}>Siguiente correlativo: <b>{api.siguiente.REQUISICIONES || "—"}</b>.</p>
              </div>
            }
          />
        )}
      </m.div>
    </div>
  );
}

"use client";

/**
 * Cotizaciones y Órdenes de Trabajo.
 *  · Proveedores y clientes: directorio compartido por cotizaciones y compras.
 *  · Cotizaciones: registro de las emitidas con monto y estatus (antes en Excel).
 *  · Órdenes de trabajo: cronograma, partidas y control de cobros.
 *  · Cuentas por cobrar: resumen de facturas pendientes y saldos de OT.
 */
import { useMemo, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import SlideTabs from "@/components/SlideTabs";
import AdmModule from "@/components/AdmModule";
import { useAdm } from "@/lib/adm-store";
import { admCalcularFila, admDinero, type AdmRow } from "@/lib/adm";
import "../administracion.css";

type Pestana = "clientes" | "cotizaciones" | "ordenes" | "cobrar";
const hoyCaracas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
const numero = (v: unknown) => Number(v ?? 0) || 0;
const anioActual = () => hoyCaracas().slice(0, 4);

export default function ComercialPage() {
  const [pestana, setPestana] = useState<Pestana>("cotizaciones");
  const reduceMotion = useReducedMotion();
  const api = useAdm(["PROVEEDORES", "COTIZACIONES", "ORDENES", "FACTURAS"]);
  const hoy = hoyCaracas();

  const proveedores = api.datos.PROVEEDORES || [];
  const cotizaciones = useMemo(() => (api.datos.COTIZACIONES || []).slice()
    .sort((a, b) => String(b.Fecha ?? b.ID ?? "").localeCompare(String(a.Fecha ?? a.ID ?? ""))), [api.datos.COTIZACIONES]);
  const ordenes = useMemo(() => (api.datos.ORDENES || []).map((o) => admCalcularFila("ORDENES", o))
    .sort((a, b) => String(b.Fecha ?? b.ID ?? "").localeCompare(String(a.Fecha ?? a.ID ?? ""))), [api.datos.ORDENES]);
  const facturas = useMemo(() => (api.datos.FACTURAS || []).map((f) => admCalcularFila("FACTURAS", f)), [api.datos.FACTURAS]);

  const anio = anioActual();
  const kpiCotizaciones = useMemo(() => {
    const delAnio = cotizaciones.filter((c) => String(c.Fecha ?? "").startsWith(anio) && !["Anulada", "Rechazada"].includes(String(c.Estatus ?? "")));
    const aprobadas = delAnio.filter((c) => String(c.Estatus ?? "") === "Aprobada");
    return { emitidas: delAnio.length, monto: delAnio.reduce((s, c) => s + numero(c.Monto), 0), aprobadas: aprobadas.length };
  }, [cotizaciones, anio]);

  const kpiOrdenes = useMemo(() => {
    const activas = ordenes.filter((o) => ["Programada", "En ejecución"].includes(String(o.Estatus ?? "")));
    return {
      activas: activas.length,
      monto: ordenes.reduce((s, o) => s + numero(o.Monto), 0),
      cobrado: ordenes.reduce((s, o) => s + numero(o.Cobrado), 0),
      porCobrar: ordenes.reduce((s, o) => s + numero(o.PorCobrar), 0),
    };
  }, [ordenes]);

  const porCobrarFacturas = useMemo(() => facturas
    .filter((f) => String(f.Cobrada ?? "NO").toUpperCase() !== "SI")
    .sort((a, b) => String(a.Fecha ?? "").localeCompare(String(b.Fecha ?? ""))), [facturas]);
  const porCobrarOrdenes = useMemo(() => ordenes
    .filter((o) => numero(o.PorCobrar) > 0 && String(o.Estatus ?? "") !== "Anulada")
    .sort((a, b) => numero(a.PorCobrar) - numero(b.PorCobrar)), [ordenes]);
  const totalPorCobrar = porCobrarFacturas.reduce((s, f) => s + numero(f.Saldo), 0) + porCobrarOrdenes.reduce((s, o) => s + numero(o.PorCobrar), 0);

  return (
    <div className="adm-page">
      <div className="adm-intro">
        <h3>Cotizaciones y órdenes de trabajo</h3>
        <p>Directorio de proveedores y clientes, cotizaciones en línea (antes dispersas en Excel) y órdenes con su cronograma y cuentas por cobrar.</p>
      </div>
      {api.error && <p className="adm-notice error" role="alert">{api.error} <button className="adm-texto-accion" onClick={() => void api.recargar()}>Reintentar</button></p>}

      <SlideTabs
        className="tabs"
        ariaLabel="Sección comercial"
        value={pestana}
        onChange={setPestana}
        items={([
          ["clientes", `Proveedores y clientes (${proveedores.length})`],
          ["cotizaciones", "Cotizaciones"],
          ["ordenes", "Órdenes de trabajo"],
          ["cobrar", "Cuentas por cobrar"],
        ] as const)}
      />

      <m.div key={pestana} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {pestana === "clientes" && (
          <AdmModule
            api={api}
            coleccion="PROVEEDORES"
            titulo="Proveedores y clientes"
            descripcion="Directorio único: cotizaciones, compras y facturación toman sus datos de aquí."
            textoNuevo="+ Nuevo contacto"
            busqueda="Buscar por nombre, RIF, contacto…"
          />
        )}

        {pestana === "cotizaciones" && (
          <AdmModule
            api={api}
            coleccion="COTIZACIONES"
            titulo="Cotizaciones"
            descripcion="Montos en línea para cualquiera con acceso al sistema: sin archivos Excel dispersos."
            textoNuevo="+ Nueva cotización"
            busqueda="Buscar por cliente, concepto, estatus…"
            panelSuperior={
              <div className="cards">
                <div className="card-kpi"><small>Cotizaciones {anio}</small><strong>{kpiCotizaciones.emitidas}</strong></div>
                <div className="card-kpi"><small>Monto cotizado</small><strong>{admDinero(kpiCotizaciones.monto)}</strong></div>
                <div className="card-kpi"><small>Aprobadas</small><strong>{kpiCotizaciones.aprobadas}</strong></div>
              </div>
            }
          />
        )}

        {pestana === "ordenes" && (
          <AdmModule
            api={api}
            coleccion="ORDENES"
            titulo="Órdenes de trabajo"
            descripcion="Servicios sin contrato formal: partidas de la cotización, ejecución y control de los pagos recibidos."
            textoNuevo="+ Nueva orden"
            busqueda="Buscar por cliente, OT, cotización…"
            panelSuperior={
              <>
                <div className="cards">
                  <div className="card-kpi"><small>OT activas</small><strong>{kpiOrdenes.activas}</strong></div>
                  <div className="card-kpi"><small>Monto total</small><strong>{admDinero(kpiOrdenes.monto)}</strong></div>
                  <div className="card-kpi"><small>Cobrado</small><strong>{admDinero(kpiOrdenes.cobrado)}</strong></div>
                  <div className="card-kpi"><small>Por cobrar</small><strong>{admDinero(kpiOrdenes.porCobrar)}</strong></div>
                </div>
                <Cronograma filas={ordenes} hoy={hoy} />
              </>
            }
          />
        )}

        {pestana === "cobrar" && (
          <section className="adm-modulo">
            <div className="adm-encabezado">
              <div>
                <h4>Cuentas por cobrar</h4>
                <p>Facturas pendientes y saldos de órdenes de trabajo, en un solo resumen.</p>
              </div>
            </div>
            <div className="cards">
              <div className="card-kpi"><small>Total por cobrar</small><strong>{admDinero(totalPorCobrar)}</strong></div>
              <div className="card-kpi"><small>Facturas pendientes</small><strong>{porCobrarFacturas.length}</strong></div>
              <div className="card-kpi"><small>Saldo en facturas</small><strong>{admDinero(porCobrarFacturas.reduce((s, f) => s + numero(f.Saldo), 0))}</strong></div>
              <div className="card-kpi"><small>Saldo en órdenes</small><strong>{admDinero(porCobrarOrdenes.reduce((s, o) => s + numero(o.PorCobrar), 0))}</strong></div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Origen</th><th>Referencia</th><th>Cliente</th><th>Concepto</th><th>Monto total</th><th>Cobrado</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {porCobrarFacturas.length + porCobrarOrdenes.length === 0 && <tr><td colSpan={7} className="empty">Sin cuentas por cobrar pendientes.</td></tr>}
                  {porCobrarFacturas.map((f) => (
                    <tr key={"fx-" + String(f.ID)}>
                      <td><span className="pill info">Factura</span></td>
                      <td><b>{f.Factura || f.ID}</b></td>
                      <td>{f.Cliente || "—"}</td>
                      <td>{f.Concepto || "—"}</td>
                      <td>{admDinero(f.Total)}</td>
                      <td>{admDinero(f.MontoCobrado)}</td>
                      <td><b>{admDinero(f.Saldo)}</b></td>
                    </tr>
                  ))}
                  {porCobrarOrdenes.map((o) => (
                    <tr key={"ot-" + String(o.ID)}>
                      <td><span className="pill wa">Orden</span></td>
                      <td><b>{o.ID}</b></td>
                      <td>{o.Cliente || "—"}</td>
                      <td>{o.Concepto || "—"}</td>
                      <td>{admDinero(o.Monto)}</td>
                      <td>{admDinero(o.Cobrado)}</td>
                      <td><b>{admDinero(o.PorCobrar)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny">Los saldos de facturas provienen del registro de facturación y los de órdenes del control de cobros de cada OT.</p>
          </section>
        )}
      </m.div>
    </div>
  );
}

function Cronograma({ filas, hoy }: { filas: AdmRow[]; hoy: string }) {
  const proximas = filas
    .filter((o) => ["Programada", "En ejecución"].includes(String(o.Estatus ?? "")) && o.FechaInicio)
    .sort((a, b) => String(a.FechaInicio).localeCompare(String(b.FechaInicio)));
  return (
    <div className="adm-alertas">
      <h5>Cronograma de trabajo <b>({proximas.length})</b></h5>
      {proximas.length === 0 && <p className="empty" style={{ padding: "10px 0" }}>No hay órdenes programadas.</p>}
      <div className="adm-alerta-lista">
        {proximas.map((o) => (
          <div key={String(o.ID)} className="adm-alerta-fila ok">
            <span><b>{o.ID} · {o.Cliente}</b><small>{o.Concepto}</small></span>
            <span className={"pill " + (String(o.Estatus) === "En ejecución" ? "wa" : "gr")}>{String(o.Estatus)}</span>
            <small>{String(o.FechaInicio) < hoy ? "Iniciada" : `Inicia ${String(o.FechaInicio)}`}{o.FechaFin ? ` · hasta ${String(o.FechaFin)}` : ""}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

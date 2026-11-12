"use client";

/**
 * Compras, Ventas y Declaraciones.
 *  · Libro de compras: registro de compras y gastos con retenciones ISLR.
 *  · Libro de ventas: derivado del registro de facturación (ADM_FACTURAS),
 *    listo para exportar a CSV — sin duplicar datos.
 *  · Declaraciones: cronograma con alertas 5 días y 1 día antes del vencimiento.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { m, useReducedMotion } from "motion/react";
import SlideTabs from "@/components/SlideTabs";
import AdmModule, { type AdmColumnaExtra } from "@/components/AdmModule";
import { useAdm, useBancos, admCsv } from "@/lib/adm-store";
import { admCalcularFila, admDinero, admEstadoDeclaracion, type AdmRow } from "@/lib/adm";
import { Ic, Icons } from "@/components/icons";
import "../administracion.css";

type Pestana = "compras" | "ventas" | "declaraciones";

const hoyCaracas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
const numero = (v: unknown) => Number(v ?? 0) || 0;

export default function ComprasVentasPage() {
  const [pestana, setPestana] = useState<Pestana>("compras");
  const reduceMotion = useReducedMotion();
  const api = useAdm(["COMPRAS", "FACTURAS", "DECLARACIONES"]);
  const { opciones: bancos } = useBancos();
  const hoy = hoyCaracas();

  const compras = api.datos.COMPRAS || [];
  const facturas = useMemo(() => (api.datos.FACTURAS || []).map((f) => admCalcularFila("FACTURAS", f)), [api.datos.FACTURAS]);
  const declaraciones = api.datos.DECLARACIONES || [];

  const kpiCompras = useMemo(() => {
    const base = compras.reduce((s, f) => s + numero(f.Base), 0);
    const iva = compras.reduce((s, f) => s + numero(f.IVA), 0);
    const ret = compras.reduce((s, f) => s + numero(f.RetencionISLR), 0);
    return { base, iva, ret, total: base + iva };
  }, [compras]);

  const libroVentas = useMemo(() => facturas.slice().sort((a, b) => String(b.Fecha ?? "").localeCompare(String(a.Fecha ?? ""))), [facturas]);
  const kpiVentas = useMemo(() => {
    const base = libroVentas.reduce((s, f) => s + numero(f.Base), 0);
    const iva = libroVentas.reduce((s, f) => s + numero(f.IVA), 0);
    const ret = libroVentas.reduce((s, f) => s + numero(f.RetencionISLR), 0);
    const porCobrar = libroVentas.filter((f) => String(f.Cobrada ?? "NO").toUpperCase() !== "SI").reduce((s, f) => s + numero(f.Saldo), 0);
    return { base, iva, ret, porCobrar, total: base + iva };
  }, [libroVentas]);

  const proximas = useMemo(() => declaraciones
    .map((f) => ({ fila: f, situacion: admEstadoDeclaracion(f, hoy) }))
    .filter((x) => x.situacion.alerta !== "declarada")
    .sort((a, b) => String(a.fila.FechaLimite ?? "").localeCompare(String(b.fila.FechaLimite ?? ""))), [declaraciones, hoy]);

  const columnasSituacion: AdmColumnaExtra[] = [{
    key: "situacion",
    label: "Situación",
    render: (f) => {
      const s = admEstadoDeclaracion(f, hoy);
      const tono = s.alerta === "vencida" ? "danger" : s.alerta === "declarada" ? "ok" : s.alerta === "ok" ? "gr" : s.alerta === "cinco" ? "wa" : "wa";
      return <span className={"pill " + tono}>{s.estado}</span>;
    },
  }];

  return (
    <div className="adm-page">
      <div className="adm-intro">
        <h3>Compras, ventas y declaraciones</h3>
        <p>Libros contables que se alimentan del registro diario y del control de facturación · alertas de declaraciones 5 días y 1 día antes.</p>
      </div>
      {api.error && <p className="adm-notice error" role="alert">{api.error} <button className="adm-texto-accion" onClick={() => void api.recargar()}>Reintentar</button></p>}

      <SlideTabs
        className="tabs"
        ariaLabel="Sección administrativa"
        value={pestana}
        onChange={setPestana}
        items={([["compras", "Libro de compras"], ["ventas", "Libro de ventas"], ["declaraciones", "Declaraciones"]] as const)}
      />

      <m.div key={pestana} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {pestana === "compras" && (
          <AdmModule
            api={api}
            coleccion="COMPRAS"
            titulo="Libro de compras"
            descripcion="Compras y gastos con su retención de ISLR practicada. El total se calcula con base + IVA."
            textoNuevo="+ Nueva compra"
            busqueda="Buscar por proveedor, RIF, concepto…"
            bancos={bancos}
            panelSuperior={
              <div className="cards">
                <div className="card-kpi"><small>Base registrada</small><strong>{admDinero(kpiCompras.base)}</strong></div>
                <div className="card-kpi"><small>IVA</small><strong>{admDinero(kpiCompras.iva)}</strong></div>
                <div className="card-kpi"><small>Retenciones ISLR</small><strong>{admDinero(kpiCompras.ret)}</strong></div>
                <div className="card-kpi"><small>Total del libro</small><strong>{admDinero(kpiCompras.total)}</strong></div>
              </div>
            }
          />
        )}

        {pestana === "ventas" && (
          <section className="adm-modulo">
            <div className="adm-encabezado">
              <div>
                <h4>Libro de ventas</h4>
                <p>Se genera desde el registro de facturación: cada factura aporta su base, IVA y retención. <Link className="adm-texto-accion" href="/dashboard/administracion/recibos-facturas">Abrir facturación ↗</Link></p>
              </div>
              <button
                className="btn sm"
                disabled={!libroVentas.length}
                onClick={() => admCsv("libro-ventas.csv", libroVentas, [
                  { key: "Fecha", label: "Fecha" }, { key: "Cliente", label: "Cliente" }, { key: "RIF", label: "RIF" },
                  { key: "Factura", label: "Factura" }, { key: "NControl", label: "N° control" },
                  { key: "Base", label: "Base" }, { key: "IVA", label: "IVA" }, { key: "Total", label: "Total" },
                  { key: "RetencionISLR", label: "Retención ISLR" }, { key: "Cobrada", label: "Cobrada" },
                  { key: "FechaCobro", label: "Fecha de cobro" }, { key: "MontoCobrado", label: "Monto cobrado" },
                  { key: "Concepto", label: "Concepto" },
                ])}
              >Exportar CSV</button>
            </div>

            <div className="cards">
              <div className="card-kpi"><small>Base facturada</small><strong>{admDinero(kpiVentas.base)}</strong></div>
              <div className="card-kpi"><small>IVA</small><strong>{admDinero(kpiVentas.iva)}</strong></div>
              <div className="card-kpi"><small>Retención ISLR aplicada</small><strong>{admDinero(kpiVentas.ret)}</strong></div>
              <div className="card-kpi"><small>Por cobrar</small><strong>{admDinero(kpiVentas.porCobrar)}</strong></div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fecha</th><th>Cliente</th><th>RIF</th><th>Factura</th><th>Base</th><th>IVA</th><th>Total</th><th>Retención ISLR</th><th>Cobrada</th><th className="col-sec">Fecha cobro</th><th className="col-sec">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {!api.listo && <tr><td colSpan={11} className="empty">Cargando…</td></tr>}
                  {api.listo && libroVentas.length === 0 && <tr><td colSpan={11} className="empty">Aún no hay facturas registradas. El libro se arma solo con el registro de facturación.</td></tr>}
                  {libroVentas.map((f) => (
                    <tr key={String(f.ID)}>
                      <td>{f.Fecha || "—"}</td>
                      <td><b>{f.Cliente || "—"}</b></td>
                      <td>{f.RIF || "—"}</td>
                      <td>{f.Factura || "—"}</td>
                      <td>{admDinero(f.Base)}</td>
                      <td>{admDinero(f.IVA)}</td>
                      <td>{admDinero(f.Total)}</td>
                      <td>{admDinero(f.RetencionISLR)}</td>
                      <td><span className={"pill " + (String(f.Cobrada ?? "NO").toUpperCase() === "SI" ? "ok" : "gr")}>{String(f.Cobrada ?? "NO").toUpperCase() === "SI" ? "Cobrada" : "Por cobrar"}</span></td>
                      <td className="col-sec">{f.FechaCobro || "—"}</td>
                      <td className="col-sec">{admDinero(f.Saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny">Los montos del libro provienen de ADM_FACTURAS; si una factura cambia, el libro se recalcula al abrirlo. El CSV usa «;» y se abre directo en Excel.</p>
          </section>
        )}

        {pestana === "declaraciones" && (
          <AdmModule
            api={api}
            coleccion="DECLARACIONES"
            titulo="Programación de declaraciones"
            descripcion="Fechas límite por impuesto y período. El resumen general avisa 5 días y 1 día antes de cada vencimiento."
            textoNuevo="+ Nueva declaración"
            busqueda="Buscar por impuesto, período…"
            columnasExtra={columnasSituacion}
            panelSuperior={
              <div className="adm-alertas">
                <h5>Próximas declaraciones <b>({proximas.length})</b></h5>
                {proximas.length === 0 && <p className="empty" style={{ padding: "10px 0" }}>No hay declaraciones pendientes. Todo al día.</p>}
                <div className="adm-alerta-lista">
                  {proximas.map(({ fila, situacion }) => (
                    <div key={String(fila.ID)} className={"adm-alerta-fila " + (situacion.alerta === "vencida" ? "vencida" : situacion.alerta === "ok" ? "ok" : situacion.alerta === "cinco" ? "proxima" : "urgente")}>
                      <span><b>{fila.Impuesto} · {fila.Periodo}</b><small>Fecha límite: {fila.FechaLimite}</small></span>
                      <span className={"pill " + (situacion.alerta === "vencida" ? "danger" : situacion.alerta === "declarada" ? "ok" : "wa")}>{situacion.estado}</span>
                      <small>{situacion.dias === null ? "" : situacion.dias < 0 ? `${Math.abs(situacion.dias)} día(s) de retraso` : `faltan ${situacion.dias} día(s)`}</small>
                    </div>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 10 }}>La alerta también aparece en el <Link className="adm-texto-accion" href="/dashboard">resumen general ↗</Link> junto a las pólizas por vencer.</p>
              </div>
            }
          />
        )}
      </m.div>

      <p className="tiny"><Ic d={Icons.doc} /> Los libros y el cronograma se guardan en las pestañas ADM_COMPRAS, ADM_FACTURAS y ADM_DECLARACIONES del mismo libro de Google Sheets.</p>
    </div>
  );
}

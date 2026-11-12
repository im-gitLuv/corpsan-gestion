"use client";

/**
 * Recibos y Facturación.
 *  · Recibos eventuales: trabajos sin factura, con retención de ISLR
 *    (2 % servicios · 1 % honorarios), referencia bancaria y voucher.
 *  · Facturación: control de facturas emitidas, cobradas y pendientes.
 *  · Pagos semanales: anticipos S1–S4 del mes tomados de la nómina
 *    (pestaña PAGOS) junto con los recibos eventuales del mes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import SlideTabs from "@/components/SlideTabs";
import AdmModule from "@/components/AdmModule";
import { useAdm, useBancos } from "@/lib/adm-store";
import { ADM_PORTALES, admCalcularFila, admDinero, type AdmRow } from "@/lib/adm";
import { apiPost, getUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { totalAnticipos, type Pago } from "@/lib/nomina";
import { Ic, Icons } from "@/components/icons";
import "../administracion.css";

type Pestana = "recibos" | "facturas" | "semanales";
const hoyCaracas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
const numero = (v: unknown) => Number(v ?? 0) || 0;
const MES_ACTUAL = () => hoyCaracas().slice(0, 7);
const nombreMes = (p: string) => new Date(`${p}-02T12:00:00Z`).toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });

const LEER_DEMO_PAGOS = (): Pago[] => {
  try { return JSON.parse(localStorage.getItem("cs_demo_pagos") || "[]"); } catch { return []; }
};

export default function RecibosFacturasPage() {
  const [pestana, setPestana] = useState<Pestana>("recibos");
  const reduceMotion = useReducedMotion();
  const api = useAdm(["RECIBOS", "FACTURAS"]);
  const { opciones: bancos } = useBancos();
  const { user } = useAuth();
  const { conn } = useData();
  const hoy = hoyCaracas();

  const recibos = api.datos.RECIBOS || [];
  const facturas = useMemo(() => (api.datos.FACTURAS || []).map((f) => admCalcularFila("FACTURAS", f)), [api.datos.FACTURAS]);

  const kpiRecibos = useMemo(() => {
    const validos = recibos.filter((r) => String(r.Estado ?? "") !== "Anulado");
    return {
      monto: validos.reduce((s, r) => s + numero(r.Monto), 0),
      retencion: validos.reduce((s, r) => s + numero(admCalcularFila("RECIBOS", r).Retencion), 0),
      neto: validos.reduce((s, r) => s + numero(admCalcularFila("RECIBOS", r).Neto), 0),
      cantidad: validos.length,
    };
  }, [recibos]);

  const kpiFacturas = useMemo(() => {
    const mes = MES_ACTUAL();
    const cobradoMes = facturas.filter((f) => String(f.FechaCobro ?? "").startsWith(mes)).reduce((s, f) => s + numero(f.MontoCobrado), 0);
    return {
      total: facturas.reduce((s, f) => s + numero(f.Total), 0),
      cobrado: facturas.reduce((s, f) => s + numero(f.MontoCobrado), 0),
      porCobrar: facturas.filter((f) => String(f.Cobrada ?? "NO").toUpperCase() !== "SI").reduce((s, f) => s + numero(f.Saldo), 0),
      cobradoMes,
    };
  }, [facturas]);

  return (
    <div className="adm-page">
      <div className="adm-intro">
        <h3>Recibos y facturación</h3>
        <p>Recibos de trabajos eventuales con retención de ISLR, control de facturas emitidas y resumen de los pagos semanales.</p>
      </div>
      {api.error && <p className="adm-notice error" role="alert">{api.error} <button className="adm-texto-accion" onClick={() => void api.recargar()}>Reintentar</button></p>}

      <SlideTabs
        className="tabs"
        ariaLabel="Sección de recibos y facturación"
        value={pestana}
        onChange={setPestana}
        items={([
          ["recibos", "Recibos eventuales"],
          ["facturas", "Registro de facturación"],
          ["semanales", "Pagos semanales"],
        ] as const)}
      />

      <m.div key={pestana} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {pestana === "recibos" && (
          <AdmModule
            api={api}
            coleccion="RECIBOS"
            titulo="Recibos de trabajos eventuales"
            descripcion="Personas que no emiten factura: el recibo registra la retención de ISLR (2 % servicio · 1 % honorarios), la referencia bancaria y el voucher."
            textoNuevo="+ Nuevo recibo"
            busqueda="Buscar por nombre, cédula, concepto…"
            bancos={bancos}
            accionesExtra={(f) => (
              <a
                className="mini" title="Consultar RIF en el SENIAT"
                href={ADM_PORTALES[1].url}
                target="_blank" rel="noopener noreferrer"
              ><Ic d={Icons.search} /></a>
            )}
            panelSuperior={
              <>
                <div className="cards">
                  <div className="card-kpi"><small>Recibos emitidos</small><strong>{kpiRecibos.cantidad}</strong></div>
                  <div className="card-kpi"><small>Monto total</small><strong>{admDinero(kpiRecibos.monto)}</strong></div>
                  <div className="card-kpi"><small>Retenciones ISLR</small><strong>{admDinero(kpiRecibos.retencion)}</strong></div>
                  <div className="card-kpi"><small>Neto pagado</small><strong>{admDinero(kpiRecibos.neto)}</strong></div>
                </div>
                <div className="adm-alertas">
                  <h5>Consulta de RIF · SENIAT</h5>
                  <p className="tiny" style={{ margin: 0 }}>
                    Si la persona no trae su RIF, se consulta con la cédula en el portal del SENIAT y el dato queda registrado en el recibo.
                  </p>
                  <div className="adm-links">
                    {ADM_PORTALES.slice(1).map((p) => (
                      <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"><Ic d={Icons.wallet} />{p.nombre}</a>
                    ))}
                  </div>
                </div>
              </>
            }
          />
        )}

        {pestana === "facturas" && (
          <AdmModule
            api={api}
            coleccion="FACTURAS"
            titulo="Registro de facturación"
            descripcion="Todas las facturas emitidas: cuáles se cobraron, cuáles están pendientes, montos y años."
            textoNuevo="+ Nueva factura"
            busqueda="Buscar por cliente, factura, OT…"
            panelSuperior={
              <div className="cards">
                <div className="card-kpi"><small>Total facturado</small><strong>{admDinero(kpiFacturas.total)}</strong></div>
                <div className="card-kpi"><small>Cobrado</small><strong>{admDinero(kpiFacturas.cobrado)}</strong></div>
                <div className="card-kpi"><small>Por cobrar</small><strong>{admDinero(kpiFacturas.porCobrar)}</strong></div>
                <div className="card-kpi"><small>Cobrado este mes</small><strong>{admDinero(kpiFacturas.cobradoMes)}</strong></div>
              </div>
            }
          />
        )}

        {pestana === "semanales" && <PagosSemanales api={api} user={user} conn={conn} />}
      </m.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pagos semanales: alimentado por la pestaña PAGOS existente
// (anticipos S1–S4 de la nómina) + recibos eventuales del mes.
// ─────────────────────────────────────────────
function PagosSemanales({ api, user, conn }: { api: ReturnType<typeof useAdm>; user: ReturnType<typeof useAuth>["user"]; conn: ReturnType<typeof useData>["conn"] }) {
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState(MES_ACTUAL());

  const cargar = useCallback(async () => {
    setError("");
    if (!getUrl()) { setPagos(LEER_DEMO_PAGOS()); return; }
    try {
      const r = await apiPost({ action: "pagos_list", token: user?.token });
      if (!r.ok) throw new Error(r.msg || "No se pudo cargar la nómina");
      setPagos(r.data || []);
    } catch (e) {
      setError((e as Error).message);
      setPagos(LEER_DEMO_PAGOS());
    }
  }, [user?.token]);

  useEffect(() => { void cargar(); }, [cargar]);

  const meses = useMemo(() => {
    const base = new Set<string>([MES_ACTUAL()]);
    (pagos || []).forEach((p) => { if (p.Periodo) base.add(String(p.Periodo)); });
    return [...base].sort().reverse();
  }, [pagos]);

  const delMes = useMemo(() => (pagos || []).filter((p) => String(p.Periodo) === periodo), [pagos, periodo]);
  const recibosDelMes = useMemo(() => (api.datos.RECIBOS || []).filter((r) => String(r.Fecha ?? "").startsWith(periodo) && String(r.Estado ?? "") !== "Anulado"), [api.datos.RECIBOS, periodo]);

  const totales = useMemo(() => {
    const s1 = delMes.reduce((s, p) => s + numero(p.AnticipoS1), 0);
    const s2 = delMes.reduce((s, p) => s + numero(p.AnticipoS2), 0);
    const s3 = delMes.reduce((s, p) => s + numero(p.AnticipoS3), 0);
    const s4 = delMes.reduce((s, p) => s + numero(p.AnticipoS4), 0);
    return { s1, s2, s3, s4, total: s1 + s2 + s3 + s4 };
  }, [delMes]);

  const netoRecibos = recibosDelMes.reduce((s, r) => s + numero(admCalcularFila("RECIBOS", r).Neto), 0);

  return (
    <section className="adm-modulo">
      <div className="adm-encabezado">
        <div>
          <h4>Registro de pagos semanales</h4>
          <p>Anticipos S1–S4 registrados en la nómina del mes, junto con los recibos eventuales. Los totales salen de la pestaña PAGOS: nada se duplica.</p>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 700, color: "#6d6d72" }}>
          Mes
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {meses.map((p) => <option key={p} value={p}>{nombreMes(p)}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="adm-notice error" role="alert">{error} <button className="adm-texto-accion" onClick={() => void cargar()}>Reintentar</button></p>}

      <div className="cards">
        <div className="card-kpi"><small>Anticipo semana 1</small><strong>{admDinero(totales.s1)}</strong></div>
        <div className="card-kpi"><small>Anticipo semana 2</small><strong>{admDinero(totales.s2)}</strong></div>
        <div className="card-kpi"><small>Anticipo semana 3</small><strong>{admDinero(totales.s3)}</strong></div>
        <div className="card-kpi"><small>Anticipo semana 4</small><strong>{admDinero(totales.s4)}</strong></div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Trabajador</th><th>Cédula</th><th className="col-sec">Banco</th><th className="col-sec">Cuenta</th>
              <th>Semana 1</th><th>Semana 2</th><th>Semana 3</th><th>Semana 4</th><th>Total anticipos</th>
            </tr>
          </thead>
          <tbody>
            {pagos === null && <tr><td colSpan={9} className="empty">Cargando…</td></tr>}
            {pagos !== null && delMes.length === 0 && <tr><td colSpan={9} className="empty">Sin pagos registrados en {nombreMes(periodo)}. Usa «Cerrar mes» en Nómina para generarlos.</td></tr>}
            {delMes.map((p) => {
              const total = totalAnticipos(p);
              return (
                <tr key={String(p.ID)}>
                  <td><b>{p.Nombre || p.Cedula}</b></td>
                  <td>{p.Cedula || "—"}</td>
                  <td className="col-sec">{p.Banco || "—"}</td>
                  <td className="col-sec">{p.Cuenta || "—"}</td>
                  <td>{admDinero(p.AnticipoS1)}</td>
                  <td>{admDinero(p.AnticipoS2)}</td>
                  <td>{admDinero(p.AnticipoS3)}</td>
                  <td>{admDinero(p.AnticipoS4)}</td>
                  <td><b>{admDinero(total)}</b></td>
                </tr>
              );
            })}
            {delMes.length > 0 && (
              <tr style={{ background: "#FFFBEF" }}>
                <td colSpan={4}><b>Total del mes</b></td>
                <td><b>{admDinero(totales.s1)}</b></td>
                <td><b>{admDinero(totales.s2)}</b></td>
                <td><b>{admDinero(totales.s3)}</b></td>
                <td><b>{admDinero(totales.s4)}</b></td>
                <td><b>{admDinero(totales.total)}</b></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="adm-alertas" style={{ marginTop: 14 }}>
        <h5>Recibos eventuales de {nombreMes(periodo)} <b>({recibosDelMes.length})</b></h5>
        {recibosDelMes.length === 0 && <p className="empty" style={{ padding: "10px 0" }}>Sin recibos eventuales en el mes.</p>}
        <div className="adm-alerta-lista">
          {recibosDelMes.map((r) => {
            const calc = admCalcularFila("RECIBOS", r);
            return (
              <div key={String(r.ID)} className="adm-alerta-fila ok">
                <span><b>{r.Nombre} · {r.Concepto}</b><small>Referencia: {r.Referencia || "—"} · {r.Banco || "—"}</small></span>
                <span className="pill wa">Retención {admDinero(calc.Retencion)}</span>
                <small>Neto {admDinero(calc.Neto)}</small>
              </div>
            );
          })}
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>Neto de recibos del mes: <b>{admDinero(netoRecibos)}</b> · desembolso semanal total: <b>{admDinero(totales.total)}</b>{conn === "demo" ? " (datos locales)" : ""}.</p>
      </div>
    </section>
  );
}

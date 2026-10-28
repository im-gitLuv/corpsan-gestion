"use client";
import { useMemo, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
import { crearCierreFin, mesesCerrados, montoFin, type CierreFin, type FinanzasData } from "@/lib/finanzas";
import { descargarCierre, documentoCierre, resumenCierre } from "@/lib/conciliacion";

export default function ConciliacionMensual({ data, token, usuario, configured }: { data: FinanzasData; token?: string; usuario: string; configured: boolean }) {
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
  const meses = useMemo(() => mesesCerrados(data, hoy), [data, hoy]);
  const [periodo, setPeriodo] = useState(meses.at(-1)?.periodo || ""), [cierre, setCierre] = useState<CierreFin | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [previewReady, setPreviewReady] = useState(false);
  const preview = useRef<HTMLIFrameElement>(null);
  const documento = useMemo(() => cierre ? documentoCierre(cierre).replace("</style>", ".no-print{display:none}</style>") : "", [cierre]);
  async function generar() {
    if (busy || !periodo) return;
    setBusy(true); setError(""); setCierre(null); setPreviewReady(false);
    try {
      let copia: CierreFin;
      if (configured) {
        const r = await apiPost({ action: "fin_cierre", token, periodo });
        if (!r.ok) throw new Error(r.msg === "Acción no válida" ? "Falta actualizar el backend de Google Sheets para conservar las conciliaciones mensuales." : r.msg || "No se pudo generar el documento.");
        copia = r.cierre;
      } else {
        const key = "cs_demo_cierre_" + periodo, raw = localStorage.getItem(key);
        copia = raw ? JSON.parse(raw) : crearCierreFin(data, periodo, usuario, hoy);
        if (!raw) localStorage.setItem(key, JSON.stringify(copia));
      }
      setCierre(copia);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const resumen = cierre ? resumenCierre(cierre) : null;
  return <section className="card fin-report" aria-label="Conciliación mensual de gerencia">
    <div className="fin-section-heading"><div><p className="fin-kicker">Para Mayerling · Gerencia</p><h3>Conciliación del mes cerrado</h3><p>Selecciona el mes y genera su documento completo, con todas las cuentas y sus movimientos.</p></div><span className="fin-tag">Corte validado: {String(data.control.CorteHistorico)}</span></div>
    <div className="fin-report-actions"><label>Mes cerrado<select value={periodo} disabled={busy} onChange={e => { setPeriodo(e.target.value); setCierre(null); setError(""); }}>{meses.map(m => <option key={m.periodo} value={m.periodo}>{new Date(m.periodo + "-02T12:00:00Z").toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}</select></label><button className="btn" disabled={busy || !meses.length} onClick={generar}>{busy ? "Preparando documento…" : "Generar / consultar conciliación"}</button></div>
    <p className="fin-note">Solo meses completos dentro del corte validado. El mes en curso queda excluido. Los filtros de consulta no modifican el documento. La primera generación conserva una copia mensual; las siguientes recuperan esa misma copia.</p>
    {!meses.length && <p className="fin-notice">Aún no hay meses completos validados para generar documentos.</p>}
    {error && <p role="alert" className="fin-notice">{error}</p>}
    {cierre && resumen && <div className="fin-report-result" aria-live="polite"><h4>Documento de {cierre.periodo} preparado</h4><div className="fin-report-totals"><p>Saldo inicial<strong>{resumen.inicial === null ? "Pendiente" : "Bs " + montoFin(resumen.inicial)}</strong></p><p>Entradas<strong>Bs {montoFin(resumen.entradas)}</strong></p><p>Salidas<strong>Bs {montoFin(resumen.salidas)}</strong></p><p>Cierre calculado<strong>{resumen.final === null ? "Pendiente" : "Bs " + montoFin(resumen.final)}</strong></p></div><p>{cierre.data.movimientos.length} movimientos · Copia guardada el {new Date(cierre.creado).toLocaleString("es-VE", { timeZone: "America/Caracas" })} · {cierre.usuario}</p><div className="fin-presets"><button className="btn" disabled={!previewReady} onClick={() => preview.current?.contentWindow?.print()}>Imprimir / Guardar como PDF</button><button onClick={() => descargarCierre(cierre, "html")}>Descargar documento</button><button onClick={() => descargarCierre(cierre, "csv")}>Detalle para Excel (CSV)</button></div><p className="fin-note">En impresión, selecciona «Guardar como PDF». También puedes descargar el documento y abrirlo para imprimirlo. Incluye el resumen por cuenta, depósitos, retiradas, categorías y fuentes de cada registro. Los saldos iniciales faltantes y las partidas pendientes de cotejo quedan identificados.</p><h4 className="fin-preview-title">Vista previa del documento completo</h4><iframe className="fin-document-preview" ref={preview} title={"Conciliación completa de " + cierre.periodo} sandbox="allow-same-origin allow-modals" srcDoc={documento} onLoad={() => setPreviewReady(true)}/></div>}
  </section>;
}

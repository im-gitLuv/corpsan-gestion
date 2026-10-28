import { flujos, mesesFin, saldoBase, redondearFin, fechaLegible, etiquetaSemana, type CierreFin, type Movimiento } from "./finanzas";

const escape = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const importe = (n: number | null) => n === null ? "Pendiente de saldo inicial" : new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(n);
export const conciliadoFin = (s: string) => ["si", "sí"].includes(String(s).trim().toLocaleLowerCase());
export function resumenCierre(c: CierreFin) {
  const d = c.data;
  return mesesFin(d, d.cuentas.map(a => a.Cuenta), String(d.control.CorteHistorico))[0];
}
export function documentoCierre(c: CierreFin) {
  const d = c.data, total = resumenCierre(c);
  const categoria = (r: Movimiento) => d.categorias.find(a => a.Codigo === r.Codigo)?.Nombre || "Sin clasificar";
  const tabla = (headers: string[], rows: unknown[][]) => `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((v,i) => `<td${headers[i]?.includes("Bs") ? ' class="num"' : ""}>${escape(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const porCuenta = d.cuentas.map(a => {
    const rows = d.movimientos.filter(r => r.Cuenta === a.Cuenta).sort((a,b) => a.Fecha.localeCompare(b.Fecha) || a.ID.localeCompare(b.ID));
    const f = flujos(rows), inicial = saldoBase(d, [a.Cuenta]);
    return { a, rows, f, inicial, final: inicial === null ? null : redondearFin(inicial + f.variacion) };
  });
  const categorias = new Map<string, number>();
  d.movimientos.filter(r => r.Tipo === "SALIDA").forEach(r => { const key = `${r.Codigo || "—"} · ${categoria(r)}`; categorias.set(key, redondearFin((categorias.get(key) || 0) + Number(r.Monto))); });
  const pendientes = d.movimientos.filter(r => !conciliadoFin(r.Conciliado));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Conciliación ${escape(c.periodo)} · CorpSan</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#20252b;margin:32px;line-height:1.5}h1{font-size:30px;margin:6px 0}h2{font-size:22px;border-bottom:3px solid #fdb913;padding-bottom:8px;margin-top:32px}h3{margin-top:22px}p{margin:8px 0}.brand{font-weight:bold;letter-spacing:2px}.meta{color:#4d5560}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.totals div{border:1px solid #c7ccd1;border-top:5px solid #fdb913;padding:16px}.totals b{display:block;font-size:22px;margin-top:6px}.notice{padding:12px;background:#fff8de;border:1px solid #d8b95b}table{border-collapse:collapse;width:100%;font-size:12px;margin:16px 0}th,td{border:1px solid #ccd0d5;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef0f3}thead{display:table-header-group}tr{break-inside:avoid}td:nth-last-child(2){font-variant-numeric:tabular-nums}.account{break-before:page}.source{font-size:11px;color:#4d5560}.sign{display:flex;gap:80px;margin:56px 0 24px}.sign span{border-top:1px solid;padding-top:8px;min-width:220px}button{font:inherit;font-weight:bold;background:#fdb913;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0;font-size:11px}.no-print{display:none}.totals b{font-size:18px}th{background:#eee;print-color-adjust:exact}table{font-size:10px}h2{break-after:avoid}.notice{background:#fff}.sign{break-inside:avoid}}@media(max-width:800px){body{margin:16px}.totals{grid-template-columns:1fr 1fr}.table-wrap{overflow:auto}}
  .num{text-align:right;white-space:nowrap}.table-wrap{max-width:100%;overflow:auto}@media screen and (max-width:800px){table{min-width:900px}}@media print{.table-wrap{overflow:visible}th,td{overflow-wrap:normal}}
  </style></head><body><div class="no-print"><button onclick="window.print()">Imprimir / Guardar como PDF</button><p>En impresión, selecciona «Guardar como PDF» para compartir este documento.</p></div>
  <p class="brand">CORPORACIÓN SANTAMARÍA, C.A. · RIF J-31290505-0</p><h1>Conciliación mensual · ${escape(c.periodo)}</h1><p>${escape(fechaLegible(c.periodo + "-01"))} al ${escape(fechaLegible(String(d.control.CorteHistorico)))} · Importes en bolívares</p>
  <p class="meta">Copia mensual conservada · FIN-${escape(c.periodo)} · Generada: ${escape(new Date(c.creado).toLocaleString("es-VE", { timeZone: "America/Caracas" }))} (Caracas) · Usuario: ${escape(c.usuario)}</p>
  <div class="totals"><div>Saldo inicial<b>Bs ${importe(total.inicial)}</b></div><div>Entradas / depósitos<b>Bs ${importe(total.entradas)}</b></div><div>Salidas / retiradas<b>Bs ${importe(total.salidas)}</b></div><div>Saldo final calculado<b>Bs ${importe(total.final)}</b></div></div>
  <p>Saldo inicial + entradas − salidas = saldo final. ${d.movimientos.length} movimientos del mes. Los flujos incluyen traspasos entre cuentas.</p>
  <p class="notice">Estado de revisión: ${pendientes.length} movimiento(s) sin conciliación confirmada y ${d.movimientos.filter(r => !r.Codigo).length} sin clasificar. Los saldos bancarios de los estados de cuenta y las partidas de ajuste no están cargados: la diferencia banco/libros queda pendiente de cotejo. Esta copia conserva los registros a su fecha de generación.</p>
  <h2>Resumen por cuenta</h2><div class="table-wrap">${tabla(["Cuenta / banco", "Titularidad", "Saldo inicial Bs", "Entradas Bs", "Salidas Bs", "Variación Bs", "Saldo final Bs"], porCuenta.map(({ a, f, inicial, final }) => [a.Cuenta + " · " + a.Banco, a.Titularidad, importe(inicial), importe(f.entradas), importe(f.salidas), importe(f.variacion), importe(final)]))}</div>
  <h2>En qué se utilizó el dinero</h2>${tabla(["Código / categoría", "Salidas Bs"], [...categorias].sort((a,b) => b[1]-a[1]).map(([k,n]) => [k,importe(n)]))}
  ${porCuenta.map(({ a, rows, f, inicial, final }) => `<section class="account"><h2>${escape(a.Cuenta)} · ${escape(a.Titularidad)}</h2><p>Saldo anterior: Bs ${importe(inicial)} · Depósitos: Bs ${importe(f.entradas)} · Retiradas: Bs ${importe(f.salidas)} · Saldo final: Bs ${importe(final)}</p>${["ENTRADA", "SALIDA"].map(tipo => `<h3>${tipo === "ENTRADA" ? "Depósitos / entradas" : "Retiradas / salidas"}</h3>${tabla(["Fecha / semana", "Referencia", "Concepto / contraparte", "Factura / método", "Código / categoría", "Importe Bs", "Conciliación"], rows.filter(r => r.Tipo === tipo).map(r => [r.Fecha + " · " + etiquetaSemana(r.Fecha), r.Referencia, r.Concepto + " · " + r.Contraparte, (r.Factura || "Sin factura indicada") + " · " + r.Metodo, (r.Codigo || "—") + " · " + categoria(r), importe(Number(r.Monto)), r.Conciliado || "Pendiente"]))}`).join("")}<h3>Trazabilidad de los registros</h3>${tabla(["ID", "Referencia", "Fuente de origen", "Nota de revisión"], rows.map(r => [r.ID, r.Referencia, r.Origen + " · " + r.Fuente, r.Revision]))}</section>`).join("")}
  <h2>Control y revisión</h2><p class="source">Fuente: ${escape(d.control.Fuente)}. Los saldos por cuenta sin base informada se muestran pendientes. Los meses posteriores y los filtros de pantalla no intervienen en este documento. El reporte apoya la revisión administrativa y la entrega de información al contador.</p><div class="sign"><span>Preparado por: __________________</span><span>Revisado por: __________________</span></div></body></html>`;
}
export function csvCierre(c: CierreFin) {
  // Excel interpreta fórmulas incluso dentro de una celda entre comillas.
  const celda = (v: unknown) => { const s = String(v ?? ""); return '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };
  const textoExcel = (v: string) => /^\d/.test(String(v)) ? "'" + v : v;
  const numeroExcel = (n: number | null) => n === null ? "Pendiente de saldo inicial" : n.toFixed(6).replace(".", ",");
  const resumen = resumenCierre(c);
  const rows: unknown[][] = [["Documento", "Mes", "Generado", "Usuario"], ["FIN-" + c.periodo, c.periodo, c.creado, c.usuario], [],
    ["Saldo inicial Bs", "Entradas Bs", "Salidas Bs", "Saldo final Bs"], [numeroExcel(resumen.inicial),numeroExcel(resumen.entradas),numeroExcel(resumen.salidas),numeroExcel(resumen.final)], [],
    ["Cuenta", "Titularidad", "Saldo inicial Bs", "Entradas Bs", "Salidas Bs", "Saldo final Bs"],
    ...c.data.cuentas.map(a => { const f = flujos(c.data.movimientos.filter(r => r.Cuenta === a.Cuenta)), inicial = saldoBase(c.data,[a.Cuenta]); return [a.Cuenta,a.Titularidad,numeroExcel(inicial),numeroExcel(f.entradas),numeroExcel(f.salidas),numeroExcel(inicial === null ? null : redondearFin(inicial+f.variacion))]; }), [],
    ["ID", "Fecha", "Semana", "Cuenta", "Titularidad", "Tipo", "Monto Bs", "Referencia", "Concepto", "Contraparte", "Factura", "Método", "Código", "Categoría", "Conciliado", "Origen", "Fuente", "Revisión"],
    ...c.data.movimientos.map(r => [r.ID, r.Fecha, etiquetaSemana(r.Fecha), r.Cuenta, c.data.cuentas.find(a => a.Cuenta === r.Cuenta)?.Titularidad, r.Tipo, numeroExcel(Number(r.Monto)), textoExcel(r.Referencia), r.Concepto, r.Contraparte, textoExcel(r.Factura), r.Metodo, textoExcel(r.Codigo), c.data.categorias.find(a => a.Codigo === r.Codigo)?.Nombre || "Sin clasificar", r.Conciliado, r.Origen, r.Fuente, r.Revision])];
  return "\uFEFF" + rows.map(r => r.map(celda).join(";")).join("\r\n");
}
export function descargarCierre(c: CierreFin, formato: "html" | "csv") {
  const blob = new Blob([formato === "html" ? documentoCierre(c) : csvCierre(c)], { type: formato === "html" ? "text/html;charset=utf-8" : "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `CorpSan-conciliacion-${c.periodo}.${formato}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}

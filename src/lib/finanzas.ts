import { getBusinessWeek, businessWeekLabel, accountMonths, type BalanceEdit, type ReportRequest } from './business';
export type TipoMovimiento = "ENTRADA" | "SALIDA";
export interface Movimiento {
  MetodoOriginal?: string;
  ID: string; Fecha: string; Cuenta: string; Tipo: TipoMovimiento; Monto: number;
  Referencia: string; Concepto: string; Contraparte: string; Metodo: string; Factura: string;
  Codigo: string; Conciliado: string; Origen: string; Fuente: string; Revision: string;
  TraspasoID: string; Actualizado: string;
}
export interface CuentaFin {
  AjustePeriodo?: number;
  SaldoFinalPeriodo?: number | string;
  Cuenta: string; Banco: string; Titularidad: string; Moneda: string;
  SaldoInicial: number | string; FechaSaldoInicial: string;
}
export interface CategoriaFin { Codigo: string; Nombre: string; Tipo: TipoMovimiento }
export interface FinanzasData {
  ajustes?: BalanceEdit[];
  movimientos: Movimiento[]; cuentas: CuentaFin[]; categorias: CategoriaFin[];
  control: Record<string, string | number>;
}
export const redondearFin = (v: number) => Math.round((v + Number.EPSILON) * 1e6) / 1e6;
export const montoFin = (v: number) => new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(v);
export function saldoBase(data: FinanzasData, cuentas: string[]): number | null {
  if (cuentas.length === data.cuentas.length && data.control.SaldoInicialGlobal !== "" && data.control.SaldoInicialGlobal !== undefined) {
    const n = Number(data.control.SaldoInicialGlobal);
    return Number.isFinite(n) ? n : null;
  }
  const elegidas = data.cuentas.filter((c) => cuentas.includes(c.Cuenta));
  if (!elegidas.length || elegidas.some((c) => c.SaldoInicial === "" || !Number.isFinite(Number(c.SaldoInicial)) || c.FechaSaldoInicial !== data.control.FechaSaldoInicial)) return null;
  return redondearFin(elegidas.reduce((s, c) => s + Number(c.SaldoInicial), 0));
}
export function flujos(rows: Movimiento[]) {
  let entradas = 0, salidas = 0;
  for (const r of rows) {
    if (!Number.isFinite(Number(r.Monto))) throw new Error("Movimiento con importe inválido: " + r.ID);
    if (r.Tipo === "ENTRADA") entradas = redondearFin(entradas + Number(r.Monto));
    else if (r.Tipo === "SALIDA") salidas = redondearFin(salidas + Number(r.Monto));
    else throw new Error("Movimiento con tipo inválido: " + r.ID);
  }
  return { entradas, salidas, variacion: redondearFin(entradas - salidas) };
}
export function mesesFin(data: FinanzasData, cuentas: string[], hasta: string) {
  if (data.ajustes?.length) {
    const series=cuentas.map(c=>accountMonths(data,c,hasta));
    return (series[0]||[]).map((m,i)=>{const values=series.map(s=>s[i]); const sum=(key:'inicial'|'final')=>values.some(v=>v?.[key]===null||v?.[key]===undefined)?null:redondearFin(values.reduce((s,v)=>s+Number(v[key]),0));const entradas=redondearFin(values.reduce((s,v)=>s+(v?.entradas||0),0)),salidas=redondearFin(values.reduce((s,v)=>s+(v?.salidas||0),0));return {periodo:m.periodo,inicial:sum('inicial'),final:sum('final'),entradas,salidas,variacion:redondearFin(entradas-salidas)};});
  }
  const initial = saldoBase(data, cuentas);
  let saldo = initial;
  const begin = String(data.control.FechaSaldoInicial).slice(0, 7);
  const months: { periodo: string; inicial: number | null; entradas: number; salidas: number; final: number | null; variacion: number }[] = [];
  const [year, month] = begin.split("-").map(Number);
  if (!year || !month) return months;
  let y = year, m = month;
  for (let i = 0; i < 1200; i++) {
    const periodo = `${y}-${String(m).padStart(2, "0")}`;
    if (periodo > hasta.slice(0, 7)) break;
    const f = flujos(data.movimientos.filter((r) => cuentas.includes(r.Cuenta) && r.Fecha.startsWith(periodo) && r.Fecha >= data.control.FechaSaldoInicial && r.Fecha <= hasta));
    const inicial = saldo;
    saldo = saldo === null ? null : redondearFin(saldo + f.variacion);
    months.push({ periodo, inicial, ...f, final: saldo });
    m++; if (m === 13) { m = 1; y++; }
  }
  return months;
}
// Fechas civiles en UTC: las semanas no cambian por la zona horaria del navegador.
export const fechaFin = (d: Date) => d.toISOString().slice(0, 10);
export function moverFecha(fecha: string, dias: number) {
  const d = new Date(fecha + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return fechaFin(d);
}
export function finMes(periodo: string) {
  const [y, m] = periodo.split("-").map(Number); return fechaFin(new Date(Date.UTC(y, m, 0, 12)));
}
export function inicioSemana(fecha: string) {
  return getBusinessWeek(fecha).fechaInicio;
}
export function etiquetaSemana(fecha: string) {
  return businessWeekLabel(fecha);
}
export const fechaLegible = (fecha: string) => new Date(fecha + "T12:00:00Z").toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export function semanasFin(desde: string, hasta: string, rows: Movimiento[] = []) {
  const semanas: { inicio: string; fin: string; desde: string; hasta: string; entradas: number; salidas: number; variacion: number; cantidad: number }[] = [];
  if (!desde || !hasta || desde > hasta) return semanas;
  for (let inicio = inicioSemana(desde), i = 0; inicio <= hasta && i < 5300; inicio = moverFecha(inicio, 7), i++) {
    const fin = moverFecha(inicio, 6), desdeReal = inicio < desde ? desde : inicio, hastaReal = fin > hasta ? hasta : fin;
    const movimientos = rows.filter(r => r.Fecha >= desdeReal && r.Fecha <= hastaReal);
    semanas.push({ inicio, fin, desde: desdeReal, hasta: hastaReal, ...flujos(movimientos), cantidad: movimientos.length });
  }
  return semanas;
}
export function mesesCerrados(data: FinanzasData, hoy: string) {
  return mesesFin(data, data.cuentas.map(c => c.Cuenta), String(data.control.CorteHistorico))
    .filter(m => m.periodo + "-01" >= String(data.control.FechaSaldoInicial) && finMes(m.periodo) <= String(data.control.CorteHistorico) && finMes(m.periodo) < hoy);
}
export interface CierreFin {
  version: 1 | 2; periodo: string; creado: string; usuario: string; data: FinanzasData; seleccion?: ReportRequest;
}
/** Copia mensual autocontenida: arrastra saldos anteriores sin incorporar meses posteriores. */
export function crearCierreFin(data: FinanzasData, periodo: string, usuario: string, hoy: string): CierreFin {
  if (!mesesCerrados(data, hoy).some(m => m.periodo === periodo)) throw new Error("Elige un mes completo dentro del corte validado.");
  const desde = periodo + "-01", anterior = moverFecha(desde, -1);
  const saldoAlInicio = (cuentas: string[]) => {
    const inicial = saldoBase(data, cuentas);
    return inicial === null ? null : redondearFin(inicial + flujos(data.movimientos.filter(r => cuentas.includes(r.Cuenta) && r.Fecha >= String(data.control.FechaSaldoInicial) && r.Fecha <= anterior)).variacion);
  };
  const inicial = saldoAlInicio(data.cuentas.map(c => c.Cuenta));
  return JSON.parse(JSON.stringify({ version: 1, periodo, creado: new Date().toISOString(), usuario, data: {
    movimientos: data.movimientos.filter(r => r.Fecha >= desde && r.Fecha <= finMes(periodo)),
    cuentas: data.cuentas.map(c => ({ ...c, SaldoInicial: saldoAlInicio([c.Cuenta]) ?? "", FechaSaldoInicial: desde })),
    categorias: data.categorias,
    control: { ...data.control, SaldoInicialGlobal: inicial ?? "", FechaSaldoInicial: desde, CorteHistorico: finMes(periodo) },
  } }));
}
export const FIN_DEMO: FinanzasData = {
  cuentas: [{ Cuenta: "DEMO JUR", Banco: "Banco de ejemplo", Titularidad: "Jurídica", Moneda: "Bs", SaldoInicial: 1000, FechaSaldoInicial: "2026-01-01" }],
  categorias: [{ Codigo: "2200", Nombre: "Gastos Oficina y Admon", Tipo: "SALIDA" }, { Codigo: "3200-I", Nombre: "Otros", Tipo: "ENTRADA" }],
  control: { SaldoInicialGlobal: 1000, FechaSaldoInicial: "2026-01-01", CorteHistorico: "2026-08-31", Fuente: "Datos ficticios de demostración", Moneda: "Bs" },
  movimientos: [
    { ID: "demo-in", Fecha: "2026-08-04", Cuenta: "DEMO JUR", Tipo: "ENTRADA", Monto: 800, Referencia: "EJ-001", Concepto: "Cobro de ejemplo", Contraparte: "Cliente de ejemplo", Metodo: "TRANSFERENCIA", Factura: "", Codigo: "3200-I", Conciliado: "Pendiente", Origen: "Demo", Fuente: "Demo", Revision: "", TraspasoID: "", Actualizado: "" },
    { ID: "demo-out", Fecha: "2026-08-09", Cuenta: "DEMO JUR", Tipo: "SALIDA", Monto: 200, Referencia: "EJ-002", Concepto: "Material de oficina de ejemplo", Contraparte: "Proveedor de ejemplo", Metodo: "TRANSFERENCIA", Factura: "", Codigo: "2200", Conciliado: "Pendiente", Origen: "Demo", Fuente: "Demo", Revision: "", TraspasoID: "", Actualizado: "" },
  ],
};

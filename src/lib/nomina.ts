/**
 * Nómina y Pagos — cálculo compartido (espejo exacto de calcNomina en Code.gs)
 * Fórmulas de la plantilla de recibos de CorpSan. Los pagos históricos conservan
 * su esquema original; los nuevos distribuyen el 100 % del total de Talento Humano.
 */

export interface Pago {
  ID?: string;
  Periodo: string;
  Cedula: string;
  Nombre?: string;
  Cargo?: string;
  FechaIngreso?: string;
  Banco?: string;
  Cuenta?: string;
  Estado?: string;
  TasaBCV: number | string;
  SalarioIntegralUSD: number | string;
  PctSueldo?: number | string;
  PctDisp?: number | string;
  PctResp?: number | string;
  PctRepr?: number | string;
  PctAntig?: number | string;
  DistribucionVersion?: number | string;
  PctLimpieza?: number | string;
  PctPuntual?: number | string;
  PctMovilidad?: number | string;
  PctCoordin?: number | string;
  BonoLimpieza?: number | string;
  BonoPuntual?: number | string;
  BonoMovilidad?: number | string;
  BonoCoordin?: number | string;
  BonoProductiv?: number | string;
  PctCestaticket?: number | string;
  AsistencialUSD?: number | string;
  PctIVSS?: number | string;
  PctParo?: number | string;
  PctFAOV?: number | string;
  PctISLR?: number | string;
  AnticiposBs?: number | string;
  [k: string]: any;
}

export const PAGOS_DEFAULTS = {
  PctSueldo: 0.2, PctDisp: 0.1, PctResp: 0.15, PctRepr: 0, PctAntig: 0.08,
  DistribucionVersion: 2,
  PctLimpieza: 0.05, PctPuntual: 0.02, PctMovilidad: 0.05, PctCoordin: 0.15,
  BonoLimpieza: 0, BonoPuntual: 0, BonoMovilidad: 0, BonoCoordin: 0, BonoProductiv: 0,
  PctCestaticket: 0.2, AsistencialUSD: 0,
  PctIVSS: 0.04, PctParo: 0.005, PctFAOV: 0.01, PctISLR: 0.1232, AnticiposBs: 0,
};

export const DISTRIBUCION_NOMINA = [
  { key: "PctSueldo", label: "Sueldo básico", max: 0.20, referencias: [0.20, 0.18, 0.16, 0.15] },
  { key: "PctDisp", label: "Prima por disponibilidad", max: 0.10, referencias: [0.10, 0.05, 0.03, 0] },
  { key: "PctResp", label: "Prima por responsabilidad", max: 0.15, referencias: [0.15, 0.10, 0.05, 0] },
  { key: "PctRepr", label: "Prima por representación", max: 0.15, referencias: [0.15, 0.10, 0.05, 0] },
  { key: "PctAntig", label: "Prima por antigüedad", max: 0.10, referencias: [0.10, 0.05, 0.03, 0] },
  { key: "PctCestaticket", label: "Cestaticket", max: 0.20, referencias: [0.20, 0.18, 0.16, 0.15] },
  { key: "PctLimpieza", label: "Orden y limpieza", max: 0.05, referencias: [0.05, 0.04, 0.03, 0] },
  { key: "PctPuntual", label: "Puntualidad", max: 0.02, referencias: [0.02, 0.015, 0.01, 0] },
  { key: "PctMovilidad", label: "Movilidad (transporte)", max: 0.05, referencias: [0.05, 0.03, 0.02, 0] },
  { key: "PctCoordin", label: "Coordinación", max: 0.15, referencias: [0.15, 0.10, 0.08, 0] },
] as const;

export type DistribucionKey = typeof DISTRIBUCION_NOMINA[number]["key"];

/** Opciones sin decimales escritos a mano; 0,5 % permite representar el 1,5 % de la tabla. */
export function opcionesPorcentaje(max: number): number[] {
  const values: number[] = [];
  for (let value = 0; value <= max + 0.000001; value += 0.005) values.push(Math.round(value * 1000) / 1000);
  return values.reverse();
}

export function distribucionDesde(source: Record<string, any>): Record<DistribucionKey, number> {
  return Object.fromEntries(DISTRIBUCION_NOMINA.map(({ key }) => [key, Number(source[key] ?? PAGOS_DEFAULTS[key])])) as Record<DistribucionKey, number>;
}

export function totalDistribucion(source: Record<string, any>): number {
  return DISTRIBUCION_NOMINA.reduce((total, { key }) => total + (Number(source[key]) || 0), 0);
}

export function validarDistribucion(source: Record<string, any>): string {
  for (const field of DISTRIBUCION_NOMINA) {
    const value = Number(source[field.key]);
    if (!Number.isFinite(value) || value < 0 || value > field.max + 0.000001) {
      return `${field.label} debe estar entre 0 % y ${fmtPct(field.max)}`;
    }
  }
  const total = totalDistribucion(source);
  return Math.abs(total - 1) <= 0.000001 ? "" : `La distribución debe sumar 100 %. Actualmente suma ${fmtPct(total)}.`;
}

export const r2 = (v: number) => Math.round(v * 100) / 100;

export function diasYlunes(periodo: string): { dias: number; lunes: number } {
  const y = Number(String(periodo).slice(0, 4));
  const m = Number(String(periodo).slice(5, 7));
  if (!y || !m) return { dias: 0, lunes: 0 };
  const dias = new Date(y, m, 0).getDate();
  let lunes = 0;
  for (let d = 1; d <= dias; d++) if (new Date(y, m - 1, d).getDay() === 1) lunes++;
  return { dias, lunes };
}

export interface CalcNomina {
  dias: number; lunes: number;
  sueldo: number; disp: number; resp: number; repr: number; antig: number;
  totalA: number; totalB: number;
  cesta: number; asistencial: number; totalC: number;
  ivssBs: number; paroBs: number; faovBs: number; islrBs: number; anticiposBs: number;
  totalDeduccBs: number;
  totalAsignacionesBs: number; netoBs: number; netoUsd: number;
}

export function calcNomina(p: Pago): CalcNomina {
  if (p.Origen === "Historico Excel") {
    let snapshot: CalcNomina;
    try { snapshot = JSON.parse(String(p.CalculoHistorico)); }
    catch { throw new Error("El recibo histórico no contiene su detalle original"); }
    const keys: (keyof CalcNomina)[] = ["dias", "lunes", "sueldo", "disp", "resp", "repr", "antig", "totalA", "totalB", "cesta", "asistencial", "totalC", "ivssBs", "paroBs", "faovBs", "islrBs", "anticiposBs", "totalDeduccBs", "totalAsignacionesBs", "netoBs", "netoUsd"];
    if (keys.some((k) => typeof snapshot[k] !== "number" || !Number.isFinite(snapshot[k]))) {
      throw new Error("El detalle del recibo histórico está incompleto");
    }
    return snapshot;
  }
  const n = (v: any, def = 0) => { const x = Number(v); return isNaN(x) ? def : x; };
  const { dias, lunes } = diasYlunes(String(p.Periodo));
  const tasa = n(p.TasaBCV);
  const si = n(p.SalarioIntegralUSD);

  const sueldo = si * n(p.PctSueldo, PAGOS_DEFAULTS.PctSueldo);
  const disp = si * n(p.PctDisp, PAGOS_DEFAULTS.PctDisp);
  const resp = si * n(p.PctResp, PAGOS_DEFAULTS.PctResp);
  const repr = si * n(p.PctRepr, PAGOS_DEFAULTS.PctRepr);
  const antig = si * n(p.PctAntig, PAGOS_DEFAULTS.PctAntig);
  const totalA = sueldo + disp + resp + repr + antig;

  const distribucionV2 = Number(p.DistribucionVersion) >= 2;
  const limpieza = distribucionV2 ? si * n(p.PctLimpieza) : n(p.BonoLimpieza);
  const puntual = distribucionV2 ? si * n(p.PctPuntual) : n(p.BonoPuntual);
  const movilidad = distribucionV2 ? si * n(p.PctMovilidad) : n(p.BonoMovilidad);
  const coordin = distribucionV2 ? si * n(p.PctCoordin) : n(p.BonoCoordin);
  const totalB = limpieza + puntual + movilidad + coordin + (distribucionV2 ? 0 : n(p.BonoProductiv));

  const cesta = si * n(p.PctCestaticket, PAGOS_DEFAULTS.PctCestaticket);
  const asistencial = n(p.AsistencialUSD);
  const totalC = cesta + asistencial;

  const sueldoBs = sueldo * tasa;
  const ivssBs = (sueldoBs * 12 / 52) * n(p.PctIVSS, PAGOS_DEFAULTS.PctIVSS) * lunes;
  const paroBs = sueldoBs * n(p.PctParo, PAGOS_DEFAULTS.PctParo);
  const faovBs = sueldoBs * n(p.PctFAOV, PAGOS_DEFAULTS.PctFAOV);
  const islrBs = sueldoBs * n(p.PctISLR, PAGOS_DEFAULTS.PctISLR);
  const anticiposBs = n(p.AnticiposBs);
  const totalDeduccBs = ivssBs + paroBs + faovBs + islrBs + anticiposBs;

  const totalAsignacionesBs = (totalA + totalB + totalC) * tasa;
  const netoBs = totalAsignacionesBs - totalDeduccBs;

  return {
    dias, lunes, sueldo, disp, resp, repr, antig, totalA, totalB,
    cesta, asistencial, totalC,
    ivssBs, paroBs, faovBs, islrBs, anticiposBs, totalDeduccBs,
    totalAsignacionesBs, netoBs, netoUsd: tasa ? netoBs / tasa : 0,
  };
}

/** 1.287.883,80 (formato es-VE) */
export function fmtBs(v: number): string {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

/** % legible: 0.04 → "4%" */
export function fmtPct(v: any): string {
  const n = Number(v);
  if (!n) return "0%";
  const pct = n * 100;
  return (Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0$/, "")) + "%";
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function mesNombre(periodo: string): string {
  const m = Number(String(periodo).slice(5, 7));
  return MESES[m - 1] || "";
}
export function mesCorto(periodo: string): string {
  const m = Number(String(periodo).slice(5, 7));
  return MESES_CORTOS[m - 1] || "";
}
export function anioDe(periodo: string): string {
  return String(periodo).slice(0, 4);
}
/** "1-ago-26 al 31-ago-26" */
export function rangoPeriodo(periodo: string): [string, string] {
  const { dias } = diasYlunes(periodo);
  const y2 = String(periodo).slice(2, 4);
  return [`1-${mesCorto(periodo)}-${y2}`, `${dias}-${mesCorto(periodo)}-${y2}`];
}

/** Fecha de ingreso "2003-05-10" → "10-may-05" (estilo del recibo) */
export function fmtFechaRecibo(v: any): string {
  const s = String(v ?? "");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s || "—";
  return `${Number(m[3])}-${MESES_CORTOS[Number(m[2]) - 1]}-${m[1].slice(2)}`;
}

/** Cédula numérica → "V- 15.631.387" (presentación en el recibo) */
export function fmtCedula(v: any): string {
  const s = String(v ?? "").replace(/[^0-9]/g, "");
  if (!s) return "—";
  return "V- " + s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

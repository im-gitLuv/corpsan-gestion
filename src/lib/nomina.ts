/**
 * Nómina y Pagos — cálculo compartido (espejo exacto de calcNomina en Code.gs)
 * Fórmulas invariables de la plantilla de recibos de CorpSan.
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
  BonoLimpieza: 0, BonoPuntual: 0, BonoMovilidad: 0, BonoCoordin: 0, BonoProductiv: 0,
  PctCestaticket: 0.2, AsistencialUSD: 0,
  PctIVSS: 0.04, PctParo: 0.005, PctFAOV: 0.01, PctISLR: 0.1232, AnticiposBs: 0,
};

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

  const totalB =
    n(p.BonoLimpieza) + n(p.BonoPuntual) + n(p.BonoMovilidad) + n(p.BonoCoordin) + n(p.BonoProductiv);

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

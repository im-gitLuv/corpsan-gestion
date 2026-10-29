// Fuente compartida con Apps Script mediante scripts/sync-domain.cjs.
import type { FinanzasData, Movimiento, CuentaFin } from './finanzas';

export function civilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida');
  const d = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error('Fecha inválida');
  return d;
}
export function shiftDay(value: string, days: number) { const d = civilDate(value); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function firstBusinessSaturday(year: number) { const jan = `${year}-01-01`; return shiftDay(jan, (6 - civilDate(jan).getUTCDay() + 7) % 7); }
export function getBusinessWeek(fecha: string) {
  const start = shiftDay(fecha, -((civilDate(fecha).getUTCDay() + 1) % 7));
  let year = civilDate(fecha).getUTCFullYear();
  if (start < firstBusinessSaturday(year)) year--;
  const numeroSemana = 1 + Math.round((civilDate(start).getTime() - civilDate(firstBusinessSaturday(year)).getTime()) / 604800000);
  return { numeroSemana, fechaInicio: start, fechaFin: shiftDay(start, 6), año: year };
}
export function getRangoSemana(year: number, week: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 9998 || !Number.isInteger(week) || week < 1) throw new Error('Semana inválida');
  const start = shiftDay(firstBusinessSaturday(year), (week - 1) * 7);
  if (start >= firstBusinessSaturday(year + 1)) throw new Error('Semana inexistente en ese año');
  return getBusinessWeek(start);
}
export function businessWeekLabel(fecha: string) { const w = getBusinessWeek(fecha), short = (s: string) => s.slice(8) + '/' + s.slice(5,7); return `Semana ${w.numeroSemana} (${short(w.fechaInicio)} – ${short(w.fechaFin)})`; }
export const PAYMENT_METHODS = ['Transferencia', 'Pago Móvil', 'Tarjeta de Débito', 'Biopago', 'Efectivo', 'Cheque', 'Otro'] as const;
export function normalizedText(v: unknown) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim(); }
export function paymentMethod(v: unknown): string {
  const n = normalizedText(v);
  if (/^(PM|P M|PAGO MOVIL|PAGOMOVIL)$/.test(n)) return 'Pago Móvil';
  if (/^(TD|T D|DEBITO|TARJETA DEBITO|TARJETA DE DEBITO|PUNTO|PUNTO DE VENTA)$/.test(n)) return 'Tarjeta de Débito';
  if (/^(TRANSFERENCIA|TRANSFER|TRANSF|TRF)$/.test(n)) return 'Transferencia';
  if (n === 'BIOPAGO') return 'Biopago';
  if (n === 'EFECTIVO') return 'Efectivo';
  if (n === 'CHEQUE') return 'Cheque';
  return n ? 'Otro' : 'Sin indicar';
}
export type AccountKind = 'Personal' | 'Jurídico';
export function accountKind(c?: CuentaFin): AccountKind | '' {
  if (!c) return '';
  const n = normalizedText(c.Titularidad);
  if (/^(PERSONAL|PERS)$/.test(n)) return 'Personal';
  if (/^(JURIDIC[AO]|JUR)$/.test(n)) return 'Jurídico';
  return '';
}
export function bankName(c?: CuentaFin) {
  if (!c) return 'Banco pendiente';
  const n = normalizedText(c.Banco + ' ' + c.Cuenta);
  if (/\b(BDV|VENEZUELA)\b/.test(n)) return 'Banco de Venezuela (BDV)';
  if (/\b(BNC|NACIONAL DE CREDITO)\b/.test(n)) return 'Banco Nacional de Crédito (BNC)';
  if (/\b(BPL|BPLS|BANPLUS)\b/.test(n)) return 'Banplus (BPLS)';
  if (/\b(MERC|BMC|MERCANTIL)\b/.test(n)) return 'Banco Mercantil (BMC)';
  if (/\b(PROV|BPR|PROVINCIAL)\b/.test(n)) return 'Banco Provincial (BPR)';
  return String(c.Banco || 'Banco pendiente');
}
export function incompleteMovement(r: Movimiento, data: FinanzasData) { const c = data.cuentas.find(c => c.Cuenta === r.Cuenta); return !c || !c.Banco || !accountKind(c); }
export function methodTotals(rows: Movimiento[]) { const totals: Record<string,{ entradas: number; salidas: number }> = {}; rows.forEach(r => { const k = paymentMethod(r.Metodo), t = totals[k] ||= { entradas: 0, salidas: 0 }; if (r.Tipo === 'ENTRADA') t.entradas = roundMoney(t.entradas + Number(r.Monto)); else t.salidas = roundMoney(t.salidas + Number(r.Monto)); }); return totals; }
export function roundMoney(v: number) { return Math.round((v + Number.EPSILON) * 1e6) / 1e6; }
export function numericBalance(v: unknown): number | null { if (v === '' || v === null || v === undefined || typeof v === 'boolean' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(v).trim())) return null; const n = Number(v); return Number.isFinite(n) ? roundMoney(n) : null; }
export function monthEnd(period: string) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Mes inválido'); return new Date(Date.UTC(Number(period.slice(0,4)), Number(period.slice(5)), 0,12)).toISOString().slice(0,10); }
export function nextMonth(p: string) { return shiftDay(monthEnd(p), 1).slice(0,7); }
export interface BalanceEdit { ID: string; Cuenta: string; Periodo: string; Valor: number; Oficial: number | string; Usuario: string; Fecha: string; Motivo: string; Anterior?: number | string; }
export function activeBalanceEdits(data: FinanzasData, account: string) {
  const active: BalanceEdit[] = [];
  (data.ajustes || []).filter(a => a.Cuenta === account).forEach(a => { for (let i = active.length - 1; i >= 0; i--) if (active[i].Periodo >= a.Periodo) active.splice(i,1); active.push(a); });
  return active;
}
// Saldo absoluto por cuenta: ningún saldo global se reparte entre bancos.
export function accountBalance(data: FinanzasData, account: string, through: string): number | null {
  civilDate(through);
  const c = data.cuentas.find(c => c.Cuenta === account); if (!c) throw new Error('Cuenta inválida');
  let start = String(c.FechaSaldoInicial || data.control.FechaSaldoInicial), balance = numericBalance(c.SaldoInicial);
  if (through < start) return null;
  for (const a of activeBalanceEdits(data, account).sort((a,b) => a.Periodo.localeCompare(b.Periodo))) {
    const date = a.Periodo + '-01'; if (date <= through) { start = date; balance = a.Valor; }
  }
  if (balance === null) return null;
  return roundMoney(balance + data.movimientos.filter(r => r.Cuenta === account && r.Fecha >= start && r.Fecha <= through).reduce((sum,r) => sum + (r.Tipo === 'ENTRADA' ? Number(r.Monto) : -Number(r.Monto)),0));
}
export function periodBalance(data: FinanzasData, account: string, from: string) {
  const c = data.cuentas.find(c => c.Cuenta === account); if (!c) throw new Error('Cuenta inválida');
  const edit = activeBalanceEdits(data,account).find(a => a.Periodo + '-01' === from);
  if (edit) return edit.Valor;
  if (from === c.FechaSaldoInicial) return numericBalance(c.SaldoInicial);
  return accountBalance(data,account,shiftDay(from,-1));
}
export function accountMonths(data: FinanzasData, account: string, through: string) {
  const result: {periodo: string; inicial: number|null; entradas: number; salidas: number; final: number|null; oficial: number|null; discrepancia: boolean}[] = [];
  const c = data.cuentas.find(c => c.Cuenta === account); if (!c) throw new Error('Cuenta inválida');
  for (let p = String(c.FechaSaldoInicial || data.control.FechaSaldoInicial).slice(0,7), i=0; p <= through.slice(0,7) && i < 1200; p=nextMonth(p),i++) {
    const initial = periodBalance(data,account,p+'-01'), end = monthEnd(p) < through ? monthEnd(p) : through;
    const rows = data.movimientos.filter(r => r.Cuenta === account && r.Fecha >= p+'-01' && r.Fecha <= end);
    const entradas = roundMoney(rows.filter(r => r.Tipo==='ENTRADA').reduce((s,r)=>s+Number(r.Monto),0)), salidas = roundMoney(rows.filter(r=>r.Tipo==='SALIDA').reduce((s,r)=>s+Number(r.Monto),0));
    const final = accountBalance(data,account,end), oficial = numericBalance([...(data.ajustes||[])].reverse().find(a=>a.Cuenta===account&&a.Periodo===p&&numericBalance(a.Oficial)!==null)?.Oficial);
    result.push({periodo:p,inicial:initial,entradas,salidas,final,oficial,discrepancia:oficial!==null && initial!==null && Math.abs(oficial-initial)>0.000001});
  }
  return result;
}
export function financeRevision(data: FinanzasData) { const s=JSON.stringify([data.movimientos,data.cuentas,data.ajustes||[]]); let h=2166136261; for(let i=0;i<s.length;i++) h=Math.imul(h ^ s.charCodeAt(i),16777619); return (h>>>0).toString(16); }
export function balancePreview(data: FinanzasData, account: string, period: string, value: unknown, official: unknown, today: string, reason='') {
  monthEnd(period); civilDate(today);
  const c=data.cuentas.find(c=>c.Cuenta===account), n=numericBalance(value);
  if(!c || !accountKind(c) || !c.Banco) throw new Error('Completa banco y tipo de cuenta antes de corregir su saldo.');
  if(n===null) throw new Error('El saldo debe ser un número válido y no puede estar vacío.');
  if(period<String(c.FechaSaldoInicial||data.control.FechaSaldoInicial).slice(0,7) || period>today.slice(0,7)) throw new Error('Elige un mes entre el inicio del control y el mes actual.');
  if(official!=='' && official!==undefined && numericBalance(official)===null) throw new Error('Saldo oficial inválido');
  const edit: BalanceEdit={ID:'preview',Cuenta:account,Periodo:period,Valor:n,Oficial:numericBalance(official)??'',Usuario:'',Fecha:'',Motivo:reason};
  const updated={...data,ajustes:[...(data.ajustes||[]),edit]};
  return {revision:financeRevision(data),edit,anterior:periodBalance(data,account,period+'-01'),afectados:accountMonths(updated,account,today).filter(m=>m.periodo>=period),reemplazados:activeBalanceEdits(data,account).filter(a=>a.Periodo>=period).length};
}
export interface ReportRequest { tipo: AccountKind; banco?: string; desde: string; hasta: string; modo: 'mes'|'semana'|'rango'; }
export function reportData(data: FinanzasData, request: ReportRequest, today: string) {
  if (!['Personal','Jurídico'].includes(request.tipo)) throw new Error('El reporte requiere un único tipo: Personal o Jurídico.');
  civilDate(request.desde); civilDate(request.hasta); civilDate(today);
  if(request.desde>request.hasta || request.hasta>today || request.desde<String(data.control.FechaSaldoInicial)) throw new Error('Rango de fechas inválido');
  if(!['mes','semana','rango'].includes(request.modo)) throw new Error('Período inválido');
  if(request.modo==='mes' && (request.desde.slice(8)!=='01'||request.hasta!==monthEnd(request.desde.slice(0,7))||request.hasta>=today||request.hasta>String(data.control.CorteHistorico))) throw new Error('Elige un mes cerrado dentro del corte validado.');
  if(request.modo==='semana') { const w=getBusinessWeek(request.desde); if(w.fechaInicio!==request.desde||w.fechaFin!==request.hasta) throw new Error('La semana empresarial va de sábado a viernes.'); }
  const accounts=data.cuentas.filter(c=>accountKind(c)===request.tipo&&(!request.banco||bankName(c)===request.banco));
  if(!accounts.length || accounts.some(c=>!c.Banco)) throw new Error('No hay cuentas completas para esa selección.');
  const ids=accounts.map(c=>c.Cuenta);
  const movements=data.movimientos.filter(r=>ids.includes(r.Cuenta)&&r.Fecha>=request.desde&&r.Fecha<=request.hasta);
  if(movements.some(r=>incompleteMovement(r,data))) throw new Error('Hay movimientos sin banco o tipo de cuenta. Corrígelos antes de emitir.');
  return {...data,ajustes:[],movimientos:movements,cuentas:accounts.map(c=>{
    const initial=periodBalance(data,c.Cuenta,request.desde),final=accountBalance(data,c.Cuenta,request.hasta),net=movements.filter(r=>r.Cuenta===c.Cuenta).reduce((s,r)=>s+(r.Tipo==='ENTRADA'?Number(r.Monto):-Number(r.Monto)),0);
    return {...c,SaldoInicial:initial??'',SaldoFinalPeriodo:final??'',AjustePeriodo:initial===null||final===null?0:roundMoney(final-initial-net),FechaSaldoInicial:request.desde};
  }),control:{...data.control,SaldoInicialGlobal:'',FechaSaldoInicial:request.desde,CorteHistorico:request.hasta}} as FinanzasData;
}

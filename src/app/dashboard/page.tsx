"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, useReducedMotion } from "motion/react";
import { Ic, Icons } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { apiPost, isConfigured } from "@/lib/api";
import { docsCompletos } from "@/lib/columns";
import { FIN_DEMO, flujos, montoFin, type FinanzasData } from "@/lib/finanzas";
import { accountBalance, accountKind, incompleteMovement, normalizedText, type AccountKind } from "@/lib/business";
import type { Pago } from "@/lib/nomina";
import type { Empleado } from "@/lib/types";
import "./resumen.css";

const todayCaracas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
const monthLabel = (p: string) => new Date(`${p}-02T12:00:00Z`).toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });
const money = (n: number) => `Bs ${montoFin(n)}`;

function birthdays(rows: Empleado[], today: string) {
  const year = Number(today.slice(0, 4)), now = new Date(`${today}T12:00:00Z`);
  return rows.flatMap(e => {
    const birth = /^\d{4}-(\d{2})-(\d{2})/.exec(String(e.fechaNac || ""));
    if (!birth) return [];
    for (const y of [year, year + 1]) {
      const date = new Date(Date.UTC(y, Number(birth[1]) - 1, Number(birth[2]), 12));
      if (date.getUTCMonth() !== Number(birth[1]) - 1) continue;
      const days = Math.round((date.getTime() - now.getTime()) / 86400000);
      if (days >= 0 && days <= 30) return [{ name: String(e.nombre || "Sin nombre"), date: date.toLocaleDateString("es-VE", { day: "2-digit", month: "short", timeZone: "UTC" }), days, key: String(e.cedula || e.nombre) }];
    }
    return [];
  }).sort((a, b) => a.days - b.days);
}

export default function Resumen() {
  const { user } = useAuth();
  const { activos, conn, error: peopleError, recargar } = useData();
  const reduceMotion = useReducedMotion();
  const [finance, setFinance] = useState<FinanzasData | null>(null);
  const [payroll, setPayroll] = useState<Pago[] | null>(null);
  const [financeError, setFinanceError] = useState("");
  const [payrollError, setPayrollError] = useState("");
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<AccountKind>("Jurídico");
  const [period, setPeriod] = useState("");
  const today = todayCaracas(), currentMonth = today.slice(0, 7);

  const load = useCallback(async () => {
    setLoading(true); setFinanceError(""); setPayrollError("");
    if (!isConfigured()) {
      try { setFinance(JSON.parse(localStorage.getItem("cs_demo_finanzas") || "null") || FIN_DEMO); }
      catch { setFinance(FIN_DEMO); }
      try { setPayroll((JSON.parse(localStorage.getItem("cs_demo_pagos") || "[]") as Pago[]).filter(p => p.Periodo === currentMonth)); }
      catch { setPayroll([]); }
      setLoading(false); return;
    }
    const [f, p] = await Promise.allSettled([
      user?.token ? apiPost({ action: "fin_list", token: user.token }) : Promise.reject(new Error("Inicia sesión de nuevo para consultar Finanzas.")),
      apiPost({ action: "pagos_list", periodo: currentMonth, token:user?.token }),
    ]);
    if (f.status === "fulfilled" && f.value.ok) setFinance({ movimientos: f.value.movimientos || [], cuentas: f.value.cuentas || [], categorias: f.value.categorias || [], control: f.value.control || {}, ajustes: f.value.ajustes || [] });
    else { setFinance(null); setFinanceError(f.status === "rejected" ? String(f.reason?.message || f.reason) : f.value.msg || "No se pudieron cargar los datos financieros."); }
    if (p.status === "fulfilled" && p.value.ok) setPayroll(p.value.data || []);
    else { setPayroll(null); setPayrollError(p.status === "rejected" ? String(p.reason?.message || p.reason) : p.value.msg || "No se pudo cargar la nómina."); }
    setLoading(false);
  }, [user?.token, currentMonth]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const onVisible = () => { if (document.visibilityState === "visible") void load(); }; document.addEventListener("visibilitychange", onVisible); return () => document.removeEventListener("visibilitychange", onVisible); }, [load]);

  const accounts = useMemo(() => finance?.cuentas.filter(c => accountKind(c) === kind) || [], [finance, kind]);
  const rows = useMemo(() => finance?.movimientos.filter(r => accounts.some(c => c.Cuenta === r.Cuenta)) || [], [finance, accounts]);
  const months = useMemo(() => [...new Set([currentMonth, ...rows.filter(r => r.Fecha <= today).map(r => r.Fecha.slice(0, 7))])].sort().reverse(), [rows, currentMonth, today]);
  const selected = period && months.includes(period) ? period : (months.find(p => rows.some(r => r.Fecha.startsWith(p))) || currentMonth);
  const invalidAmounts = rows.filter(r => r.Fecha <= today && (!Number.isFinite(Number(r.Monto)) || !["ENTRADA", "SALIDA"].includes(r.Tipo))).length;
  const flow = flujos(rows.filter(r => r.Fecha.startsWith(selected) && r.Fecha <= today && Number.isFinite(Number(r.Monto)) && ["ENTRADA", "SALIDA"].includes(r.Tipo)));
  const pending = rows.filter(r => r.Fecha <= today && normalizedText(r.Conciliado) !== "SI").length;
  const unclassified = rows.filter(r => r.Fecha <= today && !r.Codigo).length;
  const incompleteFinance = finance?.movimientos.filter(r => r.Fecha <= today && incompleteMovement(r, finance)).length || 0;
  const through = selected === currentMonth ? today : new Date(Date.UTC(Number(selected.slice(0, 4)), Number(selected.slice(5)), 0, 12)).toISOString().slice(0, 10);
  const balances = finance && accounts.length ? accounts.map(c => { try { return accountBalance(finance, c.Cuenta, through); } catch { return null; } }) : [];
  const balance = balances.length && balances.every(v => v !== null && Number.isFinite(Number(v))) ? balances.reduce<number>((sum, v) => sum + Number(v), 0) : null;
  const incompleteDocs = activos.filter(e => { const [ok, total] = docsCompletos(e); return ok < total; }).length;
  const upcoming = birthdays(activos, today);
  const pendingPayroll = payroll?.filter(p => !["VALIDADO", "PAGADO"].includes(normalizedText(p.Estado))).length || 0;
  const busy = loading || conn === "cargando";

  const metrics = [
    { label: "Entradas", value: finance ? money(flow.entradas) : "—", detail: "Movimientos recibidos", tone: "income" },
    { label: "Salidas", value: finance ? money(flow.salidas) : "—", detail: "Movimientos pagados", tone: "expense" },
    { label: "Variación neta", value: finance ? money(flow.variacion) : "—", detail: "Entradas menos salidas", tone: "net" },
    { label: "Saldo calculado", value: finance ? balance === null ? "Pendiente" : money(balance) : "—", detail: "Por cuenta, al cierre del período", tone: "balance" },
  ];

  return <div className="overview">
    <m.section className="overview-hero" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}><div><span className="overview-eyebrow">CENTRO DE CONTROL · CORPSAN</span><h1>Todo lo importante,<br/><em>en un solo lugar.</em></h1><p>Actividad financiera, personal y tareas que requieren atención.</p></div><div className="overview-hero-actions"><span className="overview-date">{new Date(`${today}T12:00:00Z`).toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}</span><button onClick={() => { void recargar(); void load(); }} disabled={busy}>↻ {busy ? "Actualizando" : "Actualizar panel"}</button></div></m.section>

    <section className="overview-section" aria-labelledby="ov-fin"><div className="overview-section-head"><div><span className="overview-eyebrow">01 / FINANZAS</span><h2 id="ov-fin">Pulso financiero</h2><p>Flujos bancarios del mes · no representan ventas ni utilidad.</p></div><Link className="overview-text-link" href="/dashboard/finanzas">Abrir Finanzas ↗</Link></div><div className="overview-controls"><div className="overview-segment" role="group" aria-label="Tipo de cuenta"><button aria-pressed={kind === "Jurídico"} onClick={() => { setKind("Jurídico"); setPeriod(""); }}>Jurídico</button><button aria-pressed={kind === "Personal"} onClick={() => { setKind("Personal"); setPeriod(""); }}>Personal</button></div><label>Período<select value={selected} onChange={e => setPeriod(e.target.value)} disabled={!finance}>{months.map(p => <option key={p} value={p}>{monthLabel(p)}</option>)}</select></label><span className="overview-period-note">{accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"} · corte validado: {String(finance?.control.CorteHistorico || "—")}</span></div>
      {financeError && <p className="overview-error" role="alert">Finanzas: {financeError} <button onClick={() => void load()}>Reintentar</button></p>}
      <div className="overview-metrics" aria-busy={loading}>{metrics.map((item, i) => <m.div key={item.label} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: reduceMotion ? 0 : i * 0.04 }}><Link href="/dashboard/finanzas" className={`overview-metric ${item.tone}`}><span className="overview-metric-top"><span>{item.label}</span><span aria-hidden="true">↗</span></span>{loading && !finance ? <span className="overview-shimmer"/> : <strong>{item.value}</strong>}<small>{item.detail}</small></Link></m.div>)}</div>
      {finance && !accounts.length && <p className="overview-empty">No hay cuentas de tipo {kind} clasificadas.</p>}
    </section>

    <div className="overview-lower"><section className="overview-section" aria-labelledby="ov-people"><div className="overview-section-head"><div><span className="overview-eyebrow">02 / EQUIPO Y NÓMINA</span><h2 id="ov-people">Personas y pagos</h2></div></div><div className="overview-people-grid"><Link href="/dashboard/talento-humano" className="overview-small-card"><span className="overview-icon"><Ic d={Icons.users}/></span><span>Personal activo</span><strong>{conn === "cargando" ? "—" : activos.length}</strong><small>Ver expedientes ↗</small></Link><Link href="/dashboard/nomina" className="overview-small-card"><span className="overview-icon"><Ic d={Icons.wallet}/></span><span>Pagos registrados</span><strong>{payroll === null ? "—" : payroll.length}</strong><small>{monthLabel(currentMonth)} ↗</small></Link><Link href="/dashboard/talento-humano" className="overview-small-card"><span className="overview-icon"><Ic d={Icons.doc}/></span><span>Expedientes por completar</span><strong>{conn === "cargando" ? "—" : incompleteDocs}</strong><small>Del personal activo ↗</small></Link></div>{peopleError && <p className="overview-error" role="alert">Talento Humano usa datos locales porque falló la conexión: {peopleError}</p>}{payrollError && <p className="overview-error" role="alert">Nómina: {payrollError}</p>}</section>

    <section className="overview-section overview-attention" aria-labelledby="ov-alert"><div className="overview-section-head"><div><span className="overview-eyebrow">03 / SEGUIMIENTO</span><h2 id="ov-alert">Requiere atención</h2></div></div><div className="overview-alert-list">
      {finance && pending > 0 && <Alert href="/dashboard/finanzas?panel=gerencia" tone="amber" title={`${pending} movimientos sin conciliar`} detail={`Cuentas ${kind.toLowerCase()}s · histórico disponible`}/>}
      {finance && unclassified > 0 && <Alert href="/dashboard/finanzas" tone="blue" title={`${unclassified} movimientos sin clasificar`} detail="Revisa categorías en Finanzas"/>}
      {finance && incompleteFinance > 0 && <Alert href="/dashboard/finanzas" tone="red" title={`${incompleteFinance} movimientos con cuenta incompleta`} detail="Falta banco o titularidad"/>}
      {finance && invalidAmounts > 0 && <Alert href="/dashboard/finanzas" tone="red" title={`${invalidAmounts} movimientos con importe o tipo inválido`} detail="Revisa los datos de origen"/>}
      {conn !== "cargando" && incompleteDocs > 0 && <Alert href="/dashboard/talento-humano" tone="violet" title={`${incompleteDocs} expedientes físicos incompletos`} detail="Personal activo"/>}
      {payroll && pendingPayroll > 0 && <Alert href="/dashboard/nomina" tone="amber" title={`${pendingPayroll} pagos por revisar`} detail={monthLabel(currentMonth)}/>}
      {busy && <p className="overview-empty">Revisando los datos de cada módulo…</p>}
      {!busy && !financeError && !payrollError && !peopleError && !pending && !unclassified && !incompleteFinance && !invalidAmounts && !incompleteDocs && !pendingPayroll && <p className="overview-empty">Sin pendientes detectados en los datos disponibles.</p>}
    </div></section></div>

    <section className="overview-section overview-birthdays" aria-labelledby="ov-birthdays"><div className="overview-section-head"><div><span className="overview-eyebrow">PRÓXIMOS 30 DÍAS</span><h2 id="ov-birthdays"><Ic d={Icons.cake}/> Cumpleaños del equipo</h2></div><Link className="overview-text-link" href="/dashboard/talento-humano">Ver personal ↗</Link></div><div className="overview-birthday-list">{conn === "cargando" ? <p className="overview-empty">Cargando cumpleaños…</p> : upcoming.length ? upcoming.slice(0, 6).map(c => <Link href="/dashboard/talento-humano" key={c.key} className="overview-birthday"><span className="overview-birthday-avatar">{c.name.trim().charAt(0).toUpperCase()}</span><span><b>{c.name}</b><small>{c.days === 0 ? "Hoy" : c.days === 1 ? "Mañana" : `En ${c.days} días`}</small></span><time>{c.date}</time></Link>) : <p className="overview-empty">No hay cumpleaños del personal activo en los próximos 30 días.</p>}</div></section>
  </div>;
}

function Alert({ href, tone, title, detail }: { href: string; tone: string; title: string; detail: string }) {
  return <Link href={href} className="overview-alert"><span className={`overview-alert-dot ${tone}`}/><span><b>{title}</b><small>{detail}</small></span><span aria-hidden="true">↗</span></Link>;
}

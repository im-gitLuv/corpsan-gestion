"use client";

/**
 * Nómina y Pagos — flujo mensual:
 *  1. Indica la tasa BCV del mes y pulsa "Cerrar mes" → crea un pago por cada
 *     trabajador activo (snapshot de salario y datos, tasa congelada).
 *  2. Revisa/ajusta conceptos por trabajador (bonos, anticipos, % de ISLR…).
 *  3. Imprime el recibo de cada trabajador (vista idéntica a la plantilla).
 * Incluye resumen anual en Bs y USD con la tasa de cada mes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Ic, Icons } from "@/components/icons";
import { useToast } from "@/components/Toaster";
import { MonthPicker } from "@/components/MonthPicker";
import { apiPost, getUrl, isConfigured } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import type { Empleado } from "@/lib/types";
import {
  calcNomina, PAGOS_DEFAULTS, r2, fmtBs, mesNombre, type Pago,
} from "@/lib/nomina";


const LS_DEMO = "cs_demo_pagos";
const PERIODO_ACTUAL = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function calcularDemo(pago: Pago): Pago {
  const calc = calcNomina(pago);
  return { ...pago, NetoBs: r2(calc.netoBs), NetoUSD: r2(calc.netoUsd) };
}

function leerDemo(): Pago[] {
  try { return (JSON.parse(localStorage.getItem(LS_DEMO) || "[]") as Pago[]).map(calcularDemo); } catch { return []; }
}
function guardarDemo(rows: Pago[]) { localStorage.setItem(LS_DEMO, JSON.stringify(rows)); }

export default function Nomina() {
  const {user}=useAuth();
  const { toast } = useToast();
  const { activos, inactivos, conn } = useData();
  const [grupo, setGrupo] = useState("ACTIVO");
  const [periodo, setPeriodo] = useState(PERIODO_ACTUAL());
  const [tasa, setTasa] = useState("");
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [edit, setEdit] = useState<Pago | null>(null);
  const [q, setQ] = useState("");
  const cargaActual = useRef(0);

  useEffect(() => {
    const anterior = sessionStorage.getItem("cs_nomina_periodo");
    const filtro = sessionStorage.getItem("cs_nomina_grupo");
    if (anterior && /^\d{4}-(0[1-9]|1[0-2])$/.test(anterior)) setPeriodo(anterior);
    if (filtro && ["ACTIVO", "INACTIVO", "TODOS", "SIN VINCULO"].includes(filtro)) setGrupo(filtro);
  }, []);

  const cargar = useCallback(async (p: string) => {
    const solicitud = ++cargaActual.current;
    setCargando(true);
    if (!isConfigured()) { setPagos(leerDemo().filter((x) => x.Periodo === p)); setCargando(false); return; }
    try {
      const r = await apiPost({ action: "pagos_list", periodo: p, token:user?.token });
      if (!r.ok) throw new Error(r.msg || "Error al cargar pagos");
      if (solicitud === cargaActual.current) setPagos(r.data || []);
    } catch (e: any) {
      if (solicitud !== cargaActual.current) return;
      toast("No se pudieron cargar los pagos: " + e.message, true);
      setPagos([]);
    } finally {
      if (solicitud === cargaActual.current) setCargando(false);
    }
  }, [toast,user?.token]);

  useEffect(() => { cargar(periodo); }, [periodo, cargar]);

  async function cerrarMes() {
    if (!Number(tasa)) return toast("Indica la tasa BCV al último día del mes", true);
    if (!window.confirm(
      `¿Cerrar ${mesNombre(periodo)} con tasa BCV ${tasa}?\n\n` +
      `Se creará un pago por cada trabajador activo (${activos.length}) con sus datos y salario actuales.\n` +
      `Los pagos ya existentes del mes no se tocan.`)) return;
    setCerrando(true);
    try {
      if (!isConfigured()) {
        // demo: crear pagos locales de ejemplo
        const demo = leerDemo();
        const nuevos = activos.map((a, i) => {
          const id = `PG-${periodo.replace("-", "")}-${a.cedula}`;
          if (demo.some((d) => d.ID === id)) return null;
          const base = {
            ...PAGOS_DEFAULTS,
            ID: id, Periodo: periodo, Cedula: String(a.cedula), Nombre: a.nombre,
            Cargo: a.cargo || "", FechaIngreso: a.ingresoReal || "", Banco: a.banco || "",
            Cuenta: a.nCuenta || "", Estado: "Calculado", TasaBCV: Number(tasa),
            SalarioIntegralUSD: Number(a.totalRemuneracion) || 0,
          } as Pago;
          return calcularDemo(base);
        }).filter(Boolean) as Pago[];
        guardarDemo([...demo, ...nuevos]);
        toast(`(Demo) ${nuevos.length} pagos creados para ${mesNombre(periodo)}`);
      } else {
        const r = await apiPost({ action: "cerrar_mes", periodo, tasa: Number(tasa), token:user?.token });
        if (!r.ok) throw new Error(r.msg || "Error al cerrar el mes");
        toast(r.msg || "Mes cerrado");
      }
      await cargar(periodo);
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setCerrando(false);
    }
  }

  async function guardarPago(data: Pago) {
    const nuevo = !data.ID;
    const id = data.ID || `PG-${data.Periodo.replace("-", "")}-${data.Cedula}`;
    if (isConfigured()) {
      const r = await apiPost({ action: nuevo ? "pagos_create" : "pagos_save", data, token:user?.token });
      if (!r.ok) throw new Error(r.msg || "Error al guardar");
    } else {
      const demo = leerDemo();
      const i = demo.findIndex((d) => d.ID === id);
      if (nuevo && i >= 0) throw new Error("Ya existe un pago para este trabajador y período. Abre el registro existente para consultarlo o editarlo.");
      const completo = calcularDemo({ ...data, ID: id });
      if (i >= 0) demo[i] = completo; else demo.push(completo);
      guardarDemo(demo);
    }
    toast(nuevo ? "Nuevo pago registrado" : "Pago guardado");
    setEdit(null);
    if (nuevo) {
      const persona = [...activos, ...inactivos].find((a) => String(a.cedula) === String(data.Cedula));
      const filtro = persona?.estado === "INACTIVO" ? "INACTIVO" : "ACTIVO";
      setGrupo(filtro);
      setQ("");
      sessionStorage.setItem("cs_nomina_grupo", filtro);
    }
    sessionStorage.setItem("cs_nomina_periodo", data.Periodo);
    if (data.Periodo !== periodo) setPeriodo(data.Periodo);
    else await cargar(periodo);
  }

  async function eliminarPago(p: Pago) {
    if (!window.confirm(`¿Eliminar el pago de ${p.Nombre} (${mesNombre(p.Periodo)})?\n\nSe borra la fila del sheet PAGOS.`)) return;
    try {
      if (isConfigured()) {
        const r = await apiPost({ action: "pagos_del", id: p.ID, token:user?.token });
        if (!r.ok) throw new Error(r.msg);
      } else {
        guardarDemo(leerDemo().filter((d) => d.ID !== p.ID));
      }
      toast("Pago eliminado");
      await cargar(periodo);
    } catch (e: any) { toast(e.message, true); }
  }

  const pagosDelGrupo = useMemo<Pago[]>(() => {
    const key = (v: unknown) => String(v ?? "").replace(/\D/g, "");
    const personas = new Map([...activos, ...inactivos].map((a) => [key(a.cedula), a]));
    return pagos.map((p) => {
      const persona = conn === "ok" || !isConfigured() ? personas.get(key(p.Cedula)) : undefined;
      return { ...p, EstadoLaboral: persona?.estado || "SIN VINCULO" };
    }).filter((p) => grupo === "TODOS" || p.EstadoLaboral === grupo);
  }, [pagos, activos, inactivos, grupo, conn]);

  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pagosDelGrupo;
    return pagosDelGrupo.filter((p) =>
      [p.Nombre, p.Cedula, p.Cargo, p.Estado].some((v) => String(v ?? "").toLowerCase().includes(s))
    );
  }, [pagosDelGrupo, q]);

  const totalBs = pagosDelGrupo.reduce((s, p) => s + (Number(p.NetoBs) || 0), 0);
  const totalUsd = pagosDelGrupo.reduce((s, p) => s + (Number(p.NetoUSD) || 0), 0);
  const maxBs = Math.max(1, ...pagosDelGrupo.map((p) => Number(p.NetoBs) || 0));

  return (
    <div>
      {/* ── Cerrar mes ── */}
      <div className="panel">
        <h3>Cerrar {mesNombre(periodo)} de {periodo.slice(0, 4)}</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          La tasa se congela en cada pago: el histórico nunca se recalcula. Los pagos ya existentes no se tocan.
        </p>
        <div className="cfg-row">
          <MonthPicker value={periodo} onChange={(valor) => { setPeriodo(valor); sessionStorage.setItem("cs_nomina_periodo", valor); }} />
          <input
            type="number" step="any" placeholder="Tasa BCV al último día del mes"
            value={tasa} onChange={(e) => setTasa(e.target.value)} style={{ maxWidth: 280 }}
          />
          <button className="btn sm" onClick={cerrarMes} disabled={cerrando || !getUrl() && false}>
            {cerrando ? "Cerrando…" : "Cerrar mes"}
          </button>
        </div>
      </div>

      {/* ── Tabla del mes ── */}
      <div className="toolbar">
        <label>Situación actual del trabajador
          <select value={grupo} onChange={(e) => { setGrupo(e.target.value); sessionStorage.setItem("cs_nomina_grupo", e.target.value); }}>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
            <option value="TODOS">Todos</option>
            <option value="SIN VINCULO">Sin vínculo con Talento Humano</option>
          </select>
        </label>
        <div className="search" style={{ width: "min(280px,100%)" }}>
          <Ic d={Icons.search} />
          <input
            placeholder="Buscar trabajador…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className={"badge " + (cargando ? "load" : "ok")} style={{ marginLeft: 0 }}>
          {cargando ? "Cargando…" : `${pagosDelGrupo.length} pagos`}
        </span>
        <button className="btn sm" disabled={cargando || cerrando || (isConfigured() && conn !== "ok")}
          onClick={() => setEdit({ ...PAGOS_DEFAULTS, Periodo: periodo, Cedula: "", TasaBCV: tasa, SalarioIntegralUSD: 0, Estado: "Calculado", Origen: "WebApp" })}>
          + Nuevo pago
        </button>
      </div>

      {pagosDelGrupo.some((p) => p.Origen === "Historico Excel") && <p className="tiny">Históricos importados como valores originales, pendientes de revisión. Las observaciones señalan diferencias del archivo fuente. El estado laboral se consulta en Talento Humano y no acredita el pago.</p>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Cédula</th>
              <th>Cargo</th>
              <th>Salario Integral</th>
              <th>Tasa BCV</th>
              <th>Neto (Bs)</th>
              <th>Neto (USD)</th>
              <th>Estado</th>
              <th className="col-acc"></th>
            </tr>
          </thead>
          <tbody>
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={9} className="empty">Sin pagos para {mesNombre(periodo)} — usa «Nuevo pago» o «Cerrar mes»</td></tr>
            )}
            {visibles.map((p) => (
              <tr key={p.ID || p.Cedula}>
                <td><b>{p.Nombre}</b><small style={{ display: "block" }}>{p.EstadoLaboral}</small></td>
                <td>{p.Cedula}</td>
                <td>{p.Cargo}</td>
                <td>{fmtBs(Number(p.SalarioIntegralUSD) || 0)}</td>
                <td>{p.TasaBCV}</td>
                <td><b>{fmtBs(Number(p.NetoBs) || 0)}</b></td>
                <td>{fmtBs(Number(p.NetoUSD) || 0)}</td>
                <td>
                  <span className={"pill " + (String(p.Estado).toLowerCase() === "validado" || String(p.Estado).toLowerCase() === "pagado" ? "ok" : "wa")}>
                    {p.Estado || "Calculado"}
                  </span>
                  {p.Observaciones && <details><summary>Observaciones del original</summary><p style={{ maxWidth: 300, whiteSpace: "normal" }}>{p.Observaciones}</p></details>}
                </td>
                <td className="col-acc">
                  <div className="acc">
                    <button className="mini" disabled={p.Origen === "Historico Excel"} title={p.Origen === "Historico Excel" ? "Histórico original: importes conservados sin recálculo" : "Editar conceptos"} onClick={() => setEdit(p)}><Ic d={Icons.edit} /></button>
                    <Link
                      className="mini" title="Imprimir recibo"
                      href={`/dashboard/nomina/recibo?periodo=${p.Periodo}&cedula=${p.Cedula}`}
                    ><Ic d={Icons.doc} /></Link>
                    <button className="mini danger" title="Eliminar" onClick={() => eliminarPago(p)}><Ic d={Icons.trash} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Resumen del mes ── */}
      {pagosDelGrupo.length > 0 && (
        <div className="panel" style={{ marginTop: 22 }}>
          <h3>Resumen de {mesNombre(periodo)}</h3>
          <div className="cards" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 0 }}>
            <div className="card-kpi"><small>Pagos del mes</small><strong>{pagosDelGrupo.length}</strong></div>
            <div className="card-kpi"><small>Nómina neta (Bs)</small><strong>{fmtBs(totalBs)}</strong></div>
            <div className="card-kpi"><small>Nómina neta (USD)</small><strong>{fmtBs(totalUsd)}</strong></div>
          </div>
          <div style={{ marginTop: 18 }}>
            {pagosDelGrupo.slice().sort((a, b) => (Number(b.NetoBs) || 0) - (Number(a.NetoBs) || 0)).map((p) => (
              <div className="bar-row" key={p.ID}>
                <span className="bar-label">{p.Nombre}</span>
                <div className="bar-track"><div className="bar" style={{ width: Math.round((Number(p.NetoBs) || 0) / maxBs * 100) + "%" }}></div></div>
                <span className="bar-val">{fmtBs(Number(p.NetoBs) || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="tiny">
        La tasa y los importes se registran por período. La ficha actual se consulta en Talento Humano.
        Los históricos conservan el detalle original del Excel, incluidas sus observaciones; no se recalculan con las reglas actuales.
        Abre el ícono de documento para consultar e imprimir el recibo.
      </p>

      {edit && <PagoModal pago={edit} trabajadores={[...activos, ...inactivos]} onGuardar={guardarPago} onCerrar={() => setEdit(null)} />}
    </div>
  );
}

/* ═══════════ Editor de pago con cálculo en vivo ═══════════ */
function PagoModal({ pago, trabajadores, onGuardar, onCerrar }: {
  pago: Pago;
  trabajadores: Empleado[];
  onGuardar: (p: Pago) => Promise<void>;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<Pago>({ ...pago });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const nuevo = !pago.ID;
  const calc = useMemo(() => calcNomina(form), [form]);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function elegirTrabajador(cedula: string) {
    const a = trabajadores.find((p) => String(p.cedula) === cedula);
    setForm((f) => ({ ...f, Cedula: cedula, Nombre: a?.nombre || "", Cargo: a?.cargo || "",
      FechaIngreso: a?.ingresoReal || "", Banco: a?.banco || "", Cuenta: a?.nCuenta || "",
      SalarioIntegralUSD: a ? Number(a.totalRemuneracion) || (Number(a.sueldoMensual) || 0) + (Number(a.bonoAlimentacion) || 0) + (Number(a.ayudaUnica) || 0) : 0 }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.Cedula) return setError("Selecciona un trabajador");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.Periodo)) return setError("Selecciona un período válido");
    if (!Number.isFinite(Number(form.TasaBCV)) || Number(form.TasaBCV) <= 0) return setError("Indica una tasa BCV mayor que cero");
    if (!Number.isFinite(Number(form.SalarioIntegralUSD)) || Number(form.SalarioIntegralUSD) < 0) return setError("Revisa el salario integral");
    setGuardando(true);
    try { await onGuardar(form); }
    catch (err: any) { setError(err.message || "Error al guardar"); }
    finally { setGuardando(false); }
  }

  const P = (label: string, k: string, pct = false) => (
    <label>{label}
      <input
        type="number" step={pct ? "0.0001" : "any"}
        value={String(form[k] ?? "")}
        onChange={(e) => set(k, e.target.value)}
      />
    </label>
  );

  return (
    <div className="overlay open" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form className="modal wide" onSubmit={enviar}>
        <h3>{nuevo ? "Nuevo pago" : form.Nombre} — {mesNombre(form.Periodo)} de {form.Periodo.slice(0, 4)}</h3>

        {nuevo && <div className="form-section">
          <h4>Trabajador y período</h4>
          <div className="grid2">
            <label>Trabajador
              <select required value={form.Cedula} onChange={(e) => elegirTrabajador(e.target.value)}>
                <option value="">Selecciona un trabajador…</option>
                {["ACTIVO", "INACTIVO"].map((estado) => <optgroup key={estado} label={estado === "ACTIVO" ? "Activos" : "Inactivos"}>
                  {trabajadores.filter((a) => (a.estado || "ACTIVO") === estado).map((a) => <option key={String(a.cedula)} value={String(a.cedula)}>{a.nombre} · {a.cedula}</option>)}
                </optgroup>)}
              </select>
            </label>
            <div><span>Período</span><MonthPicker value={form.Periodo} onChange={(valor) => set("Periodo", valor)} /></div>
          </div>
          {form.Cedula && <p className="tiny">{form.Cargo || "Sin cargo registrado"} · Banco: {form.Banco || "Sin registrar"} · Cuenta: {form.Cuenta || "Sin registrar"}</p>}
          <p className="tiny">Los datos se toman de Talento Humano. Revisa la remuneración y la tasa del período antes de guardar. Los porcentajes se expresan en decimales: 0.20 equivale a 20 %.</p>
        </div>}

        <div className="form-section">
          <h4>Datos del mes</h4>
          <div className="grid2">
            <label>Tasa BCV (congelada)
              <input type="number" required min="0.000001" step="any" value={String(form.TasaBCV ?? "")} onChange={(e) => set("TasaBCV", e.target.value)} />
            </label>
            <label>Estado
              <select value={String(form.Estado || "Calculado")} onChange={(e) => set("Estado", e.target.value)}>
                {["Calculado", "Pagado", "Validado"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h4>Salario integral y primas (% del salario integral)</h4>
          <div className="grid2">
            {P("Salario integral mensual (USD)", "SalarioIntegralUSD")}
            {P("Sueldo básico %", "PctSueldo", true)}
            {P("Prima por Disponibilidad %", "PctDisp", true)}
            {P("Prima por Responsabilidad %", "PctResp", true)}
            {P("Prima por Representación %", "PctRepr", true)}
            {P("Prima por Antigüedad %", "PctAntig", true)}
          </div>
        </div>

        <div className="form-section">
          <h4>Bonificaciones (USD, monto manual)</h4>
          <div className="grid2">
            {P("Orden y Limpieza", "BonoLimpieza")}
            {P("Puntualidad", "BonoPuntual")}
            {P("Movilidad (Transporte)", "BonoMovilidad")}
            {P("Coordinación", "BonoCoordin")}
            {P("Productividad", "BonoProductiv")}
            {P("Cestaticket %", "PctCestaticket", true)}
            {P("Bonif. Especial Asistencial (USD)", "AsistencialUSD")}
          </div>
        </div>

        <div className="form-section">
          <h4>Deducciones (sobre el sueldo básico en Bs)</h4>
          <div className="grid2">
            {P("IVSS %", "PctIVSS", true)}
            {P("Paro Forzoso %", "PctParo", true)}
            {P("FAOV %", "PctFAOV", true)}
            {P("I.S.L.R. % (Formulario ARI)", "PctISLR", true)}
            {P("Anticipos / Préstamos (Bs)", "AnticiposBs")}
          </div>
        </div>

        <div className="form-section">
          <h4>Totales calculados (fórmulas de la plantilla)</h4>
          <div className="grid2">
            <label>Total Salario Normal (A)<input disabled value={fmtBs(calc.totalA) + " USD"} /></label>
            <label>Total Bonificaciones (B)<input disabled value={fmtBs(calc.totalB) + " USD"} /></label>
            <label>Total No Salarial (C)<input disabled value={fmtBs(calc.totalC) + " USD"} /></label>
            <label>Total Deducciones<input disabled value={fmtBs(calc.totalDeduccBs) + " Bs"} /></label>
            <label>Total a pagar (Bs)<input disabled value={fmtBs(calc.netoBs)} /></label>
            <label>Total a pagar (USD)<input disabled value={fmtBs(calc.netoUsd)} /></label>
          </div>
        </div>

        {error && <p style={{ color: "var(--danger)", fontWeight: 700, fontSize: 14 }}>{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn sm ghost" disabled={guardando} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn sm" disabled={guardando}>{guardando ? "Guardando…" : nuevo ? "Crear pago" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}

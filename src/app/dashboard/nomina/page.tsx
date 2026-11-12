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
import NominaSkeleton from "@/components/NominaSkeleton";
import SlideTabs from "@/components/SlideTabs";
import Desplegable from "@/components/Desplegable";
import "./nomina.css";
import { apiPost, getUrl, isConfigured } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import type { Empleado } from "@/lib/types";
import {
  calcNomina, DISTRIBUCION_NOMINA, PAGOS_DEFAULTS, anticipoSemanas, distribucionDesde,
  fmtBs, fmtPct, mesNombre, opcionesPorcentaje, r2, totalAnticipos, totalDistribucion,
  validarDistribucion, type Pago,
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
const cedulaKey = (value: unknown) => String(value ?? "").replace(/\D/g, "");
/**
 * La celda "Total remuneración" de Talento Humano es la fuente autorizada
 * para abrir un pago. No se reconstruye a partir de otros campos: una ficha
 * incompleta debe corregirse primero en Talento Humano.
 */
const remuneracionRegistrada = (a?: Empleado) => {
  if (!a || a.totalRemuneracion === "" || a.totalRemuneracion === null || a.totalRemuneracion === undefined) return 0;
  const total = Number(a.totalRemuneracion);
  return Number.isFinite(total) && total > 0 ? total : 0;
};

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

  const cargar = useCallback(async () => {
    const solicitud = ++cargaActual.current;
    setCargando(true);
    if (!isConfigured()) { setPagos(leerDemo()); setCargando(false); return; }
    try {
      // Sin «periodo»: el backend devuelve todos los pagos y el filtro por período
      // se hace en el cliente; así se alimenta también el desembolso anual.
      const r = await apiPost({ action: "pagos_list", token:user?.token });
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

  useEffect(() => { cargar(); }, [periodo, cargar]);

  function abrirEditor(pago: Pago) {
    // Al corregir un importado se conserva su cálculo fuente y se deja una
    // marca explícita de corrección; no se sobrescribe como histórico intacto.
    setEdit(pago.Origen === "Historico Excel" ? { ...pago, Origen: "Historico Excel corregido" } : pago);
  }

  async function cerrarMes() {
    if (!Number(tasa)) return toast("Indica la tasa BCV al último día del mes", true);
    const sinRemuneracion = activos.filter((a) => !remuneracionRegistrada(a));
    if (sinRemuneracion.length) {
      return toast(`No se creó ningún pago. Completa «Total remuneración» en Talento Humano para: ${sinRemuneracion.map((a) => a.nombre || a.cedula).join(", ")}.`, true);
    }
    if (!window.confirm(
      `¿Cerrar ${mesNombre(periodo)} con tasa BCV ${tasa}?\n\n` +
      `Se creará un pago por cada trabajador activo (${activos.length}) con sus datos y remuneración de Talento Humano.\n` +
      `Los pagos ya existentes del mes no se tocan.`)) return;
    setCerrando(true);
    try {
      if (!isConfigured()) {
        // demo: crear pagos locales de ejemplo
        const demo = leerDemo();
        const nuevos = activos.map((a, i) => {
          const id = `PG-${periodo.replace("-", "")}-${a.cedula}`;
          if (demo.some((d) => d.Periodo === periodo && cedulaKey(d.Cedula) === cedulaKey(a.cedula))) return null;
          const base = {
            ...PAGOS_DEFAULTS,
            ID: id, Periodo: periodo, Cedula: String(a.cedula), Nombre: a.nombre,
            Cargo: a.cargo || "", FechaIngreso: a.ingresoReal || "", Banco: a.banco || "",
            Cuenta: a.nCuenta || "", Estado: "Calculado", TasaBCV: Number(tasa),
            ...distribucionDesde(a), DistribucionVersion: 2,
            SalarioIntegralUSD: remuneracionRegistrada(a),
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
      await cargar();
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
      if (!r.ok && r.existente) {
        setPeriodo(r.existente.Periodo);
        setGrupo("TODOS");
        setQ("");
        abrirEditor(r.existente);
        toast(r.msg || "Ese pago ya existe; se abrió el registro.", true);
        return;
      }
      if (!r.ok) throw new Error(r.msg || "Error al guardar");
    } else {
      const demo = leerDemo();
      const i = demo.findIndex((d) => d.Periodo === data.Periodo && cedulaKey(d.Cedula) === cedulaKey(data.Cedula));
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
    else await cargar();
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
      await cargar();
    } catch (e: any) { toast(e.message, true); }
  }

  const delPeriodo = useMemo(() => pagos.filter((p) => p.Periodo === periodo), [pagos, periodo]);
  const pagosDelGrupo = useMemo<Pago[]>(() => {
    const key = (v: unknown) => String(v ?? "").replace(/\D/g, "");
    const personas = new Map([...activos, ...inactivos].map((a) => [key(a.cedula), a]));
    return delPeriodo.map((p) => {
      const persona = conn === "ok" || !isConfigured() ? personas.get(key(p.Cedula)) : undefined;
      return { ...p, EstadoLaboral: persona?.estado || "SIN VINCULO" };
    }).filter((p) => grupo === "TODOS" || p.EstadoLaboral === grupo);
  }, [delPeriodo, activos, inactivos, grupo, conn]);

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
  const anio = periodo.slice(0, 4);

  // Anticipos del mes por semana (solo pagos con desglose semanal).
  const anticiposSemana = useMemo(() => {
    const semanas = [0, 0, 0, 0];
    pagosDelGrupo.forEach((p) => {
      const s = anticipoSemanas(p);
      if (s) s.forEach((v, i) => { semanas[i] += v; });
    });
    return semanas;
  }, [pagosDelGrupo]);
  const hayAnticiposSemana = pagosDelGrupo.some((p) => anticipoSemanas(p));

  // Primera carga: skeleton que reproduce la estructura real de la página
  // (mismo patrón que Finanzas), para que no haya saltos ni sensación de página vacía.
  if (cargando && !pagos.length) return <NominaSkeleton />;

  return (
    <div aria-busy={cargando}>
      {conn === "demo" && <p className="demo-notice">Demostración: estos pagos son ficticios y se guardan solo en este navegador.</p>}

      {/* Recarga con datos ya presentes: aviso no bloqueante mientras llegan los pagos */}
      {cargando && <div className="nom-refresh" role="status"><span className="nom-refresh-bar" /><span>Actualizando pagos…</span></div>}

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
              <th>Remuneración total (TH)</th>
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
                <td><b>{fmtBs(Number(p.NetoUSD) || 0)}</b></td>
                <td>
                  <span className={"pill " + (String(p.Estado).toLowerCase() === "validado" || String(p.Estado).toLowerCase() === "pagado" ? "ok" : "wa")}>
                    {p.Estado || "Calculado"}
                  </span>
                  {p.Observaciones && <details className="cell-details"><summary>Observaciones del original</summary><p>{p.Observaciones}</p></details>}
                </td>
                <td className="col-acc">
                  <div className="acc">
                    <button
                      className="mini"
                      title={p.Origen === "Historico Excel" ? "Editar y corregir el pago importado" : "Editar conceptos"}
                      onClick={() => abrirEditor(p)}
                    ><Ic d={Icons.edit} /></button>
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
          <div className="cards trio" style={{ marginBottom: 0 }}>
            <div className="card-kpi"><small>Pagos del mes</small><strong>{pagosDelGrupo.length}</strong></div>
            <div className="card-kpi"><small>Nómina neta (Bs)</small><strong>{fmtBs(totalBs)}</strong></div>
            <div className="card-kpi"><small>Nómina neta (USD)</small><strong>{fmtBs(totalUsd)}</strong></div>
          </div>
          {hayAnticiposSemana && (
            <p className="tiny" style={{ marginTop: 14, marginBottom: 0 }}>
              Anticipos por semana: {anticiposSemana.map((v, i) => `Semana ${i + 1}: Bs ${fmtBs(v)}`).join(" · ")}
              <b> · Total: Bs {fmtBs(anticiposSemana.reduce((s, v) => s + v, 0))}</b>
            </p>
          )}
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

      {/* ── Total de desembolso por nómina (vista anual: mes, persona y concepto) ── */}
      {/* Va debajo del resumen del mes, cerrado por defecto; se despliega solo
          cuando el usuario llega hasta él bajando con el scroll. */}
      <ResumenDesembolso pagos={pagos} anio={anio} />

      <p className="tiny">
        La tasa y los importes se registran por período. La ficha actual se consulta en Talento Humano.
        Los históricos conservan el detalle original del Excel, incluidas sus observaciones; no se recalculan con las reglas actuales.
        Abre el ícono de documento para consultar e imprimir el recibo.
      </p>

      {edit && <PagoModal pago={edit} trabajadores={[...activos, ...inactivos]} onGuardar={guardarPago} onCerrar={() => setEdit(null)} />}
    </div>
  );
}

/* ═══════════ Resumen anual de desembolso: por mes, persona y concepto ═══════════ */
function ResumenDesembolso({ pagos, anio }: { pagos: Pago[]; anio: string }) {
  const [vista, setVista] = useState<"mes" | "persona" | "concepto">("mes");
  const [modoConcepto, setModoConcepto] = useState<"anual" | "trimestre" | "mes">("anual");
  const [trimestre, setTrimestre] = useState(1);
  const [mesConcepto, setMesConcepto] = useState(`${anio}-01`);

  const porMes = useMemo(() => {
    const meses = new Map<string, Pago[]>();
    pagos.filter((p) => p.Periodo.startsWith(anio)).forEach((p) => {
      meses.set(p.Periodo, [...(meses.get(p.Periodo) || []), p]);
    });
    return [...meses.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pagos, anio]);
  const suma = (list: Pago[], campo: "NetoBs" | "NetoUSD") => list.reduce((s, p) => s + (Number(p[campo]) || 0), 0);
  const anualBs = porMes.reduce((s, [, l]) => s + suma(l, "NetoBs"), 0);
  const anualUsd = porMes.reduce((s, [, l]) => s + suma(l, "NetoUSD"), 0);
  const anualPagos = porMes.reduce((s, [, l]) => s + l.length, 0);
  const maxMesBs = Math.max(1, ...porMes.map(([, l]) => suma(l, "NetoBs")));
  const tasaMes = (list: Pago[]) => {
    const tasas = [...new Set(list.map((p) => String(Number(p.TasaBCV) || "").replace(".", ",")).filter(Boolean))];
    return tasas.length === 1 ? tasas[0] : tasas.length > 1 ? "Varias" : "—";
  };

  // Por persona: anual con desglose por trimestre calendario (declaración INCES).
  const porPersona = useMemo(() => {
    const mapa = new Map<string, { cedula: string; nombre: string; pagos: number; trim: number[]; totalBs: number; totalUsd: number }>();
    pagos.filter((p) => p.Periodo.startsWith(anio)).forEach((p) => {
      const key = String(p.Cedula || p.Nombre || "?");
      const item = mapa.get(key) || { cedula: key, nombre: String(p.Nombre || key), pagos: 0, trim: [0, 0, 0, 0], totalBs: 0, totalUsd: 0 };
      const mes = Number(String(p.Periodo).slice(5, 7));
      item.pagos += 1;
      item.trim[Math.max(0, Math.min(3, Math.floor((mes - 1) / 3)))] += Number(p.NetoBs) || 0;
      item.totalBs += Number(p.NetoBs) || 0;
      item.totalUsd += Number(p.NetoUSD) || 0;
      mapa.set(key, item);
    });
    return [...mapa.values()].sort((a, b) => b.totalBs - a.totalBs);
  }, [pagos, anio]);

  // Por concepto pagado según el rango elegido (anual, trimestre o mes).
  const rangoConcepto = useMemo(() => {
    if (modoConcepto === "anual") return { desde: `${anio}-01`, hasta: `${anio}-12`, etiqueta: `Año ${anio}` };
    if (modoConcepto === "trimestre") {
      const meses = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].slice((trimestre - 1) * 3, trimestre * 3);
      return { desde: `${anio}-${meses[0]}`, hasta: `${anio}-${meses[2]}`, etiqueta: `Trimestre ${trimestre} · ${anio}` };
    }
    return { desde: mesConcepto, hasta: mesConcepto, etiqueta: `${mesNombre(mesConcepto)} de ${mesConcepto.slice(0, 4)}` };
  }, [modoConcepto, trimestre, mesConcepto, anio]);
  const conceptos = useMemo(() => {
    const delRango = pagos.filter((p) => p.Periodo >= rangoConcepto.desde && p.Periodo <= rangoConcepto.hasta);
    const acumulado = new Map<string, number>();
    let sinDesglose = 0;
    delRango.forEach((p) => {
      let detalle: ReturnType<typeof conceptosDePago>;
      try { detalle = conceptosDePago(p); }
      catch { sinDesglose += 1; return; }
      detalle.forEach((c) => acumulado.set(c.concepto, (acumulado.get(c.concepto) || 0) + c.monto));
    });
    return { filas: [...acumulado.entries()].map(([concepto, monto]) => ({ concepto, monto })).sort((a, b) => b.monto - a.monto), sinDesglose, pagos: delRango.length };
  }, [pagos, rangoConcepto]);

  const TRIMESTRES = ["Ene–Mar", "Abr–Jun", "Jul–Sep", "Oct–Dic"];
  return (
    <Desplegable
      className="panel"
      id="desembolso-anual"
      autoAbrir
      summary={<>Total de desembolso por nómina
        <span className="panel-summary-meta">
          {porMes.length ? `${anio} · ${anualPagos} pagos · Bs ${fmtBs(anualBs)} · USD ${fmtBs(anualUsd)}` : `${anio} · sin pagos registrados`}
        </span>
      </>}
    >
      <div className="panel-body">
        {porMes.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin pagos registrados en {anio}. Usa «Cerrar mes» o «+ Nuevo pago» para comenzar.</p>
        ) : (<>
          <div className="cards trio" style={{ marginBottom: 18 }}>
            <div className="card-kpi"><small>Pagos de {anio}</small><strong>{anualPagos}</strong></div>
            <div className="card-kpi"><small>Desembolso anual (Bs)</small><strong>{fmtBs(anualBs)}</strong></div>
            <div className="card-kpi"><small>Desembolso anual (USD)</small><strong>{fmtBs(anualUsd)}</strong></div>
          </div>
          <SlideTabs
            className="tabs resumen-tabs"
            ariaLabel="Tipo de resumen"
            variante="tab"
            value={vista}
            onChange={setVista}
            items={([["mes", "Por mes"], ["persona", "Por persona"], ["concepto", "Por concepto pagado"]] as const)}
          />

          {vista === "mes" && (<>
            <div className="tbl-wrap" style={{ marginTop: 16, boxShadow: "none" }}>
              <table className="tbl" style={{ minWidth: 700 }}>
                <thead>
                  <tr><th>Mes</th><th>Pagos</th><th>Tasa BCV</th><th>Anticipos (Bs)</th><th>Desembolso (Bs)</th><th>Desembolso (USD)</th></tr>
                </thead>
                <tbody>
                  {porMes.map(([mes, list]) => (
                    <tr key={mes}>
                      <td><b>{mesNombre(mes)}</b><small style={{ display: "block" }}>{mes}</small></td>
                      <td>{list.length}</td>
                      <td>{tasaMes(list)}</td>
                      <td>{fmtBs(list.reduce((s, p) => s + totalAnticipos(p), 0))}</td>
                      <td><b>{fmtBs(suma(list, "NetoBs"))}</b></td>
                      <td>{fmtBs(suma(list, "NetoUSD"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 18 }}>
              {porMes.map(([mes, list]) => {
                const bs = suma(list, "NetoBs");
                return (
                  <div className="bar-row annual" key={mes}>
                    <span className="bar-label">{mesNombre(mes)}</span>
                    <div className="bar-track"><div className="bar" style={{ width: Math.round(bs / maxMesBs * 100) + "%" }}></div></div>
                    <span className="bar-val">{fmtBs(bs)}</span>
                  </div>
                );
              })}
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>Incluye todos los pagos registrados de {anio}, sin importar el estado laboral actual. La tasa de cada mes queda congelada en cada pago.</p>
          </>)}

          {vista === "persona" && (<>
            <p className="tiny" style={{ marginTop: 0 }}>Desembolso neto por trabajador con desglose por trimestre calendario (declaración trimestral del INCES). Incluye a quienes ya no están activos: muestra todo lo pagado en el año.</p>
            <div className="tbl-wrap" style={{ marginTop: 12, boxShadow: "none" }}>
              <table className="tbl" style={{ minWidth: 820 }}>
                <thead>
                  <tr><th>Trabajador</th><th>Pagos</th><th>T1 Ene–Mar (Bs)</th><th>T2 Abr–Jun (Bs)</th><th>T3 Jul–Sep (Bs)</th><th>T4 Oct–Dic (Bs)</th><th>Total año (Bs)</th><th>Total año (USD)</th></tr>
                </thead>
                <tbody>
                  {porPersona.map((persona) => (
                    <tr key={persona.cedula}>
                      <td><b>{persona.nombre}</b><small style={{ display: "block" }}>{persona.cedula}</small></td>
                      <td>{persona.pagos}</td>
                      {persona.trim.map((bs, i) => <td key={i} className={bs ? "" : "col-num-cero"}>{bs ? fmtBs(bs) : "—"}</td>)}
                      <td><b>{fmtBs(persona.totalBs)}</b></td>
                      <td>{fmtBs(persona.totalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>Para el ISLR usa la columna «Total año»: es el pago acumulado de cada persona en {anio}.</p>
          </>)}

          {vista === "concepto" && (<>
            <div className="concepto-controles">
              <SlideTabs
                className="fin-tabs-sm"
                ariaLabel="Rango del resumen por concepto"
                value={modoConcepto}
                onChange={setModoConcepto}
                items={([["anual", "Anual"], ["trimestre", "Trimestral"], ["mes", "Mensual"]] as const)}
              />
              {modoConcepto === "trimestre" && (
                <label>Trimestre
                  <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t} · {TRIMESTRES[t - 1]}</option>)}
                  </select>
                </label>
              )}
              {modoConcepto === "mes" && <div><span>Mes</span><MonthPicker value={mesConcepto} onChange={setMesConcepto} /></div>}
              <span className="badge ok">{rangoConcepto.etiqueta} · {conceptos.pagos} pagos</span>
            </div>
            {conceptos.filas.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Sin pagos en {rangoConcepto.etiqueta}.</p>
            ) : (<>
              <div className="tbl-wrap" style={{ marginTop: 12, boxShadow: "none" }}>
                <table className="tbl" style={{ minWidth: 620 }}>
                  <thead>
                    <tr><th>Concepto pagado</th><th>Monto (Bs)</th><th>% del total</th></tr>
                  </thead>
                  <tbody>
                    {conceptos.filas.map(({ concepto, monto }) => (
                      <tr key={concepto}>
                        <td>{concepto}</td>
                        <td><b>{fmtBs(monto)}</b></td>
                        <td>{anualBs ? (monto / conceptos.filas.reduce((s, f) => s + f.monto, 0) * 100).toFixed(1) + " %" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {conceptos.sinDesglose > 0 && <p className="tiny" style={{ marginTop: 12 }}>{conceptos.sinDesglose} pago(s) histórico(s) sin detalle por concepto quedan fuera de esta tabla.</p>}
              <p className="tiny" style={{ marginTop: 12 }}>Montos en bolívares a la tasa congelada de cada pago. Asignaciones y deducciones según la plantilla de recibos.</p>
            </>)}
          </>)}
        </>)}
      </div>
    </Desplegable>
  );
}

/** Desglose de un pago por concepto en Bs (mismas fórmulas del recibo). */
function conceptosDePago(p: Pago): { concepto: string; monto: number }[] {
  const c = calcNomina(p);
  const tasa = Number(p.TasaBCV) || 0;
  const bs = (usd: number) => usd * tasa;
  const v2 = Number(p.DistribucionVersion) >= 2;
  const si = Number(p.SalarioIntegralUSD) || 0;
  return [
    { concepto: "Sueldo básico", monto: bs(c.sueldo) },
    { concepto: "Prima por disponibilidad", monto: bs(c.disp) },
    { concepto: "Prima por responsabilidad", monto: bs(c.resp) },
    { concepto: "Prima por representación", monto: bs(c.repr) },
    { concepto: "Prima por antigüedad", monto: bs(c.antig) },
    { concepto: "Bono por orden y limpieza", monto: bs(v2 ? si * (Number(p.PctLimpieza) || 0) : Number(p.BonoLimpieza) || 0) },
    { concepto: "Bono por puntualidad", monto: bs(v2 ? si * (Number(p.PctPuntual) || 0) : Number(p.BonoPuntual) || 0) },
    { concepto: "Bono por movilidad (transporte)", monto: bs(v2 ? si * (Number(p.PctMovilidad) || 0) : Number(p.BonoMovilidad) || 0) },
    { concepto: "Bono por coordinación", monto: bs(v2 ? si * (Number(p.PctCoordin) || 0) : Number(p.BonoCoordin) || 0) },
    ...(v2 ? [] : [{ concepto: "Bono por productividad", monto: bs(Number(p.BonoProductiv) || 0) }]),
    { concepto: "Cestaticket socialista", monto: bs(c.cesta) },
    { concepto: "Bonificación especial asistencial", monto: bs(c.asistencial) },
    { concepto: "Deducción: IVSS", monto: c.ivssBs },
    { concepto: "Deducción: paro forzoso", monto: c.paroBs },
    { concepto: "Deducción: FAOV", monto: c.faovBs },
    { concepto: "Deducción: ISLR", monto: c.islrBs },
    { concepto: "Deducción: anticipos / préstamos", monto: c.anticiposBs },
  ].filter((f) => f.monto > 0 || f.concepto.startsWith("Sueldo") || f.concepto.startsWith("Deducción"));
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);
  const nuevo = !pago.ID;
  const distribucionV2 = Number(form.DistribucionVersion) >= 2;
  const trabajador = trabajadores.find((p) => cedulaKey(p.cedula) === cedulaKey(form.Cedula));
  const calc = useMemo(() => calcNomina(form), [form]);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function elegirTrabajador(cedula: string) {
    const a = trabajadores.find((p) => cedulaKey(p.cedula) === cedulaKey(cedula));
    setForm((f) => ({ ...f, Cedula: cedula, Nombre: a?.nombre || "", Cargo: a?.cargo || "",
      FechaIngreso: a?.ingresoReal || "", Banco: a?.banco || "", Cuenta: a?.nCuenta || "",
      ...distribucionDesde(a || {}), DistribucionVersion: 2,
      SalarioIntegralUSD: remuneracionRegistrada(a) }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.Cedula) return setError("Selecciona un trabajador");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.Periodo)) return setError("Selecciona un período válido");
    if (!Number.isFinite(Number(form.TasaBCV)) || Number(form.TasaBCV) <= 0) return setError("Indica una tasa BCV mayor que cero");
    if (!Number.isFinite(Number(form.SalarioIntegralUSD)) || Number(form.SalarioIntegralUSD) <= 0) return setError("Completa «Total remuneración» del trabajador en Talento Humano antes de registrar el pago");
    if (distribucionV2) {
      const distribucionError = validarDistribucion(form);
      if (distribucionError) return setError(distribucionError);
    }
    // Anticipos por semana: al informar cualquier semana, el total es la suma de las cuatro.
    const semanas = anticipoSemanas(form);
    const datos = semanas ? { ...form, AnticiposBs: r2(semanas.reduce((s, v) => s + v, 0)) } : form;
    setGuardando(true);
    try { await onGuardar(datos); }
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
  const Dist = (key: typeof DISTRIBUCION_NOMINA[number]["key"]) => {
    const config = DISTRIBUCION_NOMINA.find((field) => field.key === key)!;
    return <label key={key}>{config.label} · máximo {fmtPct(config.max)}
      <select value={String(form[key] ?? 0)} onChange={(e) => set(key, Number(e.target.value))}>
        {opcionesPorcentaje(config.max).map((option) => <option key={option} value={option}>
          {fmtPct(option)}{config.referencias.includes(option as never) ? " · tabla" : ""}
        </option>)}
      </select>
    </label>;
  };

  const faltantes = form.Cedula ? [
    !form.Banco && "banco", !form.Cuenta && "número de cuenta",
    !remuneracionRegistrada(trabajador) && "Total remuneración",
  ].filter(Boolean) as string[] : [];

  return (
    <div className="overlay open" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form className="modal wide" onSubmit={enviar}>
        <button type="button" className="modal-close" aria-label="Cerrar" onClick={onCerrar}>×</button>
        <h3>{nuevo ? "Nuevo pago" : form.Nombre} — {mesNombre(form.Periodo)} de {form.Periodo.slice(0, 4)}</h3>

        {pago.Origen === "Historico Excel corregido" && <p role="status" className="tiny" style={{ marginTop: -10 }}>
          Estás corrigiendo un pago importado. El respaldo original se conserva en el registro; al guardar se recalcularán los importes con los datos corregidos.
        </p>}

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
          {faltantes.length > 0 && <p role="alert" style={{ color: "var(--danger)", fontWeight: 700 }}>Falta completar en Talento Humano: {faltantes.join(", ")}.</p>}
          <p className="tiny">La remuneración, los datos bancarios y la distribución se toman de Talento Humano. Si ajustas aquí la distribución, quedará como perfil del trabajador para los próximos pagos.</p>
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
          <h4>Remuneración de Talento Humano y distribución</h4>
          <div className="grid2">
            <label>Remuneración total mensual (USD)<input disabled value={fmtBs(Number(form.SalarioIntegralUSD) || 0)} /></label>
            {distribucionV2 ? ["PctSueldo", "PctDisp", "PctResp", "PctRepr", "PctAntig"].map((key) => Dist(key as typeof DISTRIBUCION_NOMINA[number]["key"])) : <>
              {P("Sueldo básico %", "PctSueldo", true)}{P("Prima por Disponibilidad %", "PctDisp", true)}
              {P("Prima por Responsabilidad %", "PctResp", true)}{P("Prima por Representación %", "PctRepr", true)}{P("Prima por Antigüedad %", "PctAntig", true)}
            </>}
          </div>
          {trabajador && <p className="tiny">Base: sueldo mensual {fmtBs(Number(trabajador.sueldoMensual) || 0)} + alimentación {fmtBs(Number(trabajador.bonoAlimentacion) || 0)} + ayuda {fmtBs(Number(trabajador.ayudaUnica) || 0)} + comisiones, bono vacacional y otros.</p>}
        </div>

        <div className="form-section">
          <h4>{distribucionV2 ? "Bonificaciones (% de la remuneración total)" : "Bonificaciones heredadas (USD)"}</h4>
          <div className="grid2">
            {distribucionV2 ? ["PctLimpieza", "PctPuntual", "PctMovilidad", "PctCoordin", "PctCestaticket"].map((key) => Dist(key as typeof DISTRIBUCION_NOMINA[number]["key"])) : <>
              {P("Orden y Limpieza", "BonoLimpieza")}{P("Puntualidad", "BonoPuntual")}
              {P("Movilidad (Transporte)", "BonoMovilidad")}{P("Coordinación", "BonoCoordin")}
              {P("Productividad", "BonoProductiv")}{P("Cestaticket %", "PctCestaticket", true)}{P("Bonif. Especial Asistencial (USD)", "AsistencialUSD")}
            </>}
          </div>
          {distribucionV2 && <p className="tiny">Total distribuido: <b>{fmtPct(totalDistribucion(form))}</b> · debe ser exactamente 100 %.</p>}
        </div>

        <div className="form-section">
          <h4>Deducciones (sobre el sueldo básico en Bs)</h4>
          <div className="grid2">
            {P("IVSS %", "PctIVSS", true)}
            {P("Paro Forzoso %", "PctParo", true)}
            {P("FAOV %", "PctFAOV", true)}
            {P("I.S.L.R. % (Formulario ARI)", "PctISLR", true)}
          </div>
          <div className="anticipo-semanas">
            <h5>Anticipos / Préstamos por semana (Bs)</h5>
            <div className="anticipo-grid">
              <label>Semana 1<input type="number" step="any" min="0" placeholder="0,00" value={String(form.AnticipoS1 ?? "")} onChange={(e) => set("AnticipoS1", e.target.value)} /></label>
              <label>Semana 2<input type="number" step="any" min="0" placeholder="0,00" value={String(form.AnticipoS2 ?? "")} onChange={(e) => set("AnticipoS2", e.target.value)} /></label>
              <label>Semana 3<input type="number" step="any" min="0" placeholder="0,00" value={String(form.AnticipoS3 ?? "")} onChange={(e) => set("AnticipoS3", e.target.value)} /></label>
              <label>Semana 4<input type="number" step="any" min="0" placeholder="0,00" value={String(form.AnticipoS4 ?? "")} onChange={(e) => set("AnticipoS4", e.target.value)} /></label>
              <label className="anticipo-total">Total anticipos (Bs)<input disabled value={fmtBs(totalAnticipos(form))} /></label>
            </div>
            <p className="tiny">Registra el adelanto dado en cada semana del mes antes de cerrar. Al escribir cualquier semana, el total pasa a ser la suma de las cuatro; las semanas vacías cuentan como 0.</p>
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

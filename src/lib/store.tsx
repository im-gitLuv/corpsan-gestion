"use client";

/**
 * Store de datos del dashboard: carga las hojas de Talento Humano
 * (activos / inactivos) desde Apps Script o desde el modo demo local,
 * y expone las operaciones CRUD comunes.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPost, getUrl } from "./api";
import { DEMO_ACTIVOS, DEMO_INACTIVOS } from "./demo";
import type { Empleado, HojaTH } from "./types";

type ConnState = "demo" | "ok" | "cargando";

interface DataCtx {
  activos: Empleado[];
  inactivos: Empleado[];
  conn: ConnState;
  error: string;
  recargar: () => Promise<void>;
  crear: (hoja: HojaTH, data: Empleado) => Promise<void>;
  actualizar: (hoja: HojaTH, emp: Empleado, data: Empleado) => Promise<void>;
  eliminar: (hoja: HojaTH, emp: Empleado) => Promise<void>;
  resetDemo: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

const LS_DEMO = (h: HojaTH) => `cs_demo_${h}`;

function leerDemo(h: HojaTH): Empleado[] {
  try {
    const raw = localStorage.getItem(LS_DEMO(h));
    if (raw) return JSON.parse(raw);
  } catch { /* usar semilla */ }
  return h === "activos" ? [...DEMO_ACTIVOS] : [...DEMO_INACTIVOS];
}

function guardarDemo(h: HojaTH, rows: Empleado[]) {
  localStorage.setItem(LS_DEMO(h), JSON.stringify(rows));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [activos, setActivos] = useState<Empleado[]>([]);
  const [inactivos, setInactivos] = useState<Empleado[]>([]);
  const [conn, setConn] = useState<ConnState>("cargando");
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    if (!getUrl()) {
      setActivos(leerDemo("activos"));
      setInactivos(leerDemo("inactivos"));
      setConn("demo");
      setError("");
      return;
    }
    setConn("cargando");
    try {
      const [a, i] = await Promise.all([
        apiGet({ action: "list", hoja: "activos" }),
        apiGet({ action: "list", hoja: "inactivos" }),
      ]);
      if (!a.ok) throw new Error(a.msg || "respuesta inválida del backend");
      setActivos(a.data || []);
      setInactivos(i.ok ? i.data || [] : []);
      setConn("ok");
      setError("");
    } catch (e: any) {
      // ante fallo, caer a demo para no bloquear la interfaz
      setActivos(leerDemo("activos"));
      setInactivos(leerDemo("inactivos"));
      setConn("demo");
      setError(e.message || "Error de conexión con Google Sheets");
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  // recargar al volver a la pestaña (por si editaron el sheet directamente)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && getUrl()) recargar(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [recargar]);

  const crear = useCallback(async (hoja: HojaTH, data: Empleado) => {
    if (getUrl()) {
      const r = await apiPost({ action: "create", hoja, data });
      if (!r.ok) throw new Error(r.msg || "Error al crear");
    } else {
      const rows = leerDemo(hoja);
      const maxN = rows.reduce((m, r) => Math.max(m, Number(r.n) || 0), 0);
      rows.push({
        ...data,
        estado: data.estado || (hoja === "activos" ? "ACTIVO" : "INACTIVO"),
        n: maxN + 1,
        _fila: 9 + rows.length,
      });
      guardarDemo(hoja, rows);
    }
    await recargar();
  }, [recargar]);

  const actualizar = useCallback(async (hoja: HojaTH, emp: Empleado, data: Empleado) => {
    if (getUrl()) {
      const r = await apiPost({
        action: "update", hoja,
        fila: emp._fila,
        check: String(emp.cedula ?? ""),
        data,
      });
      if (!r.ok) throw new Error(r.msg || "Error al actualizar");
    } else {
      const rows = leerDemo(hoja);
      const idx = rows.findIndex((r) => r._fila === emp._fila);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...data };
      guardarDemo(hoja, rows);
    }
    await recargar();
  }, [recargar]);

  const eliminar = useCallback(async (hoja: HojaTH, emp: Empleado) => {
    if (getUrl()) {
      const r = await apiPost({
        action: "del", hoja,
        fila: emp._fila,
        check: String(emp.cedula ?? ""),
      });
      if (!r.ok) throw new Error(r.msg || "Error al eliminar");
    } else {
      const rows = leerDemo(hoja).filter((r) => r._fila !== emp._fila);
      guardarDemo(hoja, rows);
    }
    await recargar();
  }, [recargar]);

  const resetDemo = useCallback(() => {
    (["activos", "inactivos"] as HojaTH[]).forEach((h) => localStorage.removeItem(LS_DEMO(h)));
    setActivos([...DEMO_ACTIVOS]);
    setInactivos([...DEMO_INACTIVOS]);
  }, []);

  return (
    <Ctx.Provider value={{ activos, inactivos, conn, error, recargar, crear, actualizar, eliminar, resetDemo }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData fuera de DataProvider");
  return c;
}

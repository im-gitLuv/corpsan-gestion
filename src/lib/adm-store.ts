"use client";

/**
 * Almacén de Gestión Administrativa: hook de datos por colección,
 * modo demo con localStorage y utilidades de exportación.
 * Con backend: usa las acciones adm_* de Apps Script (con token de sesión).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiPost, getUrl } from "./api";
import { useAuth } from "./auth";
import {
  ADM_COLECCIONES, ADM_ETIQUETAS, admCalcularFila, admCalcularResumen, admPreparar, admSiguiente,
  type AdmResumen, type AdmRow,
} from "./adm";
import { bankName } from "./business";
import type { FinanzasData } from "./finanzas";

const LS_ADM = (coleccion: string) => `cs_demo_adm_${coleccion}`;

export type AdmConn = "demo" | "ok" | "cargando";

export interface AdmApi {
  datos: Record<string, AdmRow[]>;
  siguiente: Record<string, string>;
  conn: AdmConn;
  error: string;
  listo: boolean;
  recargar: () => Promise<void>;
  guardar: (coleccion: string, fila: AdmRow) => Promise<AdmRow>;
  eliminar: (coleccion: string, id: string) => Promise<void>;
}

function leerDemo(coleccion: string): AdmRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_ADM(coleccion));
    if (raw) return JSON.parse(raw);
  } catch { /* sin datos locales */ }
  return [];
}

function guardarDemo(coleccion: string, filas: AdmRow[]) {
  localStorage.setItem(LS_ADM(coleccion), JSON.stringify(filas));
}

/** Hook de datos para las colecciones indicadas (una sola llamada adm_list). */
export function useAdm(colecciones: string[]): AdmApi {
  const { user } = useAuth();
  const [datos, setDatos] = useState<Record<string, AdmRow[]>>({});
  const [siguiente, setSiguiente] = useState<Record<string, string>>({});
  const [conn, setConn] = useState<AdmConn>("cargando");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const clave = colecciones.join(",");

  const recargar = useCallback(async () => {
    setConn("cargando"); setError("");
    const pedidas = clave.split(",").filter(Boolean);
    const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
    const locales = () => {
      const nuevas: Record<string, AdmRow[]> = {};
      const sigs: Record<string, string> = {};
      pedidas.forEach((c) => {
        nuevas[c] = leerDemo(c);
        const sig = admSiguiente(c, nuevas[c], hoy);
        if (sig) sigs[c] = sig;
      });
      setDatos(nuevas); setSiguiente(sigs); setConn("demo");
    };
    if (!getUrl()) { locales(); setListo(true); return; }
    try {
      if (!user?.token) throw new Error("Inicia sesión de nuevo para consultar los registros.");
      const r = await apiPost({ action: "adm_list", coleccion: clave, token: user.token });
      if (!r.ok) throw new Error(r.msg || "No se pudieron cargar los registros.");
      setDatos(r.datos || {});
      setSiguiente(r.siguiente || {});
      setConn("ok");
      setError("");
    } catch (e) {
      setError((e as Error).message);
      locales(); // no bloquear la interfaz, como el resto del sistema
    } finally {
      setListo(true);
    }
  }, [clave, user?.token]);

  useEffect(() => { void recargar(); }, [recargar]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") void recargar(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [recargar]);

  const guardar = useCallback(async (coleccion: string, fila: AdmRow): Promise<AdmRow> => {
    const actuales = datos[coleccion] || leerDemo(coleccion);
    if (getUrl()) {
      const r = await apiPost({ action: "adm_save", coleccion, data: fila, token: user?.token });
      if (!r.ok) throw new Error(r.msg || "No se pudo guardar");
      await recargar();
      return { ...fila, ID: r.id };
    }
    const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" });
    const preparada = admPreparar(coleccion, fila, actuales, hoy);
    if (preparada.error) throw new Error(preparada.error);
    const idx = preparada.fila.ID ? actuales.findIndex((f) => String(f.ID) === String(preparada.fila.ID)) : -1;
    const nuevas = idx >= 0 ? actuales.map((f, i) => (i === idx ? preparada.fila : f)) : [...actuales, preparada.fila];
    guardarDemo(coleccion, nuevas);
    setDatos((prev) => ({ ...prev, [coleccion]: nuevas }));
    const sig = admSiguiente(coleccion, nuevas, hoy);
    setSiguiente((prev) => ({ ...prev, [coleccion]: sig || "" }));
    return preparada.fila;
  }, [datos, recargar, user?.token]);

  const eliminar = useCallback(async (coleccion: string, id: string) => {
    if (getUrl()) {
      const r = await apiPost({ action: "adm_del", coleccion, id, token: user?.token });
      if (!r.ok) throw new Error(r.msg || "No se pudo eliminar");
      await recargar();
      return;
    }
    const nuevas = (datos[coleccion] || leerDemo(coleccion)).filter((f) => String(f.ID) !== String(id));
    guardarDemo(coleccion, nuevas);
    setDatos((prev) => ({ ...prev, [coleccion]: nuevas }));
  }, [datos, recargar, user?.token]);

  return { datos, siguiente, conn, error, listo, recargar, guardar, eliminar };
}

/** Resumen administrativo para el panel: mismo cálculo en demo y conectado. */
export function useAdmResumen(api: AdmApi): AdmResumen | null {
  const hoy = useMemo(() => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" }), []);
  return useMemo(() => {
    if (!api.listo) return null;
    return admCalcularResumen(api.datos, hoy);
  }, [api.datos, api.listo, hoy]);
}

/** Cuentas reales de CorpSan para sugerencias de banco (FIN_CUENTAS). */
export function useBancos(): { opciones: string[]; cargando: boolean } {
  const { user } = useAuth();
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      let data: FinanzasData | null = null;
      if (!getUrl()) {
        const raw = localStorage.getItem("cs_demo_finanzas");
        data = raw ? JSON.parse(raw) : null;
      } else if (user?.token) {
        const r = await apiPost({ action: "fin_list", token: user.token });
        if (r.ok) data = { movimientos: r.movimientos || [], cuentas: r.cuentas || [], categorias: r.categorias || [], control: r.control || {}, ajustes: r.ajustes || [] };
      }
      const nombres = new Set<string>((data?.cuentas || []).map((c) => bankName(c)).filter((n) => n && n !== "Banco pendiente"));
      setOpciones([...nombres]);
    } catch { setOpciones([]); }
    finally { setCargando(false); }
  }, [user?.token]);

  useEffect(() => { void cargar(); }, [cargar]);
  return { opciones, cargando };
}

/** Descarga CSV de libros y registros (misma convención de escape que Finanzas). */
export function admCsv(nombre: string, filas: AdmRow[], columnas: Array<{ key: string; label: string }>) {
  const celda = (v: unknown) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : /^[=+\-@]/.test(s) ? `'${s}` : s;
  };
  const lineas = [
    columnas.map((c) => celda(c.label)).join(";"),
    ...filas.map((f) => columnas.map((c) => celda(f[c.key])).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

/** Etiqueta legible (I → Interna, OP → Operaciones…). */
export function admEtiqueta(key: string, valor: unknown): string {
  const v = String(valor ?? "");
  return key === "Direccion" || key === "Departamento" ? (ADM_ETIQUETAS[v] || v) : v;
}

export type { AdmRow, AdmResumen };
export { ADM_COLECCIONES, admCalcularFila, admCalcularResumen };

"use client";

/**
 * Cliente del backend Google Apps Script.
 * GET  → parámetros en la URL (action=ping|login|list).
 * POST → cuerpo JSON enviado como text/plain (evita el preflight CORS en script.google.com).
 * Sin URL configurada, la app opera en "modo demo" con datos locales.
 */
import type { ApiResponse } from "./types";

const LS_KEY = "cs_api";

/** URL del Web App: prioridad al override del navegador, luego a la variable de entorno. */
export function getUrl(): string {
  if (typeof window !== "undefined") {
    const ov = localStorage.getItem(LS_KEY);
    if (ov) return ov;
  }
  return process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
}

export function isConfigured(): boolean {
  return !!getUrl();
}

export function setUrl(url: string) {
  if (typeof window === "undefined") return;
  if (url) localStorage.setItem(LS_KEY, url);
  else localStorage.removeItem(LS_KEY);
}

export async function apiGet(params: Record<string, string>): Promise<ApiResponse> {
  const base = getUrl();
  if (!base) throw new Error("Backend no configurado");
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { redirect: "follow" });
  return r.json();
}

export async function apiPost(payload: Record<string, any>): Promise<ApiResponse> {
  const base = getUrl();
  if (!base) throw new Error("Backend no configurado");
  // Sin cabecera Content-Type: el navegador usa text/plain y no dispara preflight.
  const r = await fetch(base, { method: "POST", body: JSON.stringify(payload), redirect: "follow" });
  return r.json();
}

/** Prueba de conexión: devuelve la respuesta completa de ping (incluye cabeceras detectadas). */
export async function ping(): Promise<ApiResponse> {
  return apiGet({ action: "ping" });
}

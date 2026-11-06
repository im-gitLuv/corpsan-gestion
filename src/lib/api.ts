"use client";

/**
 * Cliente del backend Google Apps Script.
 * Las operaciones privadas usan POST con token en el cuerpo JSON.
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

export function hasConnectionOverride(): boolean {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_APPS_SCRIPT_URL) return false;
  const override=localStorage.getItem(LS_KEY);
  return !!override && override!==process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
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
  const r = await fetch(u.toString(), { redirect: "follow", cache: "no-store" });
  return r.json();
}

export async function apiPost(payload: Record<string, any>, options?: { keepalive?: boolean; url?: string }): Promise<ApiResponse> {
  const base = options?.url ?? getUrl();
  if (!base) throw new Error("Backend no configurado");
  // Sin cabecera Content-Type: el navegador usa text/plain y no dispara preflight.
  const r = await fetch(base, { method: "POST", body: JSON.stringify(payload), redirect: "follow", keepalive: options?.keepalive });
  return r.json();
}

/** Prueba de conexión: devuelve la respuesta completa de ping (incluye cabeceras detectadas). */
export async function ping(token: string, url?: string): Promise<ApiResponse> {
  return apiPost({ action: "ping", token }, {url});
}

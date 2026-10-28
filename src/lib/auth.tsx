"use client";

/**
 * Autenticación preliminar de CorpSan — solo rol Administrador.
 * Con backend: valida contra Apps Script (constantes ADMIN_USER/ADMIN_PASS en Code.gs).
 * Sin backend (modo demo): acepta las credenciales demo locales.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiPost, isConfigured } from "./api";
import type { SesionUsuario } from "./types";

const SS_KEY = "cs_user";
const DEMO_ADMIN = { usuario: "admin", clave: "admin123" };

interface AuthCtx {
  user: SesionUsuario | null;
  ready: boolean;
  login: (usuario: string, clave: string) => Promise<{ ok: boolean; msg?: string }>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, ready: false,
  login: async () => ({ ok: false, msg: "no disponible" }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SesionUsuario | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const u = JSON.parse(raw) as SesionUsuario;
        // Mismo plazo máximo que la sesión del backend financiero.
        if (Date.now() - u.hora < 6 * 3600 * 1000) setUser(u);
        else sessionStorage.removeItem(SS_KEY);
      }
    } catch { /* sesion corrupta: ignorar */ }
    setReady(true);
  }, []);

  const login = async (usuario: string, clave: string) => {
    const u = usuario.trim();
    if (!u || !clave) return { ok: false, msg: "Completa usuario y contraseña" };

    if (isConfigured()) {
      try {
        const r = await apiPost({ action: "login", usuario: u, clave });
        if (r.ok) {
          const s: SesionUsuario = { usuario: r.usuario, nombre: r.nombre || r.usuario, rol: r.rol || "Administrador", hora: Date.now(), token: r.token };
          sessionStorage.setItem(SS_KEY, JSON.stringify(s));
          setUser(s);
          return { ok: true };
        }
        return { ok: false, msg: r.msg || "Credenciales inválidas" };
      } catch {
        return { ok: false, msg: "No se pudo contactar el backend de Apps Script" };
      }
    }

    // Modo demo local
    if (u.toLowerCase() === DEMO_ADMIN.usuario && clave === DEMO_ADMIN.clave) {
      const s: SesionUsuario = { usuario: "admin", nombre: "Gerencia General", rol: "Administrador", hora: Date.now() };
      sessionStorage.setItem(SS_KEY, JSON.stringify(s));
      setUser(s);
      return { ok: true };
    }
    return { ok: false, msg: "Usuario o contraseña incorrectos" };
  };

  const logout = () => {
    sessionStorage.removeItem(SS_KEY);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

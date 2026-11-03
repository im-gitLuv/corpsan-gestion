"use client";

/**
 * Autenticación de CorpSan — primera etapa: rol Administrador.
 * Con backend: credenciales verificadas contra USUARIOS en Google Sheets.
 * Sin backend (modo demo): acepta las credenciales demo locales.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiPost, isConfigured } from "./api";
import { newSalt, passwordProof, validatePassword } from "./password";
import type { SesionUsuario } from "./types";

const SS_KEY = "cs_user";
const LS_SESSION_KEY = "cs_trusted_user";
const DEMO_ADMIN = { usuario: "admin", clave: "admin123" };

interface AuthCtx {
  user: SesionUsuario | null;
  ready: boolean;
  login: (usuario: string, clave: string, trustDevice?: boolean) => Promise<{ ok: boolean; msg?: string; mfaRequired?: boolean; challenge?: string }>;
  completeMfa: (challenge: string, code: string) => Promise<{ ok: boolean; msg?: string }>;
  register: (usuario: string, nombre: string, email: string, clave: string, setupCode?: string) => Promise<{ ok: boolean; msg?: string; estado?: string }>;
  changePassword: (actual: string, nueva: string) => Promise<{ ok: boolean; msg?: string }>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, ready: false,
  login: async () => ({ ok: false, msg: "no disponible" }),
  completeMfa: async () => ({ ok: false, msg: "no disponible" }),
  register: async () => ({ ok: false, msg: "no disponible" }),
  changePassword: async () => ({ ok: false, msg: "no disponible" }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SesionUsuario | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_SESSION_KEY);
      if (raw) {
        const u = JSON.parse(raw) as SesionUsuario;
        const maxAge = u.trusted ? 7 * 86400000 : 6 * 3600000;
        if (Date.now() - u.hora < maxAge) {
          if (isConfigured() && u.token) {
            apiPost({ action: "auth_validate", token: u.token }).then(r => {
              if (r.ok) setUser(u);
              else { sessionStorage.removeItem(SS_KEY); localStorage.removeItem(LS_SESSION_KEY); }
            }).catch(() => { sessionStorage.removeItem(SS_KEY); localStorage.removeItem(LS_SESSION_KEY); }).finally(() => setReady(true));
            return;
          }
          setUser(u);
        } else { sessionStorage.removeItem(SS_KEY); localStorage.removeItem(LS_SESSION_KEY); }
      }
    } catch { /* sesion corrupta: ignorar */ }
    setReady(true);
  }, []);

  const saveSession = (r: Record<string, any>) => {
    const s: SesionUsuario = { usuario: r.usuario, nombre: r.nombre || r.usuario, rol: r.rol || "Administrador", hora: Date.now(), token: r.token, trusted: !!r.trusted };
    if (s.trusted) localStorage.setItem(LS_SESSION_KEY, JSON.stringify(s));
    else sessionStorage.setItem(SS_KEY, JSON.stringify(s));
    setUser(s);
  };

  const login = async (usuario: string, clave: string, trustDevice = false) => {
    const u = usuario.trim();
    if (!u || !clave) return { ok: false, msg: "Completa usuario y contraseña" };

    if (isConfigured()) {
      try {
        const challenge = await apiPost({ action: "auth_challenge", usuario: u });
        if (!challenge.ok) return { ok: false, msg: challenge.msg || "El backend necesita la actualización de seguridad." };
        const proof = await passwordProof(clave, String(challenge.salt));
        const r = await apiPost({ action: "login", usuario: u, proof, trustDevice });
        if (r.ok) {
          if (r.mfaRequired) return { ok: true, mfaRequired: true, challenge: String(r.challenge) };
          saveSession(r);
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

  const completeMfa = async (challenge: string, code: string) => {
    try {
      const r = await apiPost({ action: "login_mfa", challenge, code });
      if (r.ok) saveSession(r);
      return { ok: !!r.ok, msg: r.msg };
    } catch { return { ok: false, msg: "No se pudo verificar el código." }; }
  };

  const register = async (usuario: string, nombre: string, email: string, clave: string, setupCode = "") => {
    if (!isConfigured()) return { ok: false, msg: "Conecta Google Sheets antes de crear una cuenta real." };
    const issue = validatePassword(clave);
    if (issue) return { ok: false, msg: issue };
    try {
      const salt = newSalt(), proof = await passwordProof(clave, salt);
      const r = await apiPost({ action: "register", usuario: usuario.trim(), nombre: nombre.trim(), email: email.trim(), salt, proof, setupCode });
      return { ok: !!r.ok, msg: r.msg, estado: r.estado };
    } catch { return { ok: false, msg: "No se pudo crear la cuenta. Inténtalo de nuevo." }; }
  };

  const changePassword = async (actual: string, nueva: string) => {
    if (!user?.token || !isConfigured()) return { ok: false, msg: "Inicia sesión con Google Sheets para cambiar la contraseña." };
    const issue = validatePassword(nueva); if (issue) return { ok: false, msg: issue };
    try {
      const challenge = await apiPost({ action: "auth_challenge", usuario: user.usuario });
      if (!challenge.ok) throw new Error(challenge.msg || "No se pudo verificar la cuenta.");
      const oldProof = await passwordProof(actual, String(challenge.salt));
      const salt = newSalt(), proof = await passwordProof(nueva, salt);
      const r = await apiPost({ action: "change_password", token: user.token, oldProof, salt, proof });
      if (r.ok) { sessionStorage.removeItem(SS_KEY); localStorage.removeItem(LS_SESSION_KEY); setUser(null); }
      return { ok: !!r.ok, msg: r.msg };
    } catch (e) { return { ok: false, msg: (e as Error).message || "No se pudo cambiar la contraseña." }; }
  };

  const logout = () => {
    if (user?.token && isConfigured()) void apiPost({ action: "logout", token: user.token }, { keepalive: true }).catch(() => {});
    sessionStorage.removeItem(SS_KEY);
    localStorage.removeItem(LS_SESSION_KEY);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, ready, login, completeMfa, register, changePassword, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

"use client";

import { useEffect, useState } from "react";
import { apiPost, isConfigured } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const configured = isConfigured();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (mode !== "register" || !configured) return;
    let active = true;
    apiPost({ action: "auth_status" }).then(r => { if (active) { setNeedsSetup(r.ok ? !!r.needsSetup : null); if (!r.ok) setMessage("El backend debe actualizarse para crear cuentas."); } }).catch(() => { if (active) setMessage("No se pudo consultar el estado del registro."); });
    return () => { active = false; };
  }, [mode, configured]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setMessage(""); setSuccess(false);
    if (mode === "register" && password !== confirm) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const result = mode === "login" ? await login(username, password) : await register(username, name, password, setupCode);
      setMessage(result.msg || (result.ok ? "Cuenta creada." : "No se pudo completar la solicitud."));
      setSuccess(result.ok);
      if (result.ok && mode === "login") onClose();
      if (result.ok && mode === "register") { setPassword(""); setConfirm(""); setSetupCode(""); }
    } finally { setBusy(false); }
  }

  function switchMode(next: "login" | "register") { setMode(next); setPassword(""); setConfirm(""); setMessage(""); setSuccess(false); }

  return <div className="auth-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      <div className="auth-dialog-brand"><span className="auth-brand-mark">CS</span><span><b>CorpSan Gestión</b><small>Acceso al sistema</small></span></div>
      <h2 id="auth-title">{mode === "login" ? "Bienvenido de nuevo" : "Crear cuenta"}</h2>
      <p className="auth-intro">{mode === "login" ? "Ingresa con tu usuario y contraseña." : "La primera cuenta será administradora. Las siguientes requieren aprobación de un administrador."}</p>
      <div className="auth-switch" role="group" aria-label="Tipo de acceso"><button type="button" aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Iniciar sesión</button><button type="button" aria-pressed={mode === "register"} onClick={() => switchMode("register")}>Crear cuenta</button></div>
      <form onSubmit={submit}>
        {mode === "register" && <label>Nombre completo<input autoFocus value={name} onChange={e => setName(e.target.value)} autoComplete="name" minLength={3} maxLength={100} required /></label>}
        <label>Usuario<input autoFocus={mode === "login"} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" pattern="[A-Za-z0-9._-]{3,40}" title="De 3 a 40 letras, números, puntos o guiones" required /></label>
        <label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : undefined} maxLength={128} required /></label>
        {mode === "register" && <><label>Confirmar contraseña<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={12} required /></label>{needsSetup && <label>Código de instalación<input type="password" value={setupCode} onChange={e => setSetupCode(e.target.value)} autoComplete="off" required /><small>Lo configura el propietario del sistema en Apps Script.</small></label>}</>}
        {message && <p className={success ? "auth-message success" : "auth-message"} role="status">{message}</p>}
        <button className="btn wide" disabled={busy || (mode === "register" && (!configured || needsSetup === null))}>{busy ? "Procesando…" : mode === "login" ? "Entrar al sistema" : "Crear cuenta"}</button>
      </form>
      {!configured && <p className="auth-demo-note">Modo de demostración local. El registro real requiere conectar Google Sheets.</p>}
      {mode === "register" && configured && <p className="auth-security-note">La contraseña se protege antes de guardarse. El registro pendiente no da acceso hasta su aprobación.</p>}
    </section>
  </div>;
}

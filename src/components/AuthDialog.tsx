"use client";

import { useEffect, useState } from "react";
import { apiPost, isConfigured } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { newSalt, passwordProof, validatePassword } from "@/lib/password";

import PasswordField from '@/components/PasswordField';

export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const { login, completeMfa, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "verify" | "recover" | "mfa">("login");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const [challenge, setChallenge] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const configured = isConfigured();
  const creatingPassword = mode === 'register' || (mode === 'recover' && resetSent);
  const passwordReady = !validatePassword(password) && password === confirm;

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
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await login(username, password, trustDevice);
        if (result.ok && result.mfaRequired && result.challenge) { setChallenge(result.challenge); setMode("mfa"); setPassword(""); return; }
        if (result.ok) { onClose(); return; }
        setMessage(result.msg || "No se pudo iniciar sesión.");
      } else if (mode === "mfa") {
        const result = await completeMfa(challenge, totp);
        if (result.ok) { onClose(); return; }
        setMessage(result.msg || "Código inválido.");
      } else if (mode === "register") {
        if (password !== confirm) { setMessage("Las contraseñas no coinciden."); return; }
        const result = await register(username, name, email, password, setupCode);
        setMessage(result.msg || "No se pudo crear la cuenta."); setSuccess(result.ok);
        if (result.ok) { setPassword(""); setConfirm(""); setSetupCode(""); setMode("verify"); }
      } else if (mode === "verify") {
        const result = await apiPost({ action: "email_confirm", usuario: username, code });
        setMessage(result.msg || "No se pudo verificar el correo."); setSuccess(!!result.ok);
        if (result.ok) { setCode(""); setMode("login"); }
      } else if (!resetSent) {
        const result = await apiPost({ action: "password_reset_request", email });
        setMessage(result.msg || "Si el correo está registrado, recibirás un código."); setSuccess(!!result.ok); setResetSent(!!result.ok);
      } else {
        const issue = validatePassword(password);
        if (issue) { setMessage(issue); return; }
        if (password !== confirm) { setMessage("Las contraseñas no coinciden."); return; }
        const salt = newSalt(), proof = await passwordProof(password, salt);
        const result = await apiPost({ action: "password_reset", email, code, totp, salt, proof });
        setMessage(result.msg || "No se pudo cambiar la contraseña."); setSuccess(!!result.ok);
        if (result.ok) { setPassword(""); setConfirm(""); setCode(""); setResetSent(false); setMode("login"); }
      }
    } catch { setMessage("No se pudo contactar el sistema. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }

  function switchMode(next: "login" | "register" | "verify" | "recover") { setMode(next); setPassword(""); setConfirm(""); setCode(""); setTotp(""); setMessage(""); setSuccess(false); }

  async function resendEmail() {
    if (!username.trim() || busy) { setMessage("Escribe tu usuario primero."); return; }
    setBusy(true);
    try { const r = await apiPost({ action: "email_resend", usuario: username }); setMessage(r.msg || "Si hay un correo pendiente, recibirás otro código."); setSuccess(!!r.ok); }
    catch { setMessage("No se pudo solicitar otro código."); }
    finally { setBusy(false); }
  }

  return <div className="auth-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      <div className="auth-dialog-brand"><span className="auth-brand-mark">CS</span><span><b>CorpSan Gestión</b><small>Acceso al sistema</small></span></div>
      <h2 id="auth-title">{{ login: "Bienvenido de nuevo", register: "Crear cuenta", verify: "Verifica tu correo", recover: "Recuperar contraseña", mfa: "Verificación en dos pasos" }[mode]}</h2>
      <p className="auth-intro">{{ login: "Ingresa con tu usuario y contraseña.", register: "Las cuentas nuevas requieren aprobación de un administrador.", verify: "Escribe el código que enviamos a tu correo.", recover: "Te enviaremos un código al correo verificado de tu cuenta.", mfa: "Escribe el código de Google Authenticator o uno de tus códigos de respaldo." }[mode]}</p>
      {(mode === "login" || mode === "register") && <div className="auth-switch" role="group" aria-label="Tipo de acceso"><button type="button" aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Iniciar sesión</button><button type="button" aria-pressed={mode === "register"} onClick={() => switchMode("register")}>Crear cuenta</button></div>}
      <form onSubmit={submit}>
        {mode === "register" && <label>Nombre completo<input autoFocus value={name} onChange={e => setName(e.target.value)} autoComplete="name" minLength={3} maxLength={100} required /></label>}
        {(mode === "login" || mode === "register" || mode === "verify") && <label>Usuario<input autoFocus={mode === "login"} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" pattern="[A-Za-z0-9._-]{3,40}" required /></label>}
        {(mode === "register" || mode === "recover") && <label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>}
        {(mode === "login" || creatingPassword) && <PasswordField key={mode} label={mode === "recover" ? "Nueva contraseña" : "Contraseña"} value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} showRequirements={creatingPassword} disabled={busy}/>}
        {creatingPassword && <PasswordField label="Confirmar contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" matchTo={password} disabled={busy}/>}
        {(mode === "verify" || (mode === "recover" && resetSent)) && <label>Código recibido por correo<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" pattern="[0-9]{8}" autoComplete="one-time-code" required /></label>}
        {(mode === "mfa" || (mode === "recover" && resetSent)) && <label>Authenticator o código de respaldo{mode === "recover" && " (si lo activaste)"}<input value={totp} onChange={e => setTotp(e.target.value.toUpperCase().replace(/[^A-F0-9-]/g, "").slice(0, 14))} pattern="([0-9]{6}|[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4})" autoComplete="one-time-code" required={mode === "mfa"} /></label>}
        {mode === "register" && needsSetup && <PasswordField label="Código de instalación" value={setupCode} onChange={setSetupCode} autoComplete="off" disabled={busy}/>}
        {mode === "login" && configured && <label className="auth-check"><input type="checkbox" checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)} /> Mantener sesión en este dispositivo de confianza durante 7 días</label>}
        {message && <p className={success ? "auth-message success" : "auth-message"} role="status">{message}</p>}
        <button className="btn wide" disabled={busy || (creatingPassword && !passwordReady) || (mode === "register" && (!configured || needsSetup === null))}>{busy ? "Procesando…" : mode === "login" ? "Entrar al sistema" : mode === "register" ? "Crear cuenta" : mode === "verify" ? "Verificar correo" : mode === "mfa" ? "Verificar código" : resetSent ? "Cambiar contraseña" : "Enviar código"}</button>
      </form>
      {mode === "login" && configured && <div className="auth-links"><button type="button" onClick={() => switchMode("recover")}>Olvidé mi contraseña</button><button type="button" onClick={() => switchMode("verify")}>Verificar correo</button></div>}
      {mode === "verify" && <div className="auth-links"><button type="button" onClick={() => void resendEmail()} disabled={busy}>Enviar otro código</button></div>}
      {(mode === "recover" || mode === "verify" || mode === "mfa") && <div className="auth-links"><button type="button" onClick={() => { setResetSent(false); switchMode("login"); }}>Volver a iniciar sesión</button>{mode === "recover" && resetSent && <button type="button" onClick={() => { setResetSent(false); setMessage(""); }}>Pedir otro código</button>}</div>}
      {!configured && <p className="auth-demo-note">Modo de demostración local. El registro real requiere conectar Google Sheets.</p>}
      {mode === "register" && configured && <p className="auth-security-note">La contraseña se protege antes de guardarse. El registro pendiente no da acceso hasta su aprobación.</p>}
    </section>
  </div>;
}

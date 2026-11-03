"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost, isConfigured } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Account = { id: string; usuario: string; nombre: string; rol: string; estado: string; creado: string; ultimoAcceso: string; correo?: string; correoVerificado?: string };

export default function UserManagement() {
  const { user, changePassword, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [profile, setProfile] = useState<{ correo: string; correoVerificado: boolean; totpActivo: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user?.token || !isConfigured()) return;
    setLoading(true);
    try {
      const [r, p] = await Promise.all([apiPost({ action: "users_list", token: user.token }), apiPost({ action: "auth_profile", token: user.token })]);
      if (!r.ok || !p.ok) throw new Error(r.msg || p.msg || "No se pudieron cargar las cuentas.");
      setAccounts(r.users || []); setProfile({ correo: p.correo || "", correoVerificado: !!p.correoVerificado, totpActivo: !!p.totpActivo }); setEmail(p.correo || "");
    }
    catch (e) { setMessage((e as Error).message); }
    finally { setLoading(false); }
  }, [user?.token]);
  useEffect(() => { void load(); }, [load]);

  async function update(account: Account, estado: "Activo" | "Suspendido") {
    if (!user?.token) return;
    if (estado === "Suspendido" && !window.confirm(`¿Suspender el acceso de ${account.nombre}?`)) return;
    setBusy(account.usuario); setMessage("");
    try { const r = await apiPost({ action: "users_update", token: user.token, usuario: account.usuario, nombre: account.nombre, estado }); if (!r.ok) throw new Error(r.msg || "No se pudo actualizar la cuenta."); setMessage("Cuenta actualizada."); await load(); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(""); }
  }

  async function change(event: React.FormEvent) {
    event.preventDefault(); setBusy("password"); setMessage("");
    const r = await changePassword(current, next);
    setMessage(r.msg || (r.ok ? "Contraseña actualizada." : "No se pudo actualizar la contraseña."));
    setCurrent(""); setNext(""); setBusy("");
  }

  async function startEmail(event: React.FormEvent) {
    event.preventDefault(); if (!user?.token) return;
    setBusy("email"); setMessage("");
    try {
      const r = await apiPost({ action: "email_start", token: user.token, email });
      setMessage(r.msg || "No se pudo enviar el código."); setEmailSent(!!r.ok);
    } catch { setMessage("No se pudo enviar el código."); }
    finally { setBusy(""); }
  }

  async function confirmEmail(event: React.FormEvent) {
    event.preventDefault(); if (!user?.usuario) return;
    setBusy("email"); setMessage("");
    try {
      const r = await apiPost({ action: "email_confirm", usuario: user.usuario, code: emailCode });
      setMessage(r.msg || "No se pudo verificar el correo.");
      if (r.ok) { setEmailSent(false); setEmailCode(""); logout(); }
    } catch { setMessage("No se pudo verificar el correo."); }
    finally { setBusy(""); }
  }

  async function startTotp() {
    if (!user?.token) return;
    setBusy("totp"); setMessage("");
    try {
      const r = await apiPost({ action: "totp_start", token: user.token });
      if (r.ok) setTotpSecret(r.secret);
      else setMessage(r.msg || "No se pudo preparar Authenticator.");
    } catch { setMessage("No se pudo preparar Authenticator."); }
    finally { setBusy(""); }
  }

  async function finishTotp(event: React.FormEvent) {
    event.preventDefault(); if (!user?.token) return;
    setBusy("totp"); setMessage("");
    try {
      const r = await apiPost({ action: profile?.totpActivo ? "totp_disable" : "totp_confirm", token: user.token, code: totpCode });
      setMessage(r.msg || "No se pudo verificar el código.");
      if (r.ok) {
        setTotpSecret(""); setTotpCode("");
        if (r.backupCodes?.length) setBackupCodes(r.backupCodes);
        else logout();
      }
    } catch { setMessage("No se pudo verificar el código."); }
    finally { setBusy(""); }
  }

  if (!isConfigured()) return <div className="panel"><h3>Usuarios y acceso</h3><p className="muted">Conecta el backend de Google Sheets para administrar cuentas reales.</p></div>;
  return <>
    <div className="panel"><div className="panel-head"><h3>Usuarios y acceso</h3><button className="btn sm ghost" onClick={() => void load()} disabled={loading}>Actualizar</button></div><p className="muted">Las cuentas nuevas quedan pendientes. Al activarlas reciben el rol Administrador, con acceso a todos los módulos.</p>
      {message && <p className="auth-message" role="status" style={{ marginTop: 14 }}>{message}</p>}
      <div className="users-list">{accounts.map(account => <div className="user-row" key={account.id}><span className="user-avatar">{account.nombre.charAt(0).toUpperCase()}</span><div><b>{account.nombre}</b><small>@{account.usuario} · {account.rol} · {account.estado}{account.correo ? ` · ${account.correo}${account.correoVerificado === "Sí" ? " ✓" : " (sin verificar)"}` : " · sin correo"}</small></div>{account.usuario !== user?.usuario && <button className="btn sm ghost" disabled={!!busy} onClick={() => void update(account, account.estado === "Activo" ? "Suspendido" : "Activo")}>{busy === account.usuario ? "Guardando…" : account.estado === "Activo" ? "Suspender" : "Activar"}</button>}</div>)}{!loading && !accounts.length && <p className="empty">No se encontraron cuentas.</p>}</div>
    </div>
    <div className="panel"><h3>Correo de recuperación</h3><p className="muted" style={{ marginBottom: 16 }}>{profile?.correoVerificado ? `Verificado: ${profile.correo}` : "Agrega y verifica tu correo para poder recuperar la contraseña."}</p>
      <form className="user-password-form" onSubmit={startEmail}><label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><button className="btn sm" disabled={!!busy}>Enviar código</button></form>
      {emailSent && <form className="user-password-form" onSubmit={confirmEmail}><label>Código de 8 dígitos<input value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" pattern="[0-9]{8}" required /></label><button className="btn sm" disabled={!!busy}>Verificar correo</button></form>}
    </div>
    <div className="panel"><h3>Google Authenticator</h3><p className="muted" style={{ marginBottom: 16 }}>{profile?.totpActivo ? "Activado. Se pedirá un código al iniciar sesión y al recuperar la contraseña." : "Añade una segunda verificación a tu cuenta."}</p>
      {!profile?.totpActivo && !totpSecret && <button className="btn sm" disabled={!!busy} onClick={() => void startTotp()}>Configurar Authenticator</button>}
      {totpSecret && <p className="muted">En Google Authenticator, agrega una cuenta con clave de configuración. Cuenta: CorpSan Gestión. Clave: <strong className="auth-secret">{totpSecret}</strong></p>}
      {(profile?.totpActivo || totpSecret) && !backupCodes.length && <form className="user-password-form" onSubmit={finishTotp}><label>Authenticator o código de respaldo<input value={totpCode} onChange={e => setTotpCode(e.target.value.toUpperCase().replace(/[^A-F0-9-]/g, "").slice(0, 14))} pattern="([0-9]{6}|[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4})" autoComplete="one-time-code" required /></label><button className="btn sm" disabled={!!busy}>{profile?.totpActivo ? "Desactivar" : "Activar"}</button></form>}
      {!!backupCodes.length && <div className="auth-backup"><p>Guarda estos códigos de respaldo en un lugar seguro. Cada uno sirve una sola vez y no volverán a mostrarse.</p><div className="auth-backup-grid">{backupCodes.map(code => <code key={code}>{code}</code>)}</div><button className="btn sm" onClick={logout}>Ya guardé mis códigos</button></div>}
    </div>
    <div className="panel"><h3>Cambiar mi contraseña</h3><p className="muted" style={{ marginBottom: 16 }}>Al cambiarla se cerrará la sesión para que ingreses con la nueva contraseña.</p><form className="user-password-form" onSubmit={change}><label>Contraseña actual<input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required /></label><label>Nueva contraseña<input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label><button className="btn sm" disabled={busy === "password"}>{busy === "password" ? "Actualizando…" : "Guardar contraseña"}</button></form></div>
  </>;
}

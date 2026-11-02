"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost, isConfigured } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Account = { id: string; usuario: string; nombre: string; rol: string; estado: string; creado: string; ultimoAcceso: string };

export default function UserManagement() {
  const { user, changePassword } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const load = useCallback(async () => {
    if (!user?.token || !isConfigured()) return;
    setLoading(true);
    try { const r = await apiPost({ action: "users_list", token: user.token }); if (!r.ok) throw new Error(r.msg || "No se pudieron cargar las cuentas."); setAccounts(r.users || []); }
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

  if (!isConfigured()) return <div className="panel"><h3>Usuarios y acceso</h3><p className="muted">Conecta el backend de Google Sheets para administrar cuentas reales.</p></div>;
  return <>
    <div className="panel"><div className="panel-head"><h3>Usuarios y acceso</h3><button className="btn sm ghost" onClick={() => void load()} disabled={loading}>Actualizar</button></div><p className="muted">Las cuentas nuevas quedan pendientes. Al activarlas reciben el rol Administrador, con acceso a todos los módulos.</p>
      {message && <p className="auth-message" role="status" style={{ marginTop: 14 }}>{message}</p>}
      <div className="users-list">{accounts.map(account => <div className="user-row" key={account.id}><span className="user-avatar">{account.nombre.charAt(0).toUpperCase()}</span><div><b>{account.nombre}</b><small>@{account.usuario} · {account.rol} · {account.estado}</small></div>{account.usuario !== user?.usuario && <button className="btn sm ghost" disabled={!!busy} onClick={() => void update(account, account.estado === "Activo" ? "Suspendido" : "Activo")}>{busy === account.usuario ? "Guardando…" : account.estado === "Activo" ? "Suspender" : "Activar"}</button>}</div>)}{!loading && !accounts.length && <p className="empty">No se encontraron cuentas.</p>}</div>
    </div>
    <div className="panel"><h3>Cambiar mi contraseña</h3><p className="muted" style={{ marginBottom: 16 }}>Al cambiarla se cerrará la sesión para que ingreses con la nueva contraseña.</p><form className="user-password-form" onSubmit={change}><label>Contraseña actual<input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required /></label><label>Nueva contraseña<input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label><button className="btn sm" disabled={busy === "password"}>{busy === "password" ? "Actualizando…" : "Guardar contraseña"}</button></form></div>
  </>;
}

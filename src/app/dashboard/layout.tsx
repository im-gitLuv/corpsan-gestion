"use client";

/**
 * Shell del panel: protege la sesión, monta el sidebar, el topbar
 * y el proveedor de datos (Apps Script o modo demo).
 */
import { useEffect } from "react";
import { LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ic, Icons } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { DataProvider } from "@/lib/store";

function SideLink({ href, active, icon, children }: { href: string; active: boolean; icon: string[]; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <Link href={href} className={active ? "active" : ""}>
    {active && <m.span className="side-active-glow" layoutId="side-active-glow" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 550, damping: 42 }} />}
    <Ic d={icon} /><span>{children}</span>
  </Link>;
}

function Sidebar() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();

  const iniciales = (user?.nombre || user?.usuario || "CS")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside className="side">
      <div className="brand">
        <span className="logo-chip has-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-img" src="/logo-santamaria.png" alt="Corporación Santamaría, C.A." />
        </span>
        <span className="brand-txt"><b>CS Gestión</b><small>Corp. Santamaría, C.A.</small></span>
      </div>

      <nav className="side-nav">
        <span className="side-label">General</span>
        <SideLink href="/dashboard" active={path === "/dashboard"} icon={Icons.home}>Resumen</SideLink>

        <span className="side-label">Gestión</span>
        <SideLink href="/dashboard/bancos" active={path.startsWith("/dashboard/bancos")} icon={Icons.wallet}>Bancos y cuentas</SideLink>
        <SideLink href="/dashboard/talento-humano" active={path.startsWith("/dashboard/talento-humano")} icon={Icons.users}>Talento Humano</SideLink>
        <SideLink href="/dashboard/nomina" active={path.startsWith("/dashboard/nomina")} icon={Icons.wallet}>Nómina y Pagos</SideLink>
        <SideLink href="/dashboard/finanzas" active={path.startsWith("/dashboard/finanzas")} icon={Icons.wallet}>Finanzas y Conciliaciones</SideLink>
        <span className="nav-disabled" title="Módulo planificado — ver hoja de requerimientos">
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Ic d={Icons.box} /><span>Inventario y Equipos</span>
          </span>
          <span className="soon">Pronto</span>
        </span>
        <span className="nav-disabled" title="Módulo planificado — ver hoja de requerimientos">
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Ic d={Icons.doc} /><span>Proveedores y Facturas</span>
          </span>
          <span className="soon">Pronto</span>
        </span>

        <span className="side-label">Sistema</span>
        <SideLink href="/dashboard/configuracion" active={path.startsWith("/dashboard/configuracion")} icon={Icons.gear}>Configuración</SideLink>
      </nav>

      <div className="me">
        <div className="avatar">{iniciales}</div>
        <div>
          <b>{user?.nombre || user?.usuario}</b>
          <small>{user?.rol}</small>
        </div>
        <button className="mini" title="Cerrar sesión" onClick={() => { logout(); router.push("/"); }}>
          <Ic d={Icons.logout} />
        </button>
      </div>
    </aside>
  );
}

function Topbar({ titulo }: { titulo: string }) {
  const { conn } = useData();
  return (
    <header className="topbar">
      <h2>{titulo}</h2>
      {conn === "ok" && <span className="badge ok">● Conectado a Google Sheets</span>}
      {conn === "demo" && <span className="badge demo">● Modo demo local</span>}
      {conn === "cargando" && <span className="badge load">● Cargando…</span>}
    </header>
  );
}

const TITULOS: Record<string, string> = {
  "/dashboard": "Resumen general",
  "/dashboard/talento-humano": "Gestión de Talento Humano",
  "/dashboard/nomina": "Nómina y Pagos",
  "/dashboard/finanzas": "Finanzas y Conciliaciones",
  "/dashboard/bancos": "Bancos y cuentas",
  "/dashboard/configuracion": "Configuración del sistema",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#8a8a8e" }}>Cargando…</div>;
  }

  return (
    <DataProvider>
      <LazyMotion features={domMax}>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <Topbar titulo={TITULOS[path] || "Panel"} />
          <m.div key={path} className="content" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>{children}</m.div>
        </main>
      </div>
      </LazyMotion>
    </DataProvider>
  );
}

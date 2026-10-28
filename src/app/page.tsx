"use client";

/**
 * Landing corporativa + acceso al sistema.
 * Porta del template index.html con datos reales de Corporación Santamaría, C.A.
 * Por ahora solo existe el rol Administrador.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ic, Icons } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toaster";
import { isConfigured } from "@/lib/api";

export default function Landing() {
  const { login, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [chip, setChip] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function hacerLogin(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    const r = await login(usuario, clave);
    setCargando(false);
    if (r.ok) {
      toast("Bienvenido al sistema de gestión CorpSan");
    } else {
      toast(r.msg || "No se pudo iniciar sesión", true);
    }
  }

  function prefillAdmin() {
    setUsuario("admin");
    setClave("admin123");
    setChip(true);
  }

  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);

  // si ya hay sesión activa, ir directo al panel
  if (user) {
    return null;
  }

  return (
    <div>
      {/* ───── Topstrip ───── */}
      <div className="topstrip">
        <div className="container">
          <span><b>RIF:</b> J-31290505-0</span>
          <span>Servicios a la industria petrolera · Metalmecánica · Logística</span>
          <span>Maturín, Monagas · 0414-3942826 · contacto@corp-sm.com</span>
        </div>
      </div>

      {/* ───── Nav ───── */}
      <header className="nav">
        <div className="container nav-in">
          <a className="brand" href="#inicio">
            <span className="logo-chip has-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo-img" src="/logo-santamaria.png" alt="Corporación Santamaría, C.A." />
            </span>
            <span className="brand-txt"><b>CorpSan</b><small>Gestión Administrativa</small></span>
          </a>
          <nav className="nav-links">
            <a href="#servicios">Servicios</a>
            <a href="#sistema">El sistema</a>
            <a href="#integracion">Integración</a>
            <a href="#acceso">Acceso</a>
          </nav>
          <a href="#acceso" className="btn sm">Iniciar sesión</a>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section className="hero" id="inicio">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ring-img ok" src="/logo-hero.png" alt="" />
        <div className="container hero-grid">
          <p className="kicker">Sistema de Gestión Administrativa</p>
          <h1 className="display">Gestión a la <em>altura</em> de tu industria</h1>
          <p className="lead">
            Corporación Santamaría, C.A. digitaliza su administración: talento humano, registros y
            reportes con permisos por rol, sincronizado directamente con <strong>Google Sheets</strong>.
          </p>
          <div className="hero-cta">
            <a href="#acceso" className="btn">Acceder al sistema</a>
            <a href="#sistema" className="btn ghost">Ver módulos</a>
          </div>
        </div>
      </section>

      <div className="stripe"></div>

      {/* ───── Stats ───── */}
      <div className="stats-wrap">
        <div className="container">
          <div className="stats">
            <div className="stat"><strong>+20</strong><small>Años de trayectoria en el Oriente venezolano</small></div>
            <div className="stat"><strong>33</strong><small>Puestos representados en el organigrama</small></div>
            <div className="stat"><strong>100%</strong><small>Trazabilidad de personal y registros</small></div>
            <div className="stat"><strong>0</strong><small>Servidores propios: 100% ecosistema Google</small></div>
          </div>
        </div>
      </div>

      {/* ───── Servicios ───── */}
      <section className="sec" id="servicios">
        <div className="container">
          <div className="sec-head">
            <p className="kicker">Quiénes somos</p>
            <h2>Servicios polivalentes, <em>administración de precisión</em></h2>
            <p>Una empresa de servicios para la industria petrolera y metalmecánica del Oriente del país, con un sistema administrativo a la altura de su operación en campo.</p>
          </div>
          <div className="grid3">
            <div className="card dark">
              <div className="icon-sq"><Ic d={Icons.flame} big /></div>
              <h3>Industria Petrolera</h3>
              <ul>
                <li><Ic d={Icons.check} />Servicios a pozos y well testing</li>
                <li><Ic d={Icons.check} />Mantenimiento mayor de equipos</li>
                <li><Ic d={Icons.check} />Personal HSE y supervisión de campo</li>
              </ul>
            </div>
            <div className="card">
              <div className="icon-sq"><Ic d={Icons.wrench} big /></div>
              <h3>Metalmecánica</h3>
              <ul>
                <li><Ic d={Icons.check} />Soldadura especializada y herrería</li>
                <li><Ic d={Icons.check} />Tornería, fresado y mecanizado de precisión</li>
                <li><Ic d={Icons.check} />Estructuras metálicas y montaje</li>
              </ul>
            </div>
            <div className="card">
              <div className="icon-sq"><Ic d={Icons.truck} big /></div>
              <h3>Logística y Transporte</h3>
              <ul>
                <li><Ic d={Icons.check} />Transporte pesado local, regional y nacional</li>
                <li><Ic d={Icons.check} />Alquiler de maquinaria y equipos</li>
                <li><Ic d={Icons.check} />Izamiento y mudanzas de taladros</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Módulos ───── */}
      <section className="sec alt" id="sistema">
        <div className="container">
          <div className="sec-head">
            <p className="kicker">El sistema</p>
            <h2>Todo lo que tu departamento administrativo <em>necesita</em></h2>
            <p>Módulos conectados entre sí, con control de acceso por rol y respaldo en Google Sheets: la información siempre disponible para quien la necesita.</p>
          </div>
          <div className="mod-grid">
            <div className="mod on">
              <div className="icon-sq"><Ic d={Icons.users} big /></div>
              <h3>Talento Humano</h3>
              <p>Expediente completo del personal: datos generales, documentos, datos bancarios, laborales y remuneración. Alta, edición y baja en segundos.</p>
              <span className="soon-tag">Disponible</span>
            </div>
            <div className="mod on">
              <div className="icon-sq"><Ic d={Icons.shield} big /></div>
              <h3>Roles y permisos</h3>
              <p>Acceso restringido por rol. Fase preliminar: solo administradores; RRHH, tesorería y supervisión se incorporarán según el plan de la empresa.</p>
              <span className="soon-tag">Disponible</span>
            </div>
            <div className="mod on">
              <div className="icon-sq"><Ic d={Icons.link} big /></div>
              <h3>Integración Google Sheets</h3>
              <p>Lee y escribe directamente en la base de talento humano de CorpSan mediante Google Apps Script. Sin servidores ni bases de datos externas.</p>
              <span className="soon-tag">Disponible</span>
            </div>
            <div className="mod">
              <div className="icon-sq"><Ic d={Icons.wallet} big /></div>
              <h3>Nómina y pagos</h3>
              <p>Registro de quincenas, bonos, horas extras y utilidades con período, método de pago y estatus.</p>
              <span className="soon-tag">Próximamente</span>
            </div>
            <div className="mod">
              <div className="icon-sq"><Ic d={Icons.box} big /></div>
              <h3>Inventario y equipos</h3>
              <p>Activos propios y alquilados, seriales, propietarios y soportes asociados a cada servicio.</p>
              <span className="soon-tag">Próximamente</span>
            </div>
            <div className="mod">
              <div className="icon-sq"><Ic d={Icons.doc} big /></div>
              <h3>Reportes gerenciales</h3>
              <p>Resúmenes, distribución por área y exportación lista para la gerencia.</p>
              <span className="soon-tag">Próximamente</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Integración ───── */}
      <section className="sec" id="integracion">
        <div className="container">
          <div className="sec-head">
            <p className="kicker">Integración</p>
            <h2>Conectado a <em>Google Sheets</em> en 4 pasos</h2>
            <p>Google Apps Script funciona como backend: la hoja de cálculo es tu base de datos y el sistema es la interfaz.</p>
          </div>
          <div className="steps">
            <div className="step"><span className="num">01</span><h3>Abre tu hoja</h3><p>Usa la base <b>BD TALENTO HUMANO</b> de CorpSan, con las pestañas de personal activo e inactivo.</p></div>
            <div className="step"><span className="num">02</span><h3>Pega el backend</h3><p>En <b>Extensiones → Apps Script</b>, pega el código <code>Code.gs</code> incluido en el proyecto.</p></div>
            <div className="step"><span className="num">03</span><h3>Despliega la app</h3><p><b>Implementar → Nueva implementación → Aplicación web</b> con acceso para «cualquier usuario».</p></div>
            <div className="step"><span className="num">04</span><h3>Conecta la URL</h3><p>Pega la URL <code>/exec</code> en <b>Configuración</b> dentro del sistema y pulsa «Probar conexión».</p></div>
          </div>
          <div className="note">
            <Ic d={Icons.check} />
            <span><b>Sin servidores, sin costos extra.</b> Tu cuenta de Google es toda la infraestructura: la hoja de cálculo guarda los datos y Apps Script los procesa de forma segura.</span>
          </div>
        </div>
      </section>

      {/* ───── Acceso / Login ───── */}
      <section className="sec alt" id="acceso">
        <div className="container">
          <div className="login-card">
            <div className="login-left">
              <p className="kicker">Acceso restringido</p>
              <h3>Panel de control</h3>
              <ul>
                <li><Ic d={Icons.check} />Permisos por rol (fase preliminar: administradores)</li>
                <li><Ic d={Icons.check} />Base de talento humano 100% trazable</li>
                <li><Ic d={Icons.check} />Sincronización en vivo con Google Sheets</li>
                <li><Ic d={Icons.check} />Funciona sin backend en modo demo</li>
              </ul>
              <div className="cred">
                <b>Credenciales preliminares</b> — rol administrador:{<br />}
                {<br />}
                <code>admin / admin123</code>
                {!isConfigured() && <> (demo local)</>}
              </div>
              <svg className="ring2" viewBox="0 0 300 260" aria-hidden="true">
                <ellipse cx="150" cy="130" rx="130" ry="68" fill="none" stroke="#FDB913" strokeWidth="22" transform="rotate(-18 150 130)" />
              </svg>
            </div>
            <div className="login-right">
              <h3>Iniciar sesión</h3>
              <p className="muted">Accede con tu cuenta de administrador de CorpSan.</p>
              <div className="chips">
                <button className={"chip" + (chip ? " active" : "")} type="button" onClick={prefillAdmin}>Administrador</button>
              </div>
              <form onSubmit={hacerLogin}>
                <label>Usuario
                  <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
                </label>
                <label>Contraseña
                  <input value={clave} type="password" onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
                </label>
                <button className="btn wide" type="submit" disabled={cargando}>
                  {cargando ? "Verificando…" : "Ingresar al sistema"}
                </button>
              </form>
              <p className="tiny">
                Al conectar Google Sheets (panel <b>Configuración</b>), la validación se realiza contra el
                backend de Apps Script. Cambia la clave preliminar antes del uso operativo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer>
        <div className="container foot-grid">
          <div>
            <a className="brand" href="#inicio" style={{ color: "#fff" }}>
              <span className="logo-chip has-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="logo-img" src="/logo-santamaria.png" alt="Corporación Santamaría, C.A." />
              </span>
              <span className="brand-txt"><b style={{ color: "#fff" }}>CorpSan</b><small>Gestión Administrativa</small></span>
            </a>
            <p style={{ fontSize: 14, marginTop: 14, lineHeight: 1.6 }}>
              Servicios polivalentes para la industria petrolera y metalmecánica del Oriente venezolano.
              Personal calificado, administración moderna y trazabilidad total.
            </p>
          </div>
          <div>
            <h4>Módulos</h4>
            <a href="#sistema">Talento Humano</a>
            <a href="#sistema">Roles y permisos</a>
            <a href="#sistema">Nómina y pagos (próximamente)</a>
            <a href="#integracion">Integración Sheets</a>
          </div>
          <div>
            <h4>Contacto</h4>
            <a href="#acceso">Quinta Sanavi No. 14, Av. El Ejército, Maturín</a>
            <a href="#acceso">0414-3942826</a>
            <a href="#acceso">contacto@corp-sm.com</a>
          </div>
        </div>
        <div className="container foot-bottom">
          <span>© 2026 <b>Corporación Santamaría, C.A.</b> — RIF J-31290505-0</span>
          <span>Sistema de Gestión Administrativa · Preliminar v0.1</span>
        </div>
      </footer>
    </div>
  );
}

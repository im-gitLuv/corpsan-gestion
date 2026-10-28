"use client";

/** Conexión con el backend de Apps Script + utilidades del modo demo. */
import { useEffect, useState } from "react";
import { getUrl, ping, setUrl } from "@/lib/api";
import { useData } from "@/lib/store";
import { useToast } from "@/components/Toaster";

export default function Configuracion() {
  const { recargar, resetDemo, conn, error } = useData();
  const { toast } = useToast();
  const [url, setUrlInput] = useState("");
  const [probando, setProbando] = useState(false);
  const [detalle, setDetalle] = useState<string>("");

  useEffect(() => { setUrlInput(getUrl()); }, []);

  async function probar() {
    if (!url.trim()) return toast("Primero pega la URL del Web App", true);
    setProbando(true);
    setDetalle("");
    try {
      const r = await ping();
      if (r.ok) {
        setUrl(url.trim());
        toast("Conexión exitosa con Google Sheets");
        setDetalle(JSON.stringify(r, null, 2));
        await recargar();
      } else {
        toast(r.msg || "Respuesta no válida del backend", true);
        setDetalle(JSON.stringify(r, null, 2));
      }
    } catch (e: any) {
      toast("No se pudo conectar: " + (e.message || "error de red"), true);
    } finally {
      setProbando(false);
    }
  }

  function guardar() {
    if (url.trim()) {
      setUrl(url.trim());
      toast("URL guardada. Verificando…");
      probar();
    } else {
      setUrl("");
      toast("Backend desconectado — modo demo");
      recargar();
    }
  }

  function desconectar() {
    setUrl("");
    setUrlInput("");
    setDetalle("");
    toast("Desconectado — modo demo local");
    recargar();
  }

  return (
    <div>
      <div className="panel">
        <h3>Conexión con Google Sheets (backend)</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Pega la URL de tu Aplicación web de Apps Script (termina en <code>/exec</code>). Sin URL,
          el sistema funciona en <b>modo demo</b> con datos locales ficticios.
          {conn === "demo" && error && <> Último error: <b style={{ color: "var(--danger)" }}>{error}</b></>}
        </p>
        <div className="cfg-row">
          <input
            value={url}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
          />
          <button className="btn sm" onClick={guardar} disabled={probando}>Guardar</button>
          <button className="btn sm ghost" onClick={probar} disabled={probando}>
            {probando ? "Probando…" : "Probar conexión"}
          </button>
          <button className="btn sm ghost" onClick={desconectar}>Desconectar</button>
        </div>
        <ol className="mini-steps">
          <li>Abre la hoja <b>BD TALENTO HUMANO</b> de CorpSan en Google Sheets.</li>
          <li>En <b>Extensiones → Apps Script</b>, pega el contenido de <code>apps-script/Code.gs</code> (del proyecto) y guarda.</li>
          <li><b>Implementar → Nueva implementación → Aplicación web</b> · Ejecutar como: <b>yo</b> · Acceso: <b>cualquier usuario</b>.</li>
          <li>Copia la URL <code>/exec</code>, pégala arriba y pulsa <b>Probar conexión</b>.</li>
        </ol>
        <p className="tiny">
          Para producción en Vercel, define también la variable de entorno <code>NEXT_PUBLIC_APPS_SCRIPT_URL</code>
          (ver <code>.env.example</code>). El valor pegado aquí tiene prioridad en este navegador.
        </p>
      </div>

      {detalle && (
        <div className="panel">
          <div className="panel-head">
            <h3>Respuesta del backend (ping)</h3>
          </div>
          <pre>{detalle}</pre>
          <p className="tiny">
            Verifica que <b>columnasReconocidas</b> sea cercano a <b>columnasDetectadas</b> y que
            <b> tieneColumnaEstado</b> sea true. Los encabezados que el backend no reconoce aparecen
            en <b>columnasSinMapear</b>: si falta algún campo, agrega su nombre al diccionario en <code>Code.gs</code>.
          </p>
        </div>
      )}

      <div className="panel">
        <h3>Zona de pruebas</h3>
        <button
          className="btn sm ghost"
          onClick={() => { resetDemo(); toast("Datos demo restablecidos"); }}
        >
          Restablecer datos demo
        </button>
        <p className="tiny">Borra los cambios locales del modo demo (no afecta Google Sheets).</p>
      </div>

      <div className="panel">
        <h3>Seguridad — pendientes antes de uso operativo</h3>
        <ul className="mini-steps" style={{ marginTop: 6 }}>
          <li>Cambiar la clave preliminar <code>admin123</code> en <code>Code.gs</code> (constantes <code>ADMIN_USER</code> / <code>ADMIN_PASS</code>).</li>
          <li>Mantener el repositorio de GitHub <b>privado</b> y compartir el link de Vercel solo con personal autorizado.</li>
          <li>La base contiene datos personales y bancarios: minimizar capturas y exportaciones; el acceso «cualquier usuario» del Web App debe restringirse cuando exista un flujo con cuenta Google.</li>
          <li>Respaldar el sheet (Archivo → Descargar .xlsx) antes de cargas masivas.</li>
        </ul>
      </div>
    </div>
  );
}

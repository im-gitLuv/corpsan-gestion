"use client";

/**
 * Módulo genérico de Gestión Administrativa: tabla + búsqueda + modal de
 * edición a partir del esquema de la colección (src/lib/adm.ts).
 * Lo reutilizan compras, recibos, cotizaciones, órdenes, facturas,
 * proveedores, declaraciones, pólizas, solvencias, comunicaciones y
 * requisiciones.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Ic, Icons } from "@/components/icons";
import { useToast } from "@/components/Toaster";
import { ADM_COLECCIONES, ADM_RETENCION_RECIBO, admDinero, type AdmCampo, type AdmRow } from "@/lib/adm";
import { admEtiqueta, type AdmApi } from "@/lib/adm-store";

export interface AdmColumnaExtra {
  key: string;
  label: string;
  render: (fila: AdmRow) => ReactNode;
}

interface Props {
  api: AdmApi;
  coleccion: string;
  titulo: string;
  descripcion?: string;
  textoNuevo?: string;
  busqueda?: string;
  bancos?: string[];
  columnasExtra?: AdmColumnaExtra[];
  celda?: (key: string, fila: AdmRow) => ReactNode | undefined;
  accionesExtra?: (fila: AdmRow) => ReactNode;
  panelSuperior?: ReactNode;
}

export default function AdmModule({
  api, coleccion, titulo, descripcion, textoNuevo, busqueda, bancos,
  columnasExtra = [], celda, accionesExtra, panelSuperior,
}: Props) {
  const def = ADM_COLECCIONES[coleccion];
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ abierto: boolean; fila: AdmRow | null }>({ abierto: false, fila: null });
  const [guardando, setGuardando] = useState(false);

  const filas = useMemo(() => {
    const orden = def.orden || "Fecha";
    return (api.datos[coleccion] || [])
      .slice()
      .sort((a, b) => String(b[orden] ?? b.ID ?? "").localeCompare(String(a[orden] ?? a.ID ?? "")));
  }, [api.datos, coleccion, def]);

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return filas;
    return filas.filter((f) => Object.values(f).some((v) => String(v ?? "").toLowerCase().includes(s)));
  }, [filas, q]);

  const visibles = def.campos.filter((c) => c.tabla && !c.oculto);
  const totalCeldas = visibles.length + columnasExtra.length + 1;

  async function enviar(data: AdmRow, existente: AdmRow | null) {
    setGuardando(true);
    try {
      await api.guardar(coleccion, data);
      toast(existente ? "Registro actualizado" : "Registro creado");
      setModal({ abierto: false, fila: null });
    } catch (e) {
      throw e;
    } finally {
      setGuardando(false);
    }
  }

  function pedirEliminar(f: AdmRow) {
    const etiqueta = visibles[0]?.key || "ID";
    const nombre = String(f[etiqueta] ?? f.ID ?? "");
    if (!window.confirm(`¿Eliminar el registro «${nombre}»?\n\nLa fila se borra de la hoja ${def.hoja} y no se puede deshacer.`)) return;
    api.eliminar(coleccion, String(f.ID))
      .then(() => toast("Registro eliminado"))
      .catch((e) => toast((e as Error).message || "Error al eliminar", true));
  }

  return (
    <section className="adm-modulo" aria-busy={!api.listo}>
      <div className="adm-encabezado">
        <div>
          <h4>{titulo}</h4>
          {descripcion && <p>{descripcion}</p>}
        </div>
        <button className="btn sm" onClick={() => setModal({ abierto: true, fila: null })} disabled={!api.listo}>
          {textoNuevo || "+ Nuevo registro"}
        </button>
      </div>

      {panelSuperior}

      <div className="toolbar">
        <div className="search">
          <Ic d={Icons.search} />
          <input placeholder={busqueda || "Buscar…"} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="adm-contador" aria-live="polite">{filtradas.length} de {filas.length}</span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {visibles.map((c) => <th key={c.key}>{c.label}</th>)}
              {columnasExtra.map((c) => <th key={c.key}>{c.label}</th>)}
              <th className="col-acc"></th>
            </tr>
          </thead>
          <tbody>
            {!api.listo && <tr><td colSpan={totalCeldas} className="empty">Cargando…</td></tr>}
            {api.listo && filtradas.length === 0 && (
              <tr><td colSpan={totalCeldas} className="empty">Sin registros para mostrar</td></tr>
            )}
            {api.listo && filtradas.map((f) => (
              <tr key={String(f.ID ?? f._fila ?? Math.random())}>
                {visibles.map((c) => <td key={c.key}>{(celda ? celda(c.key, f) : undefined) ?? celdaPorDefecto(c, f)}</td>)}
                {columnasExtra.map((c) => <td key={c.key}>{c.render(f)}</td>)}
                <td className="col-acc">
                  <div className="acc">
                    {accionesExtra && accionesExtra(f)}
                    <button className="mini" title="Editar" onClick={() => setModal({ abierto: true, fila: f })}><Ic d={Icons.edit} /></button>
                    <button className="mini danger" title="Eliminar" onClick={() => pedirEliminar(f)}><Ic d={Icons.trash} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdmForm
        abierto={modal.abierto}
        coleccion={coleccion}
        fila={modal.fila}
        siguiente={api.siguiente[coleccion] || ""}
        bancos={bancos}
        guardando={guardando}
        onCerrar={() => setModal({ abierto: false, fila: null })}
        onEnviar={(data) => enviar(data, modal.fila)}
      />
    </section>
  );
}

function celdaPorDefecto(c: AdmCampo, f: AdmRow): ReactNode {
  const v = f[c.key];
  if (c.key === "PctRetencion") {
    const n = Number(v);
    return n ? `${(n * 100).toLocaleString("es-VE", { maximumFractionDigits: 2 })}%` : "—";
  }
  if (c.key === "Direccion" || c.key === "Departamento") return admEtiqueta(c.key, v) || "—";
  if (c.tipo === "numero") {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "—";
    const dinero = ["Monto", "Total", "Base", "Prima", "Saldo", "Neto", "Retencion", "PorCobrar", "MontoCobrado", "Anticipos", "Cobrado", "MontoAsegurado", "MontoDeclarado"].includes(c.key);
    return dinero ? admDinero(n) : String(n);
  }
  const s = String(v ?? "");
  return s || "—";
}

// ─────────────────────────────────────────────
// Formulario modal dirigido por el mismo esquema
// ─────────────────────────────────────────────
function AdmForm({
  abierto, coleccion, fila, siguiente, bancos, guardando, onCerrar, onEnviar,
}: {
  abierto: boolean;
  coleccion: string;
  fila: AdmRow | null;
  siguiente: string;
  bancos?: string[];
  guardando: boolean;
  onCerrar: () => void;
  onEnviar: (data: AdmRow) => Promise<void>;
}) {
  const def = ADM_COLECCIONES[coleccion];
  const [form, setForm] = useState<AdmRow>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    const init: AdmRow = {};
    def.campos.forEach((c) => { init[c.key] = fila ? (fila[c.key] ?? "") : ""; });
    // Selects sin opción vacía: el estado nace en la primera opción (la que muestra el navegador).
    def.campos.forEach((c) => {
      if (!fila && c.tipo === "select" && c.opciones && !c.opciones.includes("") && !init[c.key]) init[c.key] = c.opciones[0];
    });
    if (!fila && coleccion === "RECIBOS") { init.Tipo = "Servicio"; init.PctRetencion = ADM_RETENCION_RECIBO.Servicio; init.Estado = "Emitido"; }
    if (!fila && coleccion === "COMPRAS") { init.Tipo = "Compra"; init.Documento = "Factura"; init.FormaPago = "Transferencia"; }
    if (!fila && coleccion === "COTIZACIONES") { init.Moneda = "USD"; init.Estatus = "En elaboración"; }
    if (!fila && coleccion === "FACTURAS") { init.Cobrada = "NO"; }
    if (!fila && coleccion === "ORDENES") { init.Estatus = "Programada"; }
    if (!fila && coleccion === "COMUNICACIONES") { init.Direccion = "I"; init.Departamento = "AD"; init.Estado = "En trámite"; }
    if (!fila && coleccion === "REQUISICIONES") { init.Modelo = "Genérica"; init.Estatus = "Pendiente"; init.Prioridad = "Normal"; init.Departamento = "AD"; }
    if (!fila && coleccion === "DECLARACIONES") { init.Estatus = "Programada"; }
    if (!fila && coleccion === "POLIZAS") { init.Tipo = "Póliza"; }
    setForm(init);
    setError("");
  }, [abierto, fila, def, coleccion]);

  if (!abierto) return null;

  const set = (k: string, v: unknown) => {
    setForm((f) => {
      const next = { ...f, [k]: v } as AdmRow;
      // Al cambiar el tipo de recibo se sugiere su retención (2 % / 1 %).
      if (k === "Tipo" && coleccion === "RECIBOS" && !fila) next.PctRetencion = ADM_RETENCION_RECIBO[String(v)] ?? f.PctRetencion;
      return next;
    });
  };

  const campos = def.campos.filter((c) => !c.oculto);

  return (
    <div className="overlay open" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form className="modal wide" onSubmit={(e) => { e.preventDefault(); enviarForm(); }}>
        <button type="button" className="modal-close" aria-label="Cerrar" onClick={onCerrar}>×</button>
        <h3>{fila ? "Editar" : "Nuevo"} · {def.nombre}</h3>
        <div className="form-section">
          <div className="grid2">
            {campos.map((c) => renderCampo(c))}
          </div>
        </div>
        {error && <p className="adm-form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn sm ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn sm" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );

  function renderCampo(c: AdmCampo) {
    const v = form[c.key] ?? "";
    const cls = c.full ? "full" : "";
    const ayuda = c.ayuda ? <small className="adm-ayuda">{c.ayuda}</small> : null;

    if (c.autogenerado) {
      return (
        <label key={c.key} className={cls}>{c.label} (automático)
          <input value={valorAutogenerado(c.key)} disabled />
          {ayuda}
        </label>
      );
    }
    if (c.tipo === "select") {
      return (
        <label key={c.key} className={cls}>{c.label}{c.requerido ? " *" : ""}
          <select value={String(v)} onChange={(e) => set(c.key, e.target.value)}>
            {(c.opciones || []).map((o) => <option key={o} value={o}>{o || "—"}</option>)}
          </select>
          {ayuda}
        </label>
      );
    }
    if (c.tipo === "textarea") {
      return (
        <label key={c.key} className={cls}>{c.label}{c.requerido ? " *" : ""}
          <textarea rows={3} value={String(v)} onChange={(e) => set(c.key, e.target.value)} />
          {ayuda}
        </label>
      );
    }
    if (c.key === "Banco" && bancos && bancos.length) {
      return (
        <label key={c.key} className={cls}>{c.label}
          <input value={String(v)} list="adm-bancos" onChange={(e) => set(c.key, e.target.value)} placeholder="Banco de la cuenta" />
          <datalist id="adm-bancos">{bancos.map((b) => <option key={b} value={b} />)}</datalist>
          {ayuda}
        </label>
      );
    }
    const tipo = c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : c.tipo === "url" ? "url" : "text";
    return (
      <label key={c.key} className={cls}>{c.label}{c.requerido ? " *" : ""}
        <input
          type={tipo}
          step={tipo === "number" ? (c.key === "PctRetencion" ? "0.001" : "any") : undefined}
          min={tipo === "number" ? (c.min ?? 0) : undefined}
          value={String(v)}
          onChange={(e) => set(c.key, c.tipo === "numero" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        />
        {ayuda}
      </label>
    );
  }

  function valorAutogenerado(key: string): string {
    if (key === "ID") {
      if (fila) return String(fila.ID ?? "");
      if (coleccion === "COMUNICACIONES") {
        const anio = String(form.Fecha ?? "").slice(0, 4) || String(new Date().getFullYear());
        const num = String(siguiente).split("-").pop() || "00000";
        return `CS-${anio}-${form.Direccion || "I"}-${form.Departamento || "AD"}-${num}`;
      }
      return siguiente || "Se asigna al guardar";
    }
    // Totales y netos en vivo mientras se escribe el formulario.
    const numero = (k: string) => Number(form[k] === "" || form[k] === undefined ? 0 : form[k]) || 0;
    if (coleccion === "COMPRAS" && key === "Total") return admDinero(numero("Base") + numero("IVA"));
    if (coleccion === "FACTURAS" && key === "Total") return admDinero(numero("Base") + numero("IVA"));
    if (coleccion === "FACTURAS" && key === "Saldo") return admDinero(numero("Base") + numero("IVA") - numero("MontoCobrado"));
    if (coleccion === "RECIBOS" && key === "Retencion") return admDinero(numero("Monto") * numero("PctRetencion"));
    if (coleccion === "RECIBOS" && key === "Neto") return admDinero(numero("Monto") * (1 - numero("PctRetencion")));
    if (coleccion === "ORDENES" && key === "PorCobrar") return admDinero(numero("Monto") - numero("Cobrado"));
    return "—";
  }

  async function enviarForm() {
    setError("");
    try {
      const datos: AdmRow = {};
      def.campos.forEach((c) => { if (!c.oculto) datos[c.key] = form[c.key] ?? ""; });
      if (fila) datos.ID = fila.ID; // conservar el código ya asignado
      await onEnviar(datos);
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar");
    }
  }
}

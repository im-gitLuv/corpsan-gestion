"use client";

/**
 * Modal de expediente de Talento Humano.
 * Agrupa los 54 campos del sheet en secciones (Datos generales, Constancias,
 * Bancarios, Emergencia, Laborales, Remuneración y Validación de recibos).
 */
import { useEffect, useMemo, useState } from "react";
import { COLS, GROUPS, HIDDEN_KEYS, type ColDef } from "@/lib/columns";
import {
  DISTRIBUCION_NOMINA, PAGOS_DEFAULTS, fmtPct, opcionesPorcentaje,
  totalDistribucion, validarDistribucion,
} from "@/lib/nomina";
import type { Empleado, HojaTH } from "@/lib/types";

interface Props {
  abierto: boolean;
  hoja: HojaTH;
  empleado: Empleado | null; // null = nuevo registro
  onGuardar: (data: Empleado) => Promise<void>;
  onCerrar: () => void;
}

const MONTH_KEYS = new Set(COLS.filter((c) => c.type === "month").map((c) => c.key));
const NUM_KEYS = new Set(COLS.filter((c) => c.type === "number").map((c) => c.key));

export default function RecordModal({ abierto, hoja, empleado, onGuardar, onCerrar }: Props) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    const init: Record<string, any> = {};
    COLS.forEach((c) => {
      const fallback = c.group === "distribucionNomina" ? PAGOS_DEFAULTS[c.key as keyof typeof PAGOS_DEFAULTS] : "";
      init[c.key] = empleado ? empleado[c.key] ?? fallback : fallback;
    });
    setForm(init);
    setError("");
  }, [abierto, empleado]);

  const total = useMemo(() => {
    const s = Number(form.sueldoMensual) || 0;
    const b = Number(form.bonoAlimentacion) || 0;
    const a = Number(form.ayudaUnica) || 0;
    const c = Number(form.comisiones) || 0;
    const v = Number(form.bonoVacacional) || 0;
    const o = Number(form.otros) || 0;
    return s + b + a + c + v + o;
  }, [form.sueldoMensual, form.bonoAlimentacion, form.ayudaUnica, form.comisiones, form.bonoVacacional, form.otros]);

  if (!abierto) return null;

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleMes = (k: string) => set(k, form[k] === "X" ? "" : "X");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!String(form.nombre ?? "").trim() || !String(form.cedula ?? "").trim()) {
      setError("Nombre y Apellido y Cédula son obligatorios");
      return;
    }
    const distribucionError = validarDistribucion(form);
    if (distribucionError) {
      setError(distribucionError);
      return;
    }
    const data: Record<string, any> = {};
    COLS.forEach((c) => {
      if (c.key === "n" || HIDDEN_KEYS.has(c.key)) return;
      let v = form[c.key] ?? "";
      if (NUM_KEYS.has(c.key)) v = v === "" ? "" : Number(v);
      if (c.key === "totalRemuneracion") v = total || "";
      data[c.key] = v;
    });
    setGuardando(true);
    try {
      await onGuardar(data as Empleado);
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const grupos = GROUPS.filter((g) => g.key !== "recibos" || true); // se muestran todos
  const aplica = (c: ColDef) => !(c.soloInactivos && hoja !== "inactivos");
  const camposDe = (g: string) => COLS.filter((c) => c.group === g && !HIDDEN_KEYS.has(c.key) && c.key !== "n" && aplica(c));

  return (
    <div className="overlay open" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form className="modal wide" onSubmit={enviar}>
        <h3>{empleado ? "Editar expediente" : "Nuevo registro"} — {hoja === "activos" ? "Personal Activo" : "Inactivos"}</h3>

        {grupos.map((g) => (
          <div className="form-section" key={g.key}>
            <h4>{g.label}</h4>
            {g.key === "datos" && (
              <div className="grid2">
                <label>N° (automático)
                  <input value={empleado ? String(empleado.n ?? "") : "Se asigna al guardar"} disabled />
                </label>
                {camposDe(g.key).filter((c) => !c.full).map(renderCampo)}
                {camposDe(g.key).filter((c) => c.full).map(renderCampo)}
              </div>
            )}
            {g.key !== "datos" && g.key !== "recibos" && (
              <>
                {g.key === "distribucionNomina" && <p className="tiny" style={{ marginTop: 0 }}>
                  Estos porcentajes son propios del trabajador. Nómina los aplicará automáticamente sobre la remuneración total.
                  Cada concepto respeta el máximo de la tabla y la suma debe ser 100 %.
                </p>}
                <div className="grid2">{camposDe(g.key).map(renderCampo)}</div>
                {g.key === "distribucionNomina" && <p className="tiny">
                  Total distribuido: <b>{fmtPct(totalDistribucion(form))}</b>
                </p>}
              </>
            )}
            {g.key === "recibos" && (
              <>
                <p className="tiny" style={{ marginTop: 0, marginBottom: 10 }}>
                  Marca los meses con recibo de pago validado (se escribe una <code>X</code> en el sheet).
                </p>
                <div className="checks">
                  {camposDe(g.key).map((c) => (
                    <button
                      type="button"
                      key={c.key}
                      className={"check" + (form[c.key] === "X" ? " on" : "")}
                      onClick={() => toggleMes(c.key)}
                    >
                      <input type="checkbox" checked={form[c.key] === "X"} readOnly />
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}

        {error && <p style={{ color: "var(--danger)", fontWeight: 700, fontSize: 14 }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn sm ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn sm" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );

  function renderCampo(c: ColDef) {
    const v = form[c.key] ?? "";
    const cls = c.full ? "full" : "";
    if (c.readOnly || c.key === "totalRemuneracion") {
      const esCalc = c.key === "totalRemuneracion";
      return (
        <label key={c.key} className={cls}>{c.label} {esCalc ? "(calculado)" : "(automático)"}
          <input value={esCalc ? (total || "") : String(v)} disabled />
        </label>
      );
    }
    if (c.type === "select") {
      if (c.group === "distribucionNomina") {
        const config = DISTRIBUCION_NOMINA.find((field) => field.key === c.key)!;
        return (
          <label key={c.key} className={cls}>{c.label} · máximo {fmtPct(config.max)}
            <select value={String(v)} onChange={(e) => set(c.key, Number(e.target.value))}>
              {opcionesPorcentaje(config.max).map((option) => (
                <option key={option} value={option}>
                  {fmtPct(option)}{config.referencias.includes(option as never) ? " · tabla" : ""}
                </option>
              ))}
            </select>
          </label>
        );
      }
      return (
        <label key={c.key} className={cls}>{c.label}
          <select value={String(v)} onChange={(e) => set(c.key, e.target.value)}>
            {(c.options || []).map((o) => <option key={o} value={o}>{o || "—"}</option>)}
          </select>
        </label>
      );
    }
    if (c.type === "siNo") {
      return (
        <label key={c.key} className={cls}>{c.label}
          <select value={String(v).toUpperCase()} onChange={(e) => set(c.key, e.target.value)}>
            {["", "SI", "NO", "NO APLICA"].map((o) => <option key={o} value={o}>{o || "—"}</option>)}
          </select>
        </label>
      );
    }
    if (c.type === "textarea") {
      return (
        <label key={c.key} className={cls}>{c.label}
          <textarea value={String(v)} onChange={(e) => set(c.key, e.target.value)} />
        </label>
      );
    }
    const type = c.type === "date" ? "date" : c.type === "number" ? "number" : c.type === "email" ? "email" : "text";
    return (
      <label key={c.key} className={cls}>
        {c.label}{c.required ? " *" : ""}
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          value={String(v)}
          required={c.required}
          onChange={(e) => set(c.key, e.target.value)}
        />
      </label>
    );
  }
}

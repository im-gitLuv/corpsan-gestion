"use client";

/**
 * Gestión de Talento Humano: tabla del personal (activo/inactivo) con búsqueda,
 * y CRUD completo sincronizado con el sheet "BD TALENTO HUMANO" vía Apps Script
 * (o modo demo local si no hay backend conectado).
 */
import { useMemo, useState } from "react";
import RecordModal from "@/components/RecordModal";
import { Ic, Icons } from "@/components/icons";
import { useToast } from "@/components/Toaster";
import { useData } from "@/lib/store";
import { docsCompletos } from "@/lib/columns";
import type { Empleado, HojaTH } from "@/lib/types";

export default function TalentoHumano() {
  const { activos, inactivos, crear, actualizar, eliminar } = useData();
  const { toast } = useToast();
  const [hoja, setHoja] = useState<HojaTH>("activos");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ abierto: boolean; emp: Empleado | null }>({ abierto: false, emp: null });

  const rows = hoja === "activos" ? activos : inactivos;

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  async function guardar(data: Empleado) {
    const emp = modal.emp;
    if (emp) {
      await actualizar(hoja, emp, data);
      toast("Expediente actualizado");
    } else {
      await crear(hoja, data);
      toast("Registro creado en " + (hoja === "activos" ? "Personal Activo" : "Inactivos"));
    }
    setModal({ abierto: false, emp: null });
  }

  function pedirEliminar(emp: Empleado) {
    const ok = window.confirm(
      `¿Eliminar el registro de ${emp.nombre ?? ""} (${emp.cedula ?? ""}) del sheet ` +
      `${hoja === "activos" ? "BD PERSONAL ACTIVO" : "INACTIVOS"}?\n\n` +
      `Esta acción borra la fila del sheet y no se puede deshacer.`
    );
    if (!ok) return;
    eliminar(hoja, emp)
      .then(() => toast("Registro eliminado"))
      .catch((e) => toast(e.message || "Error al eliminar", true));
  }

  return (
    <div>
      <div className="toolbar">
        <div className="tabs">
          <button className={hoja === "activos" ? "active" : ""} onClick={() => setHoja("activos")}>
            Activos ({activos.length})
          </button>
          <button className={hoja === "inactivos" ? "active" : ""} onClick={() => setHoja("inactivos")}>
            Inactivos ({inactivos.length})
          </button>
        </div>

        <div className="search">
          <Ic d={Icons.search} />
          <input
            placeholder="Buscar por nombre, cédula, cargo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <button className="btn sm" onClick={() => setModal({ abierto: true, emp: null })}>
          + Nuevo registro
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>N°</th>
              <th>Nombre y Apellido</th>
              <th>Estado</th>
              <th>Cédula</th>
              <th>Edad</th>
              <th>Cargo</th>
              <th className="col-sec">Teléfono</th>
              <th className="col-sec">Tipo Nómina</th>
              <th className="col-sec">Ingreso (Real)</th>
              {hoja === "inactivos" && <th className="col-sec">Fecha de Cese</th>}
              <th>Sueldo Mensual</th>
              <th>Docs. Físicos</th>
              <th className="col-acc"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={hoja === "inactivos" ? 13 : 12} className="empty">Sin registros para mostrar</td></tr>
            )}
            {filtradas.map((r) => {
              const [okDocs, totalDocs] = docsCompletos(r);
              return (
                <tr key={(r._fila ?? 0) + "-" + r.cedula}>
                  <td>{r.n ?? ""}</td>
                  <td><b>{r.nombre ?? ""}</b></td>
                  <td>
                    {r.estado ? (
                      <span className={"pill " + (String(r.estado).toUpperCase() === "ACTIVO" ? "ok" : "gr")}>
                        {r.estado}
                      </span>
                    ) : "—"}
                  </td>
                  <td>{r.cedula ?? ""}</td>
                  <td>{r.edad ?? "—"}</td>
                  <td>{r.cargo ?? r.cargoLaboral ?? ""}</td>
                  <td className="col-sec">{r.telefono ?? ""}</td>
                  <td className="col-sec">{r.tipoNomina ?? ""}</td>
                  <td className="col-sec">{fmtFecha(r.ingresoReal)}</td>
                  {hoja === "inactivos" && <td className="col-sec">{fmtFecha(r.fechaCese)}</td>}
                  <td>{fmtUsd(r.sueldoMensual)}</td>
                  <td>
                    <span className={"pill " + (okDocs === totalDocs ? "ok" : okDocs > 0 ? "wa" : "gr")}>
                      {okDocs}/{totalDocs}
                    </span>
                  </td>
                  <td className="col-acc">
                    <div className="acc">
                      <button className="mini" title="Editar" onClick={() => setModal({ abierto: true, emp: r })}>
                        <Ic d={Icons.edit} />
                      </button>
                      <button className="mini danger" title="Eliminar" onClick={() => pedirEliminar(r)}>
                        <Ic d={Icons.trash} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="tiny">
        Los cambios se escriben directamente en la base <b>BD TALENTO HUMANO</b> de Google Sheets
        (pestañas <b>BD PERSONAL ACTIVO</b> e <b>INACTIVOS</b>). El indicador de documentos cuenta los
        recaudos físicos marcados como SI o NO APLICA.
      </p>

      <RecordModal
        abierto={modal.abierto}
        hoja={hoja}
        empleado={modal.emp}
        onGuardar={guardar}
        onCerrar={() => setModal({ abierto: false, emp: null })}
      />
    </div>
  );
}

function fmtUsd(v: any): string {
  const n = Number(v);
  if (!n) return "—";
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtFecha(v: any): string {
  const s = String(v ?? "");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s || "—";
}

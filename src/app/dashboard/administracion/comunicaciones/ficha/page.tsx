"use client";

/**
 * Ficha de requisición — versión imprimible (modelo según la requisición).
 * Se abre desde Comunicaciones → Requisiciones con ?rq=RQ-2026-0001,
 * o en blanco con ?modelo=Oficina&blanco=1 (usa el siguiente correlativo).
 * Imprimir / Guardar como PDF desde el diálogo del navegador.
 */
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdm, admEtiqueta } from "@/lib/adm-store";
import { type AdmRow } from "@/lib/adm";
import "../../administracion.css";

export default function FichaRequisicionPage() {
  return (
    <Suspense fallback={<p className="empty">Cargando ficha…</p>}>
      <Ficha />
    </Suspense>
  );
}

function Ficha() {
  const router = useRouter();
  const params = useSearchParams();
  const rq = params.get("rq") || "";
  const blanco = params.get("blanco") === "1";
  const api = useAdm(["REQUISICIONES"]);

  const encontrada: AdmRow | undefined = blanco
    ? undefined
    : (api.datos.REQUISICIONES || []).find((f) => String(f.ID) === rq);

  const siguiente = api.siguiente.REQUISICIONES || "—";
  const modeloBlanco = params.get("modelo") || "Genérica";

  const datos: AdmRow = encontrada || {
    ID: siguiente === "—" ? "" : siguiente,
    Fecha: new Date().toLocaleDateString("sv-SE", { timeZone: "America/Caracas" }),
    Departamento: "AD",
    Modelo: modeloBlanco,
    SolicitadoPor: "",
    Descripcion: "",
    Cantidad: "",
    Unidad: "",
    Prioridad: "Normal",
    Estatus: "Pendiente",
    Cotizacion: "",
    AprobadaPor: "",
    Proveedor: "",
    Factura: "",
    Soporte: "",
    Observaciones: "",
  };

  if (!blanco && api.listo && !encontrada) {
    return (
      <div>
        <p className="empty">No se encontró la requisición «{rq}».</p>
        <Link className="btn sm ghost" href="/dashboard/administracion/comunicaciones">Volver a requisiciones</Link>
      </div>
    );
  }

  const fila = (etiqueta: string, valor: unknown) => (
    <><td className="fch-label">{etiqueta}</td><td className="fch-val">{valor === "" || valor === undefined || valor === null ? "—" : String(valor)}</td></>
  );
  const largo = (etiqueta: string, valor: unknown) => (
    <tr><td className="fch-label">{etiqueta}</td><td className="fch-val" colSpan={3}>{valor === "" || valor === undefined || valor === null ? "—" : String(valor)}</td></tr>
  );

  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn sm ghost" onClick={() => router.back()}>← Volver</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button>
        <span style={{ alignSelf: "center", fontSize: 13, color: "#8a8a8e" }}>
          {blanco ? `Ficha en blanco · modelo ${modeloBlanco} · correlativo ${siguiente}` : `Ficha ${String(datos.ID)}`}
        </span>
      </div>

      <div className="recibo-sheet">
        <div className="rcb-head">
          <img src="/logo-santamaria.png" alt="" className="rcb-logo" />
          <div className="rcb-empresa">
            <b>CORPORACIÓN SANTAMARÍA, C.A.</b>
            <span>RIF J-31290505-0 · Maturín, Estado Monagas</span>
          </div>
        </div>
        <div className="rcb-titulo">
          <div className="rcb-mes">FICHA DE REQUISICIÓN · {String(datos.Modelo).toUpperCase()}</div>
          <div className="rcb-rango">{String(datos.ID)} · {String(datos.Fecha)}</div>
        </div>

        <div className="rcb-seccion">DATOS DE LA REQUISICIÓN</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              {fila("Requisición N°:", datos.ID)}
              {fila("Fecha:", datos.Fecha)}
              {fila("Departamento:", admEtiqueta("Departamento", datos.Departamento))}
            </tr>
            <tr>
              {fila("Modelo de ficha:", datos.Modelo)}
              {fila("Solicitada por:", datos.SolicitadoPor)}
              {fila("Prioridad:", datos.Prioridad)}
            </tr>
            {largo("Descripción:", datos.Descripcion)}
            <tr>
              {fila("Cantidad:", datos.Cantidad)}
              {fila("Unidad:", datos.Unidad)}
              {fila("Estatus:", datos.Estatus)}
            </tr>
          </tbody>
        </table>

        <div className="rcb-seccion">COTIZACIÓN, APROBACIÓN Y COMPRA</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              {fila("Cotización:", datos.Cotizacion)}
              {fila("Aprobada por:", datos.AprobadaPor)}
            </tr>
            <tr>
              {fila("Proveedor:", datos.Proveedor)}
              {fila("Factura anexa N°:", datos.Factura)}
            </tr>
            {largo("Soporte firmado:", datos.Soporte)}
            {largo("Observaciones:", datos.Observaciones)}
          </tbody>
        </table>

        {String(datos.Modelo) === "Activo fijo" && (
          <p className="fch-comentarios">
            Activo fijo: la factura se escanea y se anexa al expediente del bien para su registro histórico.
          </p>
        )}
        {String(datos.Modelo) === "Consumible" && (
          <p className="fch-comentarios">Consumible: la factura física se pega al documento de la requisición.</p>
        )}

        <div className="rcb-firma">
          <span>Solicitado por</span>
          <span>Aprobado por</span>
          <span>Recibido por (almacén)</span>
        </div>

        <div className="rcb-pie">
          CorpSan · Gestión Administrativa · consecutivo anual único por empresa.
        </div>
      </div>
    </div>
  );
}

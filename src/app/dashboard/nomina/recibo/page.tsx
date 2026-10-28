"use client";

/**
 * Recibo de pago imprimible — réplica de la plantilla de CorpSan.
 * Se abre desde Nómina con ?periodo=YYYY-MM&cedula=XXX
 * Imprimir / Guardar como PDF desde el diálogo del navegador.
 */
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, isConfigured } from "@/lib/api";
import {
  calcNomina, fmtBs, fmtPct, fmtCedula, fmtFechaRecibo, rangoPeriodo, mesNombre,
  type Pago,
} from "@/lib/nomina";

export default function ReciboPage() {
  return (
    <Suspense fallback={<p className="empty">Cargando recibo…</p>}>
      <Recibo />
    </Suspense>
  );
}

function Recibo() {
  const router = useRouter();
  const params = useSearchParams();
  const periodo = params.get("periodo") || "";
  const cedula = params.get("cedula") || "";
  const [pago, setPago] = useState<Pago | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!isConfigured()) {
          const demo = JSON.parse(localStorage.getItem("cs_demo_pagos") || "[]") as Pago[];
          const p = demo.find((x) => x.Periodo === periodo && String(x.Cedula) === String(cedula));
          if (p) return setPago(p);
          return setError("No se encontró el pago (modo demo)");
        }
        const r = await apiGet({ action: "pagos_list", periodo });
        if (!r.ok) throw new Error(r.msg || "Error al cargar");
        const p = (r.data || []).find((x: Pago) => String(x.Cedula) === String(cedula));
        if (!p) throw new Error("No se encontró el pago de esa cédula en " + periodo);
        calcNomina(p);
        setPago(p);
      } catch (e: any) {
        setError(e.message || "Error al cargar el recibo");
      }
    })();
  }, [periodo, cedula]);

  if (error) return <p className="empty">{error}</p>;
  if (!pago) return <p className="empty">Cargando recibo…</p>;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <button className="btn sm ghost" onClick={() => router.back()}>Volver a Nómina</button>
      </div>
      {pago.Origen === "Historico Excel" && <p className="no-print tiny">Reproducción de valores originales. Fuente: {pago.Fuente}. Estado: {pago.Estado}. {pago.Observaciones}</p>}
      <ReciboHoja pago={pago} />
    </div>
  );
}

function ReciboHoja({ pago }: { pago: Pago }) {
  const c = calcNomina(pago);
  const rango = rangoPeriodo(String(pago.Periodo));
  const desde = pago.InicioPeriodo ? fmtFechaRecibo(pago.InicioPeriodo) : rango[0];
  const hasta = pago.FinPeriodo ? fmtFechaRecibo(pago.FinPeriodo) : rango[1];
  const tasa = Number(pago.TasaBCV) || 0;
  const original = pago.Origen === "Historico Excel" ? JSON.parse(String(pago.CalculoHistorico)) : null;
  const datos = original?.datosTrabajador || pago;

  const filas = (lineas: { cod: string; nombre: string; base: string; usd: number; obs?: string }[]) =>
    lineas.map((l) => (
      <tr key={l.cod}>
        <td className="r-center">{l.cod}</td>
        <td>{l.nombre}</td>
        <td className="r-center">{l.base}</td>
        <td className="r-right">{l.usd ? fmtBs(l.usd * tasa) : "-"}</td>
        <td>{l.obs || ""}</td>
      </tr>
    ));

  const total = (nombre: string, valorBs: number) => (
    <tr className="r-total">
      <td></td><td colSpan={2}>{nombre}</td>
      <td className="r-right">{fmtBs(valorBs)}</td><td></td>
    </tr>
  );

  const deducciones = [
    { cod: "201", nombre: "Seguro Social Obligatorio (IVSS)", pct: pago.PctIVSS, bs: c.ivssBs },
    { cod: "202", nombre: "Régimen Prestacional Empleo (P. Forzoso)", pct: pago.PctParo, bs: c.paroBs },
    { cod: "203", nombre: "FAOV (Ahorro Vivienda)", pct: pago.PctFAOV, bs: c.faovBs },
    { cod: "204", nombre: "I.S.L.R. (Retención s/ Formulario ARI)", pct: pago.PctISLR, bs: c.islrBs },
    { cod: "205", nombre: "Anticipo / Préstamo", pct: 0, bs: c.anticiposBs },
  ];

  return (
    <div className="recibo-sheet">
      {/* Encabezado */}
      <div className="rcb-head">
        <img src="/logo-santamaria.png" alt="" className="rcb-logo" />
        <div className="rcb-empresa">
          <b>CORPORACIÓN SANTAMARIA, C.A.</b>
          <span>RIF: J-31290505-0</span>
        </div>
      </div>

      <div className="rcb-titulo">
        <div><b>RECIBO DE PAGO MES</b></div>
        <div className="rcb-mes">{mesNombre(String(pago.Periodo)).toUpperCase()} {String(pago.Periodo).slice(0, 4)}</div>
        <div className="rcb-rango">
          <span>Período de pago</span>
          <b>{desde}</b>
          <span>al</span>
          <b>{hasta}</b>
        </div>
      </div>

      {/* Datos del trabajador */}
      <div className="rcb-seccion">DATOS DEL TRABAJADOR</div>
      <table className="rcb-datos">
        <tbody>
          <tr>
            <td>Apellido y Nombre:</td><td><b>{String(datos.Nombre || "").toUpperCase()}</b></td>
            <td>Cédula Identidad:</td><td><b>{fmtCedula(pago.Cedula)}</b></td>
          </tr>
          <tr>
            <td>Cargo:</td><td>{datos.Cargo}</td>
            <td>Fecha de Ingreso:</td><td>{fmtFechaRecibo(datos.FechaIngreso)}</td>
          </tr>
          <tr>
            <td>Salario Mensual (Bs.):</td><td>{fmtBs(original?.salarioMensualBs ?? c.sueldo * tasa)}</td>
            <td>Lunes del Mes:</td><td>{c.lunes}</td>
          </tr>
          <tr>
            <td>Banco</td><td>{datos.Banco}</td>
            <td>Num. Cuenta:</td><td>{datos.Cuenta}</td>
          </tr>
        </tbody>
      </table>

      {/* Tabla principal */}
      <table className="rcb-tabla">
        <thead>
          <tr>
            <th>CODIGO</th><th>CONCEPTO (ASIGNACIONES)</th><th>BASE / UNIDAD</th><th>ASIGNACIÓN (Bs.)</th><th>OBSERVACIONES</th>
          </tr>
        </thead>
        <tbody>
          {filas([
            { cod: "001", nombre: "Sueldo Básico", base: "Mensual", usd: c.sueldo, obs: `${c.dias} DIAS` },
            { cod: "002", nombre: "Prima por Disponibilidad", base: "Fijo Mensual", usd: c.disp },
            { cod: "003", nombre: "Prima por Responsabilidad", base: "Regular", usd: c.resp },
            { cod: "004", nombre: "Prima por Representación", base: "Fijo Mensual", usd: c.repr },
            { cod: "005", nombre: "Prima por Antigüedad Progresiva", base: "Regular", usd: c.antig },
          ])}
          {total("TOTAL SALARIO NORMAL", c.totalA * tasa)}

          {filas([
            { cod: "101", nombre: "Bono por Orden y Limpieza", base: "Según Tabla", usd: Number(pago.BonoLimpieza) || 0 },
            { cod: "102", nombre: "Bono por Puntualidad", base: "Según Tabla", usd: Number(pago.BonoPuntual) || 0 },
            { cod: "103", nombre: "Bono por Movilidad (Transporte)", base: "Según Tabla", usd: Number(pago.BonoMovilidad) || 0 },
            { cod: "104", nombre: "Bono por Coordinación", base: "Según Tabla", usd: Number(pago.BonoCoordin) || 0 },
            { cod: "105", nombre: "Bono por Productividad", base: "Según Tabla", usd: Number(pago.BonoProductiv) || 0 },
          ])}
          {total("TOTAL BONIFICACIONES", c.totalB * tasa)}

          {filas([
            { cod: "111", nombre: "Cestaticket Socialista (Ley)", base: "No Salarial", usd: c.cesta },
            { cod: "112", nombre: "Bonificación Especial Asistencial", base: "Clausula 105 LOTTT", usd: Number(pago.AsistencialUSD) || 0 },
          ])}
          {total("TOTAL ASIGNACIONES NO SALARIALES", c.totalC * tasa)}

          {deducciones.map((d) => (
            <tr key={d.cod}>
              <td className="r-center">{d.cod}</td>
              <td>{d.nombre}</td>
              <td className="r-center">{fmtPct(d.pct)}</td>
              <td className="r-right">{fmtBs(d.bs)}</td>
              <td></td>
            </tr>
          ))}
          {total("TOTAL DEDUCCIONES", c.totalDeduccBs)}
        </tbody>
        <tfoot>
          <tr className="r-resumen">
            <td colSpan={2}>RESUMEN DE PAGO</td>
            <td>TOTAL A PAGAR (A + B - C)</td>
            <td className="r-right"><b>{fmtBs(c.netoBs)}</b></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Declaración */}
      <div className="rcb-seccion">DECLARACIÓN DEL TRABAJADOR:</div>
      <p className="rcb-declaracion">
        Recibí de CORPORACIÓN SANTAMARIA, C.A. la cantidad arriba indicada por concepto de remuneración de mis
        servicios por el período señalado. Declaro que se me han explicado los conceptos y estoy de acuerdo con los
        mismos. El monto pagado bajo el concepto de Cestaticket y Bonificación Especial tiene carácter NO remunerativo
        según el Art. 105 de la LOTTT.
      </p>

      <div className="rcb-firma">
        <span>Firma del Trabajador:&nbsp;____________________</span>
        <span>Huella:</span>
      </div>

      <div className="rcb-admin">
        <span>ADMINISTRACION</span>
        <span>FECHA:</span>
      </div>

      <p className="rcb-pie">Tasa BCV aplicada: {fmtBs(tasa)} Bs/USD (congelada al cierre de {mesNombre(String(pago.Periodo))})</p>
    </div>
  );
}

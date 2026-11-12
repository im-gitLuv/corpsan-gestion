"use client";

/**
 * Ficha de datos del personal — versión imprimible (diseño piloto).
 * Se abre desde Talento Humano con ?cedula=XXX&hoja=activos|inactivos.
 * Imprimir / Guardar como PDF desde el diálogo del navegador.
 * El diseño final lo entregará administración; este es el piloto funcional.
 */
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/lib/store";
import { docsCompletos } from "@/lib/columns";
import type { Empleado } from "@/lib/types";

export default function FichaPage() {
  return (
    <Suspense fallback={<p className="empty">Cargando ficha…</p>}>
      <Ficha />
    </Suspense>
  );
}

function Ficha() {
  const router = useRouter();
  const params = useSearchParams();
  const cedula = params.get("cedula") || "";
  const { activos, inactivos } = useData();
  const persona: Empleado | undefined = [...activos, ...inactivos].find(
    (p) => String(p.cedula).replace(/\D/g, "") === cedula.replace(/\D/g, "")
  );

  if (!persona) {
    return (
      <div>
        <p className="empty">No se encontró el registro de esa cédula en Talento Humano.</p>
        <button className="btn sm ghost" onClick={() => router.back()}>Volver a Talento Humano</button>
      </div>
    );
  }

  const [okDocs, totalDocs] = docsCompletos(persona);
  const fila = (etiqueta: string, valor: any) => (
    <><td className="fch-label">{etiqueta}</td><td className="fch-val">{valor === "" || valor === undefined || valor === null ? "—" : String(valor)}</td></>
  );
  const fecha = (v: any) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v ?? "") || "—";
  };
  const usd = (v: any) => {
    const n = Number(v);
    return n ? new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n) : "—";
  };
  const doc = (clave: string, etiqueta: string) => (
    <tr key={clave}><td className="fch-label">{etiqueta}</td><td className={"fch-val doc-" + String(persona[clave] || "").toLowerCase().replace(/\s/g, "")}>{String(persona[clave] || "—")}</td></tr>
  );

  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <button className="btn sm ghost" onClick={() => router.back()}>Volver a Talento Humano</button>
      </div>

      <div className="recibo-sheet ficha-sheet">
        <div className="rcb-head">
          <img src="/logo-santamaria.png" alt="" className="rcb-logo" />
          <div className="rcb-empresa">
            <b>CORPORACIÓN SANTAMARIA, C.A.</b>
            <span>RIF: J-31290505-0</span>
          </div>
        </div>

        <div className="rcb-titulo">
          <div><b>FICHA DE DATOS DEL PERSONAL</b></div>
          <div className="rcb-mes">{String(persona.nombre || "").toUpperCase()}</div>
          <div className="rcb-rango">
            <span>Documento de uso interno</span>
            <b>·</b>
            <span>Recaudo para inspección (VENCO / INCES)</span>
          </div>
        </div>

        <div className="rcb-seccion">DATOS GENERALES</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              <td className="fch-label">Apellido y Nombre:</td><td className="fch-val"><b>{String(persona.nombre || "").toUpperCase()}</b></td>
              <td className="fch-label">Cédula de Identidad:</td><td className="fch-val"><b>{persona.cedula ?? "—"}</b></td>
            </tr>
            <tr>
              {fila("RIF", persona.rif)}
              {fila("Sexo", persona.sexo)}
            </tr>
            <tr>
              {fila("Fecha de Nacimiento", fecha(persona.fechaNac))}
              {fila("Edad", persona.edad)}
            </tr>
            <tr>
              {fila("Teléfono", persona.telefono)}
              {fila("Correo Electrónico", persona.correo)}
            </tr>
            <tr>
              <td className="fch-label">Dirección de Habitación:</td><td className="fch-val" colSpan={3}>{persona.direccion || "—"}</td>
            </tr>
          </tbody>
        </table>

        <div className="rcb-seccion">DATOS LABORALES</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              {fila("Cargo", persona.cargo || persona.cargoLaboral)}
              {fila("Supervisor Directo", persona.supervisor)}
            </tr>
            <tr>
              {fila("Jornada", persona.jornada)}
              {fila("Tipo de Nómina", persona.tipoNomina)}
            </tr>
            <tr>
              {fila("Fecha de Ingreso (Real)", fecha(persona.ingresoReal))}
              {fila("Fecha de Ingreso (IVSS)", fecha(persona.ingresoIVSS))}
            </tr>
            <tr>
              {fila("Estado", persona.estado)}
              {fila("Fecha de Cese", persona.fechaCese ? fecha(persona.fechaCese) : "Activo")}
            </tr>
          </tbody>
        </table>

        <div className="rcb-seccion">DATOS BANCARIOS</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              {fila("Banco", persona.banco)}
              {fila("N° de Cuenta", persona.nCuenta)}
            </tr>
          </tbody>
        </table>

        <div className="rcb-seccion">PERSONA DE CONTACTO EN EMERGENCIA</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              {fila("Nombre y Apellido", persona.contactoNombre)}
              {fila("Teléfono", persona.contactoTelefono)}
            </tr>
          </tbody>
        </table>

        <div className="rcb-seccion">REMUNERACIÓN (USD)</div>
        <table className="fch-tabla">
          <tbody>
            <tr>
              {fila("Salario Semanal", usd(persona.salarioSemanal))}
              {fila("Sueldo Mensual", usd(persona.sueldoMensual))}
            </tr>
            <tr>
              {fila("Bono de Alimentación", usd(persona.bonoAlimentacion))}
              {fila("Ayuda Única Especial", usd(persona.ayudaUnica))}
            </tr>
            <tr>
              {fila("Comisiones", usd(persona.comisiones))}
              {fila("Bono Vacacional", usd(persona.bonoVacacional))}
            </tr>
            <tr>
              {fila("Otros", usd(persona.otros))}
              <td className="fch-label">Total Remuneración:</td><td className="fch-val"><b>{usd(persona.totalRemuneracion)}</b></td>
            </tr>
          </tbody>
        </table>

        <div className="rcb-seccion">CONSTANCIAS Y DOCUMENTOS ({okDocs}/{totalDocs} completos)</div>
        <table className="fch-tabla fch-docs">
          <tbody>
            {doc("cedulaFisco", "Cédula — Físico")}
            {doc("cedulaDigital", "Cédula — Digital")}
            {doc("cvFisco", "Currículum — Físico")}
            {doc("cvDigital", "Currículum — Digital")}
            {doc("medicoFisco", "Certificado Médico — Físico")}
            {doc("medicoDigital", "Certificado Médico — Digital")}
            {doc("licenciaFisco", "Licencia de Conducir — Físico")}
            {doc("licenciaDigital", "Licencia de Conducir — Digital")}
            {doc("rifFisco", "RIF — Físico")}
            {doc("rifDigital", "RIF — Digital")}
            {doc("certFisco", "Certificación — Físico")}
            {doc("certDigital", "Certificación — Digital")}
          </tbody>
        </table>

        {String(persona.comentarios || "") !== "" && (<>
          <div className="rcb-seccion">COMENTARIOS</div>
          <p className="fch-comentarios">{String(persona.comentarios)}</p>
        </>)}

        <div className="rcb-firma ficha-firmas">
          <span>Firma del Trabajador:&nbsp;____________________</span>
          <span>Huella:</span>
        </div>
        <div className="rcb-admin">
          <span>ADMINISTRACIÓN</span>
          <span>FECHA:&nbsp;____________________</span>
        </div>

        <p className="rcb-pie">
          Ficha generada por CS Gestión el {new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })} · Diseño piloto sujeto a actualización
        </p>
      </div>
    </div>
  );
}

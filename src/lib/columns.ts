import type { Empleado } from "./types";

/**
 * Mapa de columnas de la BD TALENTO HUMANO de CorpSan.
 * Refleja la estructura real del sheet "BD PERSONAL ACTIVO" / "INACTIVOS":
 * fila 7 = encabezados de grupo, fila 8 = subencabezados FISCO/DIGITAL, datos desde la fila 9.
 * El orden de COLS debe coincidir con el orden de columnas del sheet (ver apps-script/Code.gs).
 */

export type FieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "select"
  | "siNo"
  | "month"
  | "textarea";

export interface ColDef {
  key: string;
  label: string;
  type: FieldType;
  group: string; // clave de GROUPS
  options?: string[];
  table?: boolean; // mostrar en la tabla resumen
  full?: boolean; // ancho completo en el formulario
  required?: boolean;
  readOnly?: boolean; // se muestra pero no se edita (lo calcula el sheet)
  soloInactivos?: boolean; // solo aplica a la pestaña de inactivos
}

export const GROUPS: { key: string; label: string }[] = [
  { key: "datos", label: "Datos generales" },
  { key: "docs", label: "Constancias y documentos" },
  { key: "banco", label: "Datos bancarios" },
  { key: "emergencia", label: "Persona de contacto en emergencia" },
  { key: "laboral", label: "Datos laborales" },
  { key: "remuneracion", label: "Remuneración (USD)" },
  { key: "distribucionNomina", label: "Distribución de nómina por trabajador" },
  { key: "recibos", label: "Validación de recibo de pago" },
];

const SI_NO = ["", "SI", "NO", "NO APLICA"];

export const COLS: ColDef[] = [
  // ── DATOS GENERALES (cols 1-10 del sheet)
  { key: "n", label: "N°", type: "text", group: "datos", table: true },
  { key: "nombre", label: "Nombre y Apellido", type: "text", group: "datos", table: true, required: true },
  { key: "estado", label: "Estado", type: "select", group: "datos", options: ["", "ACTIVO", "INACTIVO"], table: true },
  { key: "cedula", label: "Cédula", type: "text", group: "datos", table: true, required: true },
  { key: "rif", label: "RIF", type: "text", group: "datos" },
  { key: "sexo", label: "Sexo", type: "select", group: "datos", options: ["", "MASCULINO", "FEMENINO"] },
  { key: "fechaNac", label: "Fecha de Nacimiento", type: "date", group: "datos" },
  { key: "edad", label: "Edad", type: "text", group: "datos", table: true, readOnly: true },
  { key: "cargo", label: "Cargo", type: "text", group: "datos", table: true },
  { key: "telefono", label: "Teléfono", type: "text", group: "datos", table: true },
  { key: "direccion", label: "Dirección de Habitación", type: "textarea", group: "datos", full: true },
  { key: "correo", label: "Correo Electrónico", type: "email", group: "datos" },

  // ── CONSTANCIAS FÍSICAS / DIGITALES (cols 11-22; valores SI / NO / NO APLICA)
  { key: "cedulaFisco", label: "Cédula — Físico", type: "siNo", group: "docs", options: SI_NO },
  { key: "cedulaDigital", label: "Cédula — Digital", type: "siNo", group: "docs", options: SI_NO },
  { key: "cvFisco", label: "Currículum — Físico", type: "siNo", group: "docs", options: SI_NO },
  { key: "cvDigital", label: "Currículum — Digital", type: "siNo", group: "docs", options: SI_NO },
  { key: "medicoFisco", label: "Certificado Médico — Físico", type: "siNo", group: "docs", options: SI_NO },
  { key: "medicoDigital", label: "Certificado Médico — Digital", type: "siNo", group: "docs", options: SI_NO },
  { key: "licenciaFisco", label: "Licencia de Conducir — Físico", type: "siNo", group: "docs", options: SI_NO },
  { key: "licenciaDigital", label: "Licencia de Conducir — Digital", type: "siNo", group: "docs", options: SI_NO },
  { key: "rifFisco", label: "RIF — Físico", type: "siNo", group: "docs", options: SI_NO },
  { key: "rifDigital", label: "RIF — Digital", type: "siNo", group: "docs", options: SI_NO },
  { key: "certFisco", label: "Certificación — Físico", type: "siNo", group: "docs", options: SI_NO },
  { key: "certDigital", label: "Certificación — Digital", type: "siNo", group: "docs", options: SI_NO },

  // ── DATOS BANCARIOS (cols 23-24)
  {
    key: "banco", label: "Banco", type: "select", group: "banco",
    options: ["", "BNC", "PROVINCIAL", "VENEZUELA", "BDV", "MERCANTIL", "BANPLUS", "BOD", "EXTERIOR", "ACTIVO", "NACIONAL", "OTRO"],
  },
  { key: "nCuenta", label: "N° de Cuenta", type: "text", group: "banco" },

  // ── CONTACTO DE EMERGENCIA (cols 25-26)
  { key: "contactoNombre", label: "Nombre y Apellido", type: "text", group: "emergencia" },
  { key: "contactoTelefono", label: "Teléfono", type: "text", group: "emergencia" },

  // ── DATOS LABORALES (cols 27-32)
  { key: "cargoLaboral", label: "Cargo (ficha laboral)", type: "text", group: "laboral" },
  { key: "supervisor", label: "Supervisor Directo", type: "text", group: "laboral" },
  { key: "jornada", label: "Jornada", type: "select", group: "laboral", options: ["", "LUNES A VIERNES", "LUNES A SABADO", "LUNES A DOMINGO", "ROTATIVA"] },
  { key: "tipoNomina", label: "Tipo de Nómina", type: "text", group: "laboral", table: true },
  { key: "ingresoReal", label: "Fecha de Ingreso (Real)", type: "date", group: "laboral", table: true },
  { key: "ingresoIVSS", label: "Fecha de Ingreso (IVSS)", type: "date", group: "laboral" },
  { key: "fechaCese", label: "Fecha de Cese", type: "date", group: "laboral", soloInactivos: true, table: true },

  // ── REMUNERACIÓN (cols 33-41)
  { key: "salarioSemanal", label: "Salario Semanal", type: "number", group: "remuneracion" },
  { key: "sueldoMensual", label: "Sueldo Mensual", type: "number", group: "remuneracion", table: true },
  { key: "bonoAlimentacion", label: "Bono de Alimentación", type: "number", group: "remuneracion" },
  { key: "ayudaUnica", label: "Ayuda Única Especial", type: "number", group: "remuneracion" },
  { key: "totalRemuneracion", label: "Total Remuneración", type: "number", group: "remuneracion", table: true },
  { key: "comisiones", label: "Comisiones", type: "number", group: "remuneracion" },
  { key: "bonoVacacional", label: "Bono Vacacional", type: "number", group: "remuneracion" },
  { key: "otros", label: "Otros", type: "number", group: "remuneracion" },
  { key: "comentarios", label: "Comentarios", type: "textarea", group: "remuneracion", full: true },

  // Se persisten en NOMINA_PERFILES y se editan desde la ficha maestra de Talento Humano.
  { key: "PctSueldo", label: "Sueldo básico", type: "select", group: "distribucionNomina" },
  { key: "PctDisp", label: "Prima por disponibilidad", type: "select", group: "distribucionNomina" },
  { key: "PctResp", label: "Prima por responsabilidad", type: "select", group: "distribucionNomina" },
  { key: "PctRepr", label: "Prima por representación", type: "select", group: "distribucionNomina" },
  { key: "PctAntig", label: "Prima por antigüedad", type: "select", group: "distribucionNomina" },
  { key: "PctCestaticket", label: "Cestaticket", type: "select", group: "distribucionNomina" },
  { key: "PctLimpieza", label: "Orden y limpieza", type: "select", group: "distribucionNomina" },
  { key: "PctPuntual", label: "Puntualidad", type: "select", group: "distribucionNomina" },
  { key: "PctMovilidad", label: "Movilidad (transporte)", type: "select", group: "distribucionNomina" },
  { key: "PctCoordin", label: "Coordinación", type: "select", group: "distribucionNomina" },

  // col 42 del sheet ("2026") — no se edita desde la app
  { key: "reciboAnio", label: "Año", type: "text", group: "recibos" },

  // ── VALIDACIÓN DE RECIBOS (cols 43-54, se marca con X)
  { key: "m_enero", label: "Enero", type: "month", group: "recibos" },
  { key: "m_febrero", label: "Febrero", type: "month", group: "recibos" },
  { key: "m_marzo", label: "Marzo", type: "month", group: "recibos" },
  { key: "m_abril", label: "Abril", type: "month", group: "recibos" },
  { key: "m_mayo", label: "Mayo", type: "month", group: "recibos" },
  { key: "m_junio", label: "Junio", type: "month", group: "recibos" },
  { key: "m_julio", label: "Julio", type: "month", group: "recibos" },
  { key: "m_agosto", label: "Agosto", type: "month", group: "recibos" },
  { key: "m_septiembre", label: "Septiembre", type: "month", group: "recibos" },
  { key: "m_octubre", label: "Octubre", type: "month", group: "recibos" },
  { key: "m_noviembre", label: "Noviembre", type: "month", group: "recibos" },
  { key: "m_diciembre", label: "Diciembre", type: "month", group: "recibos" },
];

/** Claves de los campos que no se muestran/editan en el formulario. */
export const HIDDEN_KEYS = new Set(["reciboAnio"]);

export const colByKey: Record<string, ColDef> = Object.fromEntries(
  COLS.map((c) => [c.key, c])
);

/** Campos SI/NO físicos usados para el indicador de expediente. */
export const DOCS_FISCO = [
  "cedulaFisco", "cvFisco", "medicoFisco",
  "licenciaFisco", "rifFisco", "certFisco",
];

/** Cuenta de documentos físicos entregados ("SI" o "NO APLICA" cuentan como resuelto). */
export function docsCompletos(emp: Empleado): [number, number] {
  let ok = 0;
  DOCS_FISCO.forEach((k) => {
    const v = String(emp[k] ?? "").toUpperCase();
    if (v === "SI" || v === "NO APLICA") ok++;
  });
  return [ok, DOCS_FISCO.length];
}

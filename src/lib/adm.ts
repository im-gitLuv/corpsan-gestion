// ════════════════════════════════════════════════════════════════
// GESTIÓN ADMINISTRATIVA — dominio compartido.
// Fuente única para el frontend y para Apps Script: scripts/sync-domain.cjs
// la transpila y la integra al final de apps-script/Code.gs.
// Sin imports con valor y sin acceso a ventana/navegador: solo lógica pura.
// ════════════════════════════════════════════════════════════════

export type AdmRow = Record<string, any>;

export interface AdmCampo {
  key: string;
  label: string;
  tipo: "texto" | "fecha" | "numero" | "select" | "textarea" | "url";
  opciones?: string[];
  requerido?: boolean;
  tabla?: boolean;
  full?: boolean;
  ayuda?: string;
  oculto?: boolean;
  autogenerado?: boolean;
  min?: number;
  max?: number;
}

export interface AdmConsecutivo {
  campo: string;
  prefijo: string;
  ancho: number;
  /** El código lleva dirección y departamento entre el año y el consecutivo (CS-2026-I-AD-00001). */
  comunicacion?: boolean;
}

export interface AdmColeccion {
  hoja: string;
  nombre: string;
  campos: AdmCampo[];
  consecutivo?: AdmConsecutivo;
  /** Orden por defecto de la tabla (campo descendente). */
  orden?: string;
}

// ────────────────────────────────────────────────────────────
// Catálogos fijos (etiquetas de la empresa)
// ────────────────────────────────────────────────────────────
export const ADM_ETIQUETAS: Record<string, string> = {
  I: "Interna", E: "Externa",
  OP: "Operaciones", AD: "Administración", DIR: "Dirección",
};
export const ADM_DIRECCIONES = ["I", "E"];
export const ADM_DEPARTAMENTOS = ["OP", "AD", "DIR"];
export const ADM_TIPOS_SOLVENCIA = [
  "Seguro Social (IVSS)", "Seguridad PDVSA", "Ambiente", "Bomberos",
  "Alcaldía", "RACDA", "RUPDAE", "Otro",
];
export const ADM_TIPOS_COMUNICACION = [
  "Carta", "Oferta", "Solicitud", "Circular", "SSO", "Banahvi", "Requisición", "Otro",
];
export const ADM_MODELOS_REQUISICION = ["Oficina", "Activo fijo", "Consumible", "Servicio", "Genérica"];
export const ADM_IMPUESTOS = ["ISLR", "IVA", "Retenciones ISLR", "Retenciones IVA"];
/** Retención de ISLR sobre recibos eventuales: 2 % servicios · 1 % honorarios (criterio de administración). */
export const ADM_RETENCION_RECIBO: Record<string, number> = { Servicio: 0.02, Honorarios: 0.01 };
/** Portales oficiales para consulta de RIF y solvencias (enlaces verificados). */
export const ADM_PORTALES = [
  { nombre: "SENIAT · Portal fiscal", url: "https://www.seniat.gob.ve" },
  { nombre: "SENIAT · Consulta de RIF con cédula", url: "https://dgpatrimonios.seniat.gob.ve/registro/contribuyente" },
  { nombre: "IVSS · Trámites y consultas", url: "https://www.ivss.gov.ve" },
];

const campo = (key: string, label: string, tipo: AdmCampo["tipo"], extra: Partial<AdmCampo> = {}): AdmCampo =>
  ({ key, label, tipo, ...extra });

const ACTUALIZADO = campo("Actualizado", "Actualizado", "fecha", { oculto: true, autogenerado: true });

// ────────────────────────────────────────────────────────────
// Colecciones (una pestaña por cada una; los "headers" del sheet
// son las claves, como en PAGOS y FIN_*)
// ────────────────────────────────────────────────────────────
export const ADM_COLECCIONES: Record<string, AdmColeccion> = {
  COMPRAS: {
    hoja: "ADM_COMPRAS", nombre: "Libro de compras", orden: "Fecha",
    consecutivo: { campo: "ID", prefijo: "CP", ancho: 4 },
    campos: [
      campo("ID", "N°", "texto", { tabla: true, autogenerado: true, oculto: true }),
      campo("Fecha", "Fecha", "fecha", { requerido: true, tabla: true }),
      campo("Proveedor", "Proveedor", "texto", { requerido: true, tabla: true }),
      campo("RIF", "RIF", "texto", { tabla: true }),
      campo("Tipo", "Tipo", "select", { opciones: ["Compra", "Gasto", "Servicio"], tabla: true }),
      campo("Documento", "Documento", "select", { opciones: ["Factura", "Recibo", "Nota de crédito", "Nota de débito"], tabla: true }),
      campo("NControl", "N° de control", "texto"),
      campo("Base", "Base imponible", "numero", { requerido: true, tabla: true }),
      campo("IVA", "IVA", "numero", { tabla: true }),
      campo("Total", "Total", "numero", { tabla: true, autogenerado: true }),
      campo("RetencionISLR", "Retención ISLR practicada", "numero", { tabla: true, ayuda: "Comprobante de retención emitido al proveedor" }),
      campo("NComprobante", "N° comprobante retención", "texto"),
      campo("FormaPago", "Forma de pago", "select", { opciones: ["Transferencia", "Pago Móvil", "Efectivo", "Cheque", "Tarjeta"], tabla: true }),
      campo("Banco", "Banco", "texto", { tabla: true, ayuda: "Cuenta de CorpSan con la que se pagó" }),
      campo("Concepto", "Concepto", "textarea", { full: true, requerido: true }),
      ACTUALIZADO,
    ],
  },
  RECIBOS: {
    hoja: "ADM_RECIBOS", nombre: "Recibos eventuales", orden: "Fecha",
    consecutivo: { campo: "ID", prefijo: "REC", ancho: 4 },
    campos: [
      campo("ID", "Recibo N°", "texto", { tabla: true, autogenerado: true }),
      campo("Fecha", "Fecha", "fecha", { requerido: true, tabla: true }),
      campo("Nombre", "Nombre de la persona", "texto", { requerido: true, tabla: true }),
      campo("Cedula", "Cédula", "texto", { requerido: true, tabla: true }),
      campo("RIF", "RIF", "texto", { tabla: true, ayuda: "Si no lo trae, se consulta con la cédula en el portal del SENIAT" }),
      campo("Tipo", "Tipo", "select", { opciones: ["Servicio", "Honorarios"], requerido: true, tabla: true, ayuda: "Servicio retiene 2 % de ISLR · Honorarios 1 %" }),
      campo("Concepto", "Concepto del trabajo", "texto", { requerido: true, tabla: true, ayuda: "Trabajos eventuales sin factura (p. ej. reparación de aires acondicionados)" }),
      campo("Monto", "Monto", "numero", { requerido: true, tabla: true }),
      campo("PctRetencion", "% retención", "numero", { tabla: true, min: 0, max: 0.5, ayuda: "Se sugiere 2 % (servicio) o 1 % (honorarios)" }),
      campo("Retencion", "Retención ISLR", "numero", { tabla: true, autogenerado: true }),
      campo("Neto", "Neto a pagar", "numero", { tabla: true, autogenerado: true }),
      campo("Banco", "Banco", "texto", { tabla: true, ayuda: "Cuenta de CorpSan desde la que se pagó" }),
      campo("Referencia", "N° referencia bancaria", "texto", { tabla: true, requerido: true, ayuda: "Número de referencia de la transferencia o pago móvil" }),
      campo("Voucher", "Voucher del pago", "texto", { ayuda: "Comprobante anexo que respalda el pago" }),
      campo("Estado", "Estado", "select", { opciones: ["Emitido", "Pagado", "Anulado"], tabla: true }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  PROVEEDORES: {
    hoja: "ADM_PROVEEDORES", nombre: "Proveedores y clientes", orden: "Nombre",
    consecutivo: { campo: "ID", prefijo: "PRV", ancho: 4 },
    campos: [
      campo("ID", "N°", "texto", { tabla: true, autogenerado: true, oculto: true }),
      campo("Tipo", "Tipo", "select", { opciones: ["Proveedor", "Cliente", "Ambos"], requerido: true, tabla: true }),
      campo("Nombre", "Nombre o razón social", "texto", { requerido: true, tabla: true }),
      campo("RIF", "RIF", "texto", { tabla: true }),
      campo("Cedula", "Cédula", "texto"),
      campo("Telefono", "Teléfono", "texto", { tabla: true }),
      campo("Correo", "Correo", "texto"),
      campo("Direccion", "Dirección", "textarea", { full: true }),
      campo("Contacto", "Persona de contacto", "texto", { tabla: true }),
      campo("Banco", "Banco", "texto", { tabla: true }),
      campo("NCuenta", "N° de cuenta", "texto"),
      campo("PagoMovil", "Pago móvil", "texto"),
      campo("Notas", "Notas", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  COTIZACIONES: {
    hoja: "ADM_COTIZACIONES", nombre: "Cotizaciones", orden: "Fecha",
    consecutivo: { campo: "ID", prefijo: "COT", ancho: 4 },
    campos: [
      campo("ID", "Cotización N°", "texto", { tabla: true, autogenerado: true }),
      campo("Fecha", "Fecha", "fecha", { requerido: true, tabla: true }),
      campo("Cliente", "Cliente", "texto", { requerido: true, tabla: true }),
      campo("Contacto", "Contacto", "texto"),
      campo("Concepto", "Concepto", "textarea", { full: true, requerido: true }),
      campo("Moneda", "Moneda", "select", { opciones: ["USD", "Bs"], tabla: true }),
      campo("Monto", "Monto", "numero", { requerido: true, tabla: true }),
      campo("Validez", "Válida hasta", "fecha", { tabla: true }),
      campo("Estatus", "Estatus", "select", { opciones: ["En elaboración", "Enviada", "Aprobada", "Rechazada", "Anulada"], tabla: true }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  ORDENES: {
    hoja: "ADM_ORDENES", nombre: "Órdenes de trabajo", orden: "FechaInicio",
    consecutivo: { campo: "ID", prefijo: "OT", ancho: 4 },
    campos: [
      campo("ID", "OT N°", "texto", { tabla: true, autogenerado: true }),
      campo("Fecha", "Fecha de apertura", "fecha", { requerido: true, tabla: true }),
      campo("Cotizacion", "Cotización vinculada", "texto", { tabla: true, ayuda: "COT-… de la que nace la orden" }),
      campo("Cliente", "Cliente", "texto", { requerido: true, tabla: true }),
      campo("Concepto", "Concepto del trabajo", "textarea", { full: true, requerido: true }),
      campo("Partidas", "Partidas de la cotización", "textarea", { full: true, ayuda: "Una por línea con su monto" }),
      campo("FechaInicio", "Inicio", "fecha", { tabla: true }),
      campo("FechaFin", "Culminación", "fecha", { tabla: true }),
      campo("Estatus", "Estatus", "select", { opciones: ["Programada", "En ejecución", "Culminada", "Anulada"], tabla: true }),
      campo("Monto", "Monto total", "numero", { requerido: true, tabla: true }),
      campo("Anticipos", "Anticipos recibidos", "numero", { tabla: true }),
      campo("Cobrado", "Total cobrado", "numero", { tabla: true }),
      campo("PorCobrar", "Por cobrar", "numero", { tabla: true, autogenerado: true }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  FACTURAS: {
    hoja: "ADM_FACTURAS", nombre: "Registro de facturación", orden: "Fecha",
    consecutivo: { campo: "ID", prefijo: "FX", ancho: 4 },
    campos: [
      campo("ID", "N° interno", "texto", { tabla: true, autogenerado: true, oculto: true }),
      campo("Fecha", "Fecha emisión", "fecha", { requerido: true, tabla: true }),
      campo("Factura", "Factura N°", "texto", { tabla: true, ayuda: "Número del talonario físico" }),
      campo("NControl", "N° de control", "texto"),
      campo("Cliente", "Cliente", "texto", { requerido: true, tabla: true }),
      campo("RIF", "RIF", "texto", { tabla: true }),
      campo("OT", "OT vinculada", "texto", { tabla: true }),
      campo("Concepto", "Concepto", "texto", { requerido: true, tabla: true }),
      campo("Base", "Base imponible", "numero", { requerido: true, tabla: true }),
      campo("IVA", "IVA", "numero", { tabla: true }),
      campo("Total", "Total", "numero", { tabla: true, autogenerado: true }),
      campo("RetencionISLR", "Retención ISLR aplicada", "numero", { tabla: true, ayuda: "Retención que practicó el cliente al pagarnos" }),
      campo("Cobrada", "Cobrada", "select", { opciones: ["NO", "SI"], tabla: true }),
      campo("MontoCobrado", "Monto cobrado", "numero", { tabla: true }),
      campo("FechaCobro", "Fecha de cobro", "fecha", { tabla: true }),
      campo("MetodoCobro", "Método de cobro", "select", { opciones: ["Transferencia", "Pago Móvil", "Efectivo", "Cheque", "Tarjeta"] }),
      campo("ReferenciaCobro", "Referencia del cobro", "texto"),
      campo("Saldo", "Saldo", "numero", { tabla: true, autogenerado: true }),
      ACTUALIZADO,
    ],
  },
  DECLARACIONES: {
    hoja: "ADM_DECLARACIONES", nombre: "Declaraciones", orden: "FechaLimite",
    consecutivo: { campo: "ID", prefijo: "DC", ancho: 3 },
    campos: [
      campo("ID", "N°", "texto", { autogenerado: true, oculto: true }),
      campo("Impuesto", "Impuesto", "select", { opciones: ADM_IMPUESTOS, requerido: true, tabla: true }),
      campo("Periodo", "Período", "texto", { requerido: true, tabla: true, ayuda: "Ej. 2026-11" }),
      campo("FechaLimite", "Fecha límite", "fecha", { requerido: true, tabla: true }),
      campo("Estatus", "Estatus", "select", { opciones: ["Programada", "Declarada"], tabla: true }),
      campo("FechaDeclarada", "Fecha declarada", "fecha", { tabla: true }),
      campo("Planilla", "N° planilla", "texto", { tabla: true }),
      campo("Monto", "Monto declarado", "numero", { tabla: true }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  POLIZAS: {
    hoja: "ADM_POLIZAS", nombre: "Pólizas, seguros y fianzas", orden: "Hasta",
    consecutivo: { campo: "ID", prefijo: "PZ", ancho: 3 },
    campos: [
      campo("ID", "N°", "texto", { autogenerado: true, oculto: true }),
      campo("Tipo", "Tipo", "select", { opciones: ["Póliza", "Seguro", "Fianza"], requerido: true, tabla: true }),
      campo("Numero", "N° póliza", "texto", { tabla: true }),
      campo("Aseguradora", "Aseguradora", "texto", { requerido: true, tabla: true }),
      campo("Concepto", "Concepto / cobertura", "texto", { tabla: true }),
      campo("MontoAsegurado", "Monto asegurado", "numero"),
      campo("Prima", "Prima", "numero", { tabla: true }),
      campo("Desde", "Vigente desde", "fecha"),
      campo("Hasta", "Vence", "fecha", { requerido: true, tabla: true }),
      campo("Beneficiario", "Beneficiario", "texto"),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  SOLVENCIAS: {
    hoja: "ADM_SOLVENCIAS", nombre: "Solvencias y certificaciones", orden: "Vencimiento",
    consecutivo: { campo: "ID", prefijo: "SV", ancho: 3 },
    campos: [
      campo("ID", "N°", "texto", { autogenerado: true, oculto: true }),
      campo("Tipo", "Tipo", "select", { opciones: ADM_TIPOS_SOLVENCIA, requerido: true, tabla: true }),
      campo("Ente", "Ente emisor", "texto", { tabla: true }),
      campo("Numero", "N° documento", "texto", { tabla: true }),
      campo("Emision", "Emitida", "fecha", { tabla: true }),
      campo("Vencimiento", "Vence", "fecha", { requerido: true, tabla: true }),
      campo("Enlace", "Enlace del portal", "url", { tabla: true, ayuda: "Enlace al portal del ente para verificar la solvencia actualizada" }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  COMUNICACIONES: {
    hoja: "ADM_COMUNICACIONES", nombre: "Comunicaciones", orden: "Fecha",
    consecutivo: { campo: "ID", prefijo: "CS", ancho: 5, comunicacion: true },
    campos: [
      campo("ID", "Código", "texto", { tabla: true, autogenerado: true, ayuda: "CS-2026-I-AD-00001 · consecutivo único anual" }),
      campo("Fecha", "Fecha", "fecha", { requerido: true, tabla: true }),
      campo("Direccion", "Dirección", "select", { opciones: ADM_DIRECCIONES, requerido: true, tabla: true }),
      campo("Departamento", "Departamento", "select", { opciones: ADM_DEPARTAMENTOS, requerido: true, tabla: true }),
      campo("Tipo", "Tipo", "select", { opciones: ADM_TIPOS_COMUNICACION, requerido: true, tabla: true }),
      campo("Asunto", "Asunto", "texto", { requerido: true, tabla: true }),
      campo("Destinatario", "Destinatario", "texto", { tabla: true }),
      campo("EnviadoPor", "Enviada por", "texto", { tabla: true }),
      campo("Estado", "Estado", "select", { opciones: ["En trámite", "Enviada", "Recibida", "Anulada"], tabla: true }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
  REQUISICIONES: {
    hoja: "ADM_REQUISICIONES", nombre: "Requisiciones", orden: "Fecha",
    consecutivo: { campo: "ID", prefijo: "RQ", ancho: 4 },
    campos: [
      campo("ID", "Requisición N°", "texto", { tabla: true, autogenerado: true }),
      campo("Fecha", "Fecha", "fecha", { requerido: true, tabla: true }),
      campo("Departamento", "Departamento", "select", { opciones: ADM_DEPARTAMENTOS, tabla: true }),
      campo("Modelo", "Modelo de ficha", "select", { opciones: ADM_MODELOS_REQUISICION, requerido: true, tabla: true }),
      campo("SolicitadoPor", "Solicitada por", "texto", { requerido: true, tabla: true }),
      campo("Descripcion", "Descripción", "textarea", { full: true, requerido: true }),
      campo("Cantidad", "Cantidad", "numero"),
      campo("Unidad", "Unidad", "texto"),
      campo("Prioridad", "Prioridad", "select", { opciones: ["Normal", "Urgente"], tabla: true }),
      campo("Estatus", "Estatus", "select", { opciones: ["Pendiente", "Cotizada", "Aprobada", "Comprada", "Anulada"], tabla: true }),
      campo("Cotizacion", "Cotización", "texto", { tabla: true }),
      campo("AprobadaPor", "Aprobada por", "texto", { tabla: true }),
      campo("Proveedor", "Proveedor", "texto", { tabla: true }),
      campo("Factura", "Factura anexa N°", "texto", { tabla: true, ayuda: "En activos fijos se escanea la factura para el expediente" }),
      campo("Soporte", "Soporte firmado", "texto", { tabla: true, ayuda: "Quien firmó el soporte físico" }),
      campo("Observaciones", "Observaciones", "textarea", { full: true }),
      ACTUALIZADO,
    ],
  },
};

// ────────────────────────────────────────────────────────────
// Utilidades puras
// ────────────────────────────────────────────────────────────
export function admR2(v: number): number { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }

function admNumero(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function admDias(fecha: any, hoy: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha ?? ""));
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(hoy ?? ""));
  if (!m || !b) return null;
  const a = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const c = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((a - c) / 86400000);
}

export interface AdmSituacion { estado: string; alerta: "declarada" | "vencida" | "hoy" | "manana" | "cinco" | "ok" | "sinfecha"; dias: number | null }

/** Situación de una declaración: alertas 5 días antes y 1 día antes. */
export function admEstadoDeclaracion(fila: AdmRow, hoy: string): AdmSituacion {
  if (String(fila.Estatus ?? "") === "Declarada" || fila.FechaDeclarada) {
    return { estado: "Declarada", alerta: "declarada", dias: null };
  }
  const dias = admDias(fila.FechaLimite, hoy);
  if (dias === null) return { estado: "Sin fecha", alerta: "sinfecha", dias: null };
  if (dias < 0) return { estado: "Vencida", alerta: "vencida", dias };
  if (dias === 0) return { estado: "Vence hoy", alerta: "hoy", dias };
  if (dias === 1) return { estado: "Vence mañana", alerta: "manana", dias };
  if (dias <= 5) return { estado: `En ${dias} días`, alerta: "cinco", dias };
  return { estado: "Programada", alerta: "ok", dias };
}

export type AdmVigencia = "Vigente" | "Por vencer" | "Vencida" | "Sin fecha";

/** Vigencia de pólizas y solvencias: por vencer dentro de 30 días. */
export function admVigencia(vencimiento: any, hoy: string): AdmVigencia {
  const dias = admDias(vencimiento, hoy);
  if (dias === null) return "Sin fecha";
  if (dias < 0) return "Vencida";
  if (dias <= 30) return "Por vencer";
  return "Vigente";
}

/** Máximo consecutivo ya usado para un prefijo y año (código CS-2026-I-AD-00042 → 42). */
export function admConsecutivo(filas: AdmRow[], campoCodigo: string, prefijo: string, anio: number): number {
  const re = new RegExp("^" + prefijo + "-" + anio + "-(?:[A-Z]{1,3}-){0,2}(\\d+)$");
  let max = 0;
  filas.forEach(function (f) {
    const m = String(f[campoCodigo] ?? "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max;
}

export function admPad(n: number, ancho: number): string {
  return String(Math.max(1, n)).padStart(ancho, "0");
}

/** Vista previa del siguiente código (comunicaciones: CS-2026-[I|E]-[OP|AD|DIR]-00042). */
export function admSiguiente(coleccion: string, filas: AdmRow[], hoy: string): string {
  const def = ADM_COLECCIONES[coleccion];
  if (!def || !def.consecutivo) return "";
  const anio = Number(String(hoy).slice(0, 4)) || 2000;
  const n = admConsecutivo(filas, def.consecutivo.campo, def.consecutivo.prefijo, anio) + 1;
  const cuerpo = def.consecutivo.comunicacion ? "[I|E]-[OP|AD|DIR]-" : "";
  return def.consecutivo.prefijo + "-" + anio + "-" + cuerpo + admPad(n, def.consecutivo.ancho);
}

/** Código definitivo de comunicaciones: CS-2026-I-AD-00042. */
export function admCodigoComunicacion(anio: number, direccion: string, departamento: string, n: number, ancho: number): string {
  return "CS-" + anio + "-" + (direccion || "I") + "-" + (departamento || "AD") + "-" + admPad(n, ancho);
}

/** Validación común (frontend antes de guardar; backend dentro del bloqueo). */
export function admValidar(coleccion: string, fila: AdmRow): string {
  const def = ADM_COLECCIONES[coleccion];
  if (!def) return "Colección desconocida: " + coleccion;
  for (const c of def.campos) {
    if (c.autogenerado || c.oculto) continue;
    const v = fila[c.key];
    const s = String(v ?? "").trim();
    if (c.requerido && !s) return c.label + " es obligatorio";
    if (!s) continue;
    if (c.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return c.label + ": usa el formato de fecha del calendario";
    if (c.tipo === "numero") {
      const n = Number(s);
      if (!Number.isFinite(n) || n < 0) return c.label + " debe ser un número válido";
      if (c.min !== undefined && n < c.min) return c.label + " no puede ser menor que " + c.min;
      if (c.max !== undefined && n > c.max) return c.label + " no puede ser mayor que " + c.max;
    }
    if (c.tipo === "select" && c.opciones && !c.opciones.includes(s)) return c.label + ": valor no válido";
    if (s.length > 600) return c.label + " es demasiado extenso";
  }
  if (coleccion === "RECIBOS" && !(Number(fila.PctRetencion) > 0)) {
    return "Indica el % de retención de ISLR (2 % servicio · 1 % honorarios)";
  }
  return "";
}

/** Campos calculados en un solo lugar (frontend y backend). */
export function admCalcularFila(coleccion: string, fila: AdmRow): AdmRow {
  const r: AdmRow = { ...fila };
  if (coleccion === "COMPRAS") r.Total = admR2(admNumero(r.Base) + admNumero(r.IVA));
  if (coleccion === "FACTURAS") {
    r.Total = admR2(admNumero(r.Base) + admNumero(r.IVA));
    r.Saldo = admR2(admNumero(r.Total) - admNumero(r.MontoCobrado));
  }
  if (coleccion === "RECIBOS") {
    r.Retencion = admR2(admNumero(r.Monto) * admNumero(r.PctRetencion));
    r.Neto = admR2(admNumero(r.Monto) - admNumero(r.Retencion));
  }
  if (coleccion === "ORDENES") r.PorCobrar = admR2(admNumero(r.Monto) - admNumero(r.Cobrado));
  return r;
}

/**
 * Prepara la fila para guardar: valida, calcula y asigna el código consecutivo.
 * `existente` conserva su código original (nunca se renumera).
 */
export function admPreparar(coleccion: string, datos: AdmRow, filas: AdmRow[], hoy: string): { fila: AdmRow; error: string } {
  const error = admValidar(coleccion, datos);
  if (error) return { fila: datos, error };
  const def = ADM_COLECCIONES[coleccion];
  let r = admCalcularFila(coleccion, datos);
  const existente = r.ID ? filas.find(function (f) { return String(f.ID) === String(r.ID); }) : null;
  if (!existente && def && def.consecutivo) {
    const anio = Number(String(r.Fecha ?? hoy).slice(0, 4)) || Number(String(hoy).slice(0, 4));
    const n = admConsecutivo(filas, def.consecutivo.campo, def.consecutivo.prefijo, anio) + 1;
    r.ID = def.consecutivo.comunicacion
      ? admCodigoComunicacion(anio, String(r.Direccion ?? "I"), String(r.Departamento ?? "AD"), n, def.consecutivo.ancho)
      : def.consecutivo.prefijo + "-" + anio + "-" + admPad(n, def.consecutivo.ancho);
  }
  if (existente) r.ID = existente.ID;
  r.Actualizado = new Date().toISOString();
  return { fila: r, error: "" };
}

// ────────────────────────────────────────────────────────────
// Resumen del panel (declara próximas declaraciones, vencimientos,
// facturas por cobrar y comunicaciones del año)
// ────────────────────────────────────────────────────────────
export interface AdmResumen {
  hoy: string;
  declaraciones: Array<AdmRow & { estado: string; alerta: AdmSituacion["alerta"]; dias: number | null }>;
  vencimientos: Array<{ coleccion: string; tipo: string; numero: string; vencimiento: string; estado: AdmVigencia; dias: number | null }>;
  facturas: { porCobrar: number; cantidad: number };
  comunicaciones: { anio: string; emitidas: number; ultimo: string };
  cotizaciones: { anio: string; emitidas: number; monto: number };
}

export function admCalcularResumen(datos: Record<string, AdmRow[]>, hoy: string): AdmResumen {
  const anio = String(hoy).slice(0, 4);
  const declaraciones: AdmResumen["declaraciones"] = (datos.DECLARACIONES || [])
    .filter(function (f) { return String(f.Estatus ?? "") !== "Declarada" && !f.FechaDeclarada; })
    .map(function (f) { const s = admEstadoDeclaracion(f, hoy); const out: AdmResumen["declaraciones"][number] = { ...f, estado: s.estado, alerta: s.alerta, dias: s.dias }; return out; })
    .sort(function (a, b) { return String(a.FechaLimite ?? "").localeCompare(String(b.FechaLimite ?? "")); });

  const vencimientos: AdmResumen["vencimientos"] = [];
  (datos.POLIZAS || []).forEach(function (f) {
    const estado = admVigencia(f.Hasta, hoy);
    if (estado === "Vigente") return;
    vencimientos.push({ coleccion: "Pólizas y seguros", tipo: String(f.Tipo ?? ""), numero: String(f.Numero ?? f.Aseguradora ?? ""), vencimiento: String(f.Hasta ?? ""), estado, dias: admDias(f.Hasta, hoy) });
  });
  (datos.SOLVENCIAS || []).forEach(function (f) {
    const estado = admVigencia(f.Vencimiento, hoy);
    if (estado === "Vigente") return;
    vencimientos.push({ coleccion: "Solvencias", tipo: String(f.Tipo ?? ""), numero: String(f.Numero ?? f.Ente ?? ""), vencimiento: String(f.Vencimiento ?? ""), estado, dias: admDias(f.Vencimiento, hoy) });
  });
  vencimientos.sort(function (a, b) { return String(a.vencimiento).localeCompare(String(b.vencimiento)); });

  const facturas = (datos.FACTURAS || []).map(function (f) { return admCalcularFila("FACTURAS", f); });
  const porCobrar = facturas
    .filter(function (f) { return String(f.Cobrada ?? "NO").toUpperCase() !== "SI"; })
    .reduce(function (s, f) { return s + admNumero(f.Saldo); }, 0);

  const comunicaciones = (datos.COMUNICACIONES || []).filter(function (f) { return String(f.Fecha ?? "").startsWith(anio); });
  // El «último» código es el de mayor consecutivo: la dirección/departamento
  // altera el orden alfabético, así que se compara por el número final.
  let ultimo = "", ultimoNum = -1;
  comunicaciones.forEach(function (f) {
    const m = /-(\d+)$/.exec(String(f.ID ?? ""));
    const n = m ? Number(m[1]) : -1;
    if (n > ultimoNum || (n < 0 && String(f.ID ?? "") > ultimo)) { ultimoNum = n; ultimo = String(f.ID ?? ""); }
  });

  const cotizaciones = (datos.COTIZACIONES || []).filter(function (f) {
    return String(f.Fecha ?? "").startsWith(anio) && String(f.Estatus ?? "") !== "Anulada" && String(f.Estatus ?? "") !== "Rechazada";
  });

  return {
    hoy,
    declaraciones,
    vencimientos,
    facturas: { porCobrar: admR2(porCobrar), cantidad: facturas.filter(function (f) { return String(f.Cobrada ?? "NO").toUpperCase() !== "SI"; }).length },
    comunicaciones: { anio, emitidas: comunicaciones.length, ultimo },
    cotizaciones: { anio, emitidas: cotizaciones.length, monto: admR2(cotizaciones.reduce(function (s, f) { return s + admNumero(f.Monto); }, 0)) },
  };
}

/** Formateo de dinero para tablas administrativas. */
export function admDinero(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

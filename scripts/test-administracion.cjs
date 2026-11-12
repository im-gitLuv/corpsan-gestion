const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');

// ── 1) Dominio puro (src/lib/adm.ts) ──────────────────────────────
const context = { exports: {}, require, Date, Intl, console, Object, Number, Math, JSON, String, RegExp, Array };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/adm.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const a = context.exports;

// Validaciones de formulario
assert.equal(a.admValidar('COMPRAS', { Fecha: '2026-11-12', Proveedor: 'Inversiones XYZ', Base: 1000, Concepto: 'Compra de materiales' }), '');
assert.match(a.admValidar('COMPRAS', { Fecha: '2026-11-12', Base: 1000, Concepto: 'x' }), /Proveedor/);
assert.match(a.admValidar('COMPRAS', { Fecha: '12-11-2026', Proveedor: 'x', Base: 1, Concepto: 'x' }), /formato de fecha/);
assert.match(a.admValidar('COMPRAS', { Fecha: '2026-11-12', Proveedor: 'x', Base: -5, Concepto: 'x' }), /número válido/);
assert.match(a.admValidar('COMPRAS', { Fecha: '2026-11-12', Proveedor: 'x', Base: 1, Concepto: 'x', Tipo: 'Otro raro' }), /no válido/);
assert.match(a.admValidar('RECIBOS', { Fecha: '2026-11-12', Nombre: 'x', Cedula: '1', Tipo: 'Servicio', Concepto: 'x', Monto: 100, Referencia: '1' }), /% de retención/);

// Cálculos derivados
assert.equal(a.admCalcularFila('COMPRAS', { Base: 1000, IVA: 160 }).Total, 1160);
assert.equal(a.admCalcularFila('FACTURAS', { Base: 1000, IVA: 160, MontoCobrado: 500 }).Saldo, 660);
assert.equal(a.admCalcularFila('RECIBOS', { Monto: 500, PctRetencion: 0.02 }).Retencion, 10);
assert.equal(a.admCalcularFila('RECIBOS', { Monto: 500, PctRetencion: 0.02 }).Neto, 490);
assert.equal(a.admCalcularFila('ORDENES', { Monto: 8000, Cobrado: 2500 }).PorCobrar, 5500);

// Alertas de declaraciones: 5 días antes y 1 día antes
const decl = a.admEstadoDeclaracion({ Estatus: 'Declarada' }, '2026-11-12');
assert.equal(decl.estado, 'Declarada'); assert.equal(decl.alerta, 'declarada'); assert.equal(decl.dias, null);
assert.equal(a.admEstadoDeclaracion({ FechaLimite: '2026-11-15' }, '2026-11-12').alerta, 'cinco');
assert.equal(a.admEstadoDeclaracion({ FechaLimite: '2026-11-13' }, '2026-11-12').alerta, 'manana');
assert.equal(a.admEstadoDeclaracion({ FechaLimite: '2026-11-12' }, '2026-11-12').alerta, 'hoy');
assert.equal(a.admEstadoDeclaracion({ FechaLimite: '2026-11-11' }, '2026-11-12').alerta, 'vencida');
assert.equal(a.admEstadoDeclaracion({ FechaLimite: '2026-11-18' }, '2026-11-12').alerta, 'ok');
assert.equal(a.admEstadoDeclaracion({}, '2026-11-12').alerta, 'sinfecha');

// Vigencia de pólizas y solvencias
assert.equal(a.admVigencia('2026-12-12', '2026-11-12'), 'Por vencer');
assert.equal(a.admVigencia('2027-10-01', '2026-11-12'), 'Vigente');
assert.equal(a.admVigencia('2026-11-05', '2026-11-12'), 'Vencida');
assert.equal(a.admVigencia('', '2026-11-12'), 'Sin fecha');

// Consecutivos: máximo global por prefijo y año
const filas = [
  { ID: 'CS-2026-I-AD-00002' }, { ID: 'CS-2026-E-OP-00007' }, { ID: 'CS-2025-I-AD-00999' }, { ID: 'OT-2026-00031' },
];
assert.equal(a.admConsecutivo(filas, 'ID', 'CS', 2026), 7);
assert.equal(a.admConsecutivo(filas, 'ID', 'CS', 2025), 999);
assert.equal(a.admConsecutivo(filas, 'ID', 'OT', 2026), 31);
assert.equal(a.admSiguiente('COMUNICACIONES', filas, '2026-11-12'), 'CS-2026-[I|E]-[OP|AD|DIR]-00008');
assert.equal(a.admSiguiente('ORDENES', filas, '2026-11-12'), 'OT-2026-0032');
assert.equal(a.admCodigoComunicacion(2026, 'E', 'DIR', 42, 5), 'CS-2026-E-DIR-00042');
assert.equal(a.admPad(7, 5), '00007');

// Preparación: códigos al crear, conservados al editar
const nueva = a.admPreparar('COMUNICACIONES', { Fecha: '2026-11-12', Direccion: 'I', Departamento: 'AD', Tipo: 'Carta', Asunto: 'Prueba' }, filas, '2026-11-12');
assert.equal(nueva.error, '');
assert.equal(nueva.fila.ID, 'CS-2026-I-AD-00008');
const editada = a.admPreparar('COMUNICACIONES', { ID: 'CS-2026-I-AD-00002', Fecha: '2026-11-12', Direccion: 'I', Departamento: 'AD', Tipo: 'Carta', Asunto: 'Cambio' }, filas, '2026-11-12');
assert.equal(editada.fila.ID, 'CS-2026-I-AD-00002');
assert.match(a.admPreparar('COMUNICACIONES', { Fecha: '2026-11-12', Asunto: 'x' }, [], '2026-11-12').error, /Dirección/);

// Resumen del panel
const resumen = a.admCalcularResumen({
  DECLARACIONES: [
    { ID: 'DC1', Impuesto: 'ISLR', Periodo: '2026-11', FechaLimite: '2026-11-15', Estatus: 'Programada' },
    { ID: 'DC2', Impuesto: 'IVA', Periodo: '2026-10', FechaLimite: '2026-10-20', Estatus: 'Declarada', FechaDeclarada: '2026-10-19' },
  ],
  POLIZAS: [
    { Tipo: 'Póliza', Numero: 'P1', Aseguradora: 'Seguros Caracas', Hasta: '2026-12-02' },
    { Tipo: 'Seguro', Numero: 'P2', Aseguradora: 'Otra', Hasta: '2027-09-01' },
  ],
  SOLVENCIAS: [{ Tipo: 'Alcaldía', Numero: 'SV1', Ente: 'Alcaldía de Maturín', Vencimiento: '2026-11-05' }],
  FACTURAS: [
    { ID: 'FX1', Base: 1000, IVA: 160, MontoCobrado: 1160, Cobrada: 'SI' },
    { ID: 'FX2', Base: 1000, IVA: 160, MontoCobrado: 0, Cobrada: 'NO' },
  ],
  COMUNICACIONES: [
    { ID: 'CS-2026-I-AD-00002', Fecha: '2026-02-01' }, { ID: 'CS-2026-E-DIR-00005', Fecha: '2026-03-01' },
    { ID: 'CS-2025-I-AD-00001', Fecha: '2025-03-01' },
  ],
  COTIZACIONES: [
    { ID: 'COT1', Fecha: '2026-01-10', Monto: 500, Estatus: 'Aprobada' },
    { ID: 'COT2', Fecha: '2026-02-10', Monto: 200, Estatus: 'Anulada' },
  ],
}, '2026-11-12');
assert.equal(resumen.declaraciones.length, 1);
assert.equal(resumen.declaraciones[0].estado, 'En 3 días');
assert.equal(resumen.vencimientos.length, 2); // por vencer + vencida; la vigente queda fuera
assert.equal(resumen.vencimientos[0].coleccion, 'Solvencias'); // la más próxima primero
assert.equal(resumen.facturas.porCobrar, 1160);
assert.equal(resumen.facturas.cantidad, 1);
assert.equal(resumen.comunicaciones.emitidas, 2);
assert.equal(resumen.comunicaciones.ultimo, 'CS-2026-E-DIR-00005');
assert.equal(resumen.cotizaciones.emitidas, 1);
assert.equal(resumen.cotizaciones.monto, 500);
console.log('ADM DOMINIO PASS: validaciones, cálculo derivado, alertas 5/1 día, vigencias, consecutivo global y resumen.');

// ── 2) Backend Apps Script con hojas simuladas ───────────────────
const backend = { Date, Math, JSON, console, Number, Object, Array, Map, Set, String, RegExp, Intl, Utilities: { formatDate: () => '2026-11-12', getUuid: () => 'uuid' }, CacheService: { getScriptCache: () => ({ get: () => null }) }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) } };
vm.createContext(backend);
vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), backend);
const tables = new Map();
function sheet(headers) {
  const rows = headers ? [...headers] : [];
  const s = {
    rows,
    appendRow: r => rows.push([...r]),
    setFrozenRows() {},
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getMaxColumns: () => 40,
    getDataRange: () => ({ getValues: () => rows.map(r => [...r]) }),
    getRange(row, col, n = 1, width = 1) {
      const range = {
        getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[col - 1 + j] ?? '')),
        setValues: vs => { vs.forEach((v, i) => { rows[row - 1 + i] ||= []; v.forEach((x, j) => rows[row - 1 + i][col - 1 + j] = x); }); return range; },
        setNumberFormat: () => range,
        setValue: v => { rows[row - 1] ||= []; rows[row - 1][col - 1] = v; return range; },
        getValue: () => rows[row - 1]?.[col - 1] ?? '',
      };
      return range;
    },
    deleteRow(row) { rows.splice(row - 1, 1); return s; },
    insertRowsAfter() { return s; },
    insertColumnsAfter() { return s; },
  };
  return s;
}
const book = { getSheetByName: n => tables.get(n), insertSheet: n => { const s = sheet([]); tables.set(n, s); return s; }, getSpreadsheetTimeZone: () => 'America/Caracas' };
backend.ss = () => book;
backend.SpreadsheetApp = { openById: () => book, flush() {} };
backend.finSesion = token => { if (token !== 'test') throw new Error('La sesión venció. Vuelve a iniciar sesión.'); return 'admin'; };
// rfToday() queda fijado en 2026-11-12: las alertas «en 3 días» son deterministas.

// Rechazo de sesión inválida sin tocar hojas
assert.throws(() => backend.admSave('bad', 'COMUNICACIONES', { Fecha: '2026-11-12', Direccion: 'I', Departamento: 'AD', Tipo: 'Carta', Asunto: 'x' }), /sesión/);
assert.equal(tables.size, 0);

// Guardar dos comunicaciones: el consecutivo es global (00001 → 00002) aunque cambie dirección/departamento
const c1 = backend.admSave('test', 'COMUNICACIONES', { Fecha: '2026-11-12', Direccion: 'I', Departamento: 'AD', Tipo: 'Carta', Asunto: 'Solicitud de materiales', Destinatario: 'Operaciones', Estado: 'En trámite' });
assert(c1.ok); assert.equal(c1.id, 'CS-2026-I-AD-00001');
const c2 = backend.admSave('test', 'COMUNICACIONES', { Fecha: '2026-11-12', Direccion: 'E', Departamento: 'DIR', Tipo: 'Oferta', Asunto: 'Segunda', Estado: 'Enviada' });
assert.equal(c2.id, 'CS-2026-E-DIR-00002');
assert.equal(backend.admRows('COMUNICACIONES').length, 2);

// Recibos eventuales: retención persistida con sus totales
const r1 = backend.admSave('test', 'RECIBOS', { Fecha: '2026-11-12', Nombre: 'Reparaciones AC', Cedula: '9876543', Tipo: 'Servicio', Concepto: 'Mantenimiento de aires', Monto: 500, PctRetencion: 0.02, Banco: 'BNC', Referencia: 'TRF-889', Estado: 'Emitido' });
assert(r1.ok);
const filaRecibo = backend.admRows('RECIBOS')[0];
assert.equal(filaRecibo.Retencion, 10);
assert.equal(filaRecibo.Neto, 490);

// Validación del backend: rechaza sin escribir ninguna fila (la pestaña se crea con solo encabezado)
assert.equal(backend.admSave('test', 'DECLARACIONES', { Impuesto: 'ISLR', Periodo: '2026-11' }).ok, false);
assert.equal(backend.admRows('DECLARACIONES').length, 0);

// Declaración programada + resumen del panel
const d1 = backend.admSave('test', 'DECLARACIONES', { Impuesto: 'ISLR', Periodo: '2026-11', FechaLimite: '2026-11-15', Estatus: 'Programada', Monto: 0 });
assert(d1.ok);
const lista = backend.admList('COMUNICACIONES,RECIBOS,DECLARACIONES');
assert.equal(lista.siguiente.COMUNICACIONES, 'CS-2026-[I|E]-[OP|AD|DIR]-00003');
assert.equal(lista.siguiente.RECIBOS, 'REC-2026-0002');
const res = backend.admResumen();
assert.equal(res.declaraciones[0].estado, 'En 3 días');
assert.equal(res.declaraciones[0].alerta, 'cinco');

// Editar conserva el código; eliminar quita la fila y audita
const ed = backend.admSave('test', 'COMUNICACIONES', { ID: c1.id, Fecha: '2026-11-12', Direccion: 'I', Departamento: 'AD', Tipo: 'Carta', Asunto: 'Solicitud ampliada', Estado: 'Recibida' });
assert.equal(ed.id, c1.id);
assert.equal(backend.admRows('COMUNICACIONES').length, 2);
assert.equal(backend.admRows('COMUNICACIONES')[0].Asunto, 'Solicitud ampliada');
const del = backend.admDel('test', 'RECIBOS', r1.id);
assert(del.ok);
assert.equal(backend.admRows('RECIBOS').length, 0);
const bitacora = tables.get('ADM_BITACORA');
assert(bitacora.rows.length >= 5);
assert.equal(bitacora.rows[bitacora.rows.length - 1][3], 'ELIMINAR');
// Las cadenas peligrosas nunca se escriben como fórmulas
const peligro = backend.admSave('test', 'COMUNICACIONES', { Fecha: '2026-11-12', Direccion: 'I', Departamento: 'AD', Tipo: 'Carta', Asunto: '=SUM(A1:A2)', Estado: 'Enviada' });
const asuntoEscrito = backend.admRows('COMUNICACIONES').find(f => f.ID === peligro.id).Asunto;
assert.equal(asuntoEscrito, "'=SUM(A1:A2)");
console.log('ADM BACKEND PASS: adm_list/adm_save/adm_del/adm_resumen, consecutivo global, retención, auditoría y escape. Sin escrituras en Google.');

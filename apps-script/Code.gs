/*************************************************************
 * CORPSAN — Sistema de Gestión Administrativa
 * Backend: Google Apps Script + Google Sheets
 * Base: BD TALENTO HUMANO (pestañas "BD PERSONAL ACTIVO" / "INACTIVOS")
 *
 * v2 — Mapeo dinámico de columnas:
 *   · Detecta automáticamente la fila de encabezados (busca "CEDULA" y "NOMBRE").
 *   · Reconoce cada columna POR NOMBRE (con o sin tildes, "(USD)", "FISCO/DIGITAL" en subfila),
 *     no por posición: puedes reordenar o insertar columnas sin romper el backend.
 *   · Si existe la columna ESTADO, "activos" e "inactivos" se filtran por ella.
 *
 * INSTALACIÓN (5 minutos):
 * 1) Abre la hoja BD TALENTO HUMANO → Extensiones → Apps Script
 * 2) Pega este archivo completo y GUARDA (Ctrl+S)
 * 3) Implementar → Nueva implementación → tipo "Aplicación web"
 *      · Ejecutar como: yo (tu cuenta)
 *      · Quién tiene acceso: cualquier usuario
 * 4) Autoriza los permisos
 * 5) Copia la URL /exec y pégala en la web: Dashboard → Configuración
 *************************************************************/

// ────────────────────────────────────────────────────────────
// ⚙️ CONFIGURACIÓN
// ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1TQof8laewXba6mSnXEvKda_45npHcTlEwHWdqptaIos'; // BD TALENTO HUMANO CorpSan
const HOJA_ACTIVOS   = 'BD PERSONAL ACTIVO';
const HOJA_INACTIVOS = 'INACTIVOS';

// Acceso preliminar — ⚠️ CAMBIA ESTAS CREDENCIALES antes del uso operativo
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// Escaneo de encabezados: busca en las primeras 12 filas la que contenga CEDULA + NOMBRE
const MAX_FILA_ENCABEZADO = 12;

const DATE_KEYS = ['fechaNac', 'ingresoReal', 'ingresoIVSS', 'fechaCese'];
const NUM_KEYS  = ['salarioSemanal', 'sueldoMensual', 'bonoAlimentacion', 'ayudaUnica', 'totalRemuneracion', 'comisiones'];

// Columnas de constancias guardadas como CASILLA de verificación en el sheet:
// SI → TRUE, NO → FALSE, NO APLICA → celda vacía (conserva la casilla).
const SINO_KEYS = [
  'cedulaFisco', 'cedulaDigital', 'cvFisco', 'cvDigital',
  'medicoFisco', 'medicoDigital', 'licenciaFisco', 'licenciaDigital',
  'rifFisco', 'rifDigital', 'certFisco', 'certDigital'
];

// Columnas que la app NUNCA escribe (n: consecutivo, edad: fórmula del sheet)
const SOLO_LECTURA = ['n', 'edad'];

// Encabezados (normalizados) que aparecen más de una vez → clave según orden de aparición
const DUPLICADOS = {
  'NOMBRE Y APELLIDO': ['nombre', 'contactoNombre'],
  'TELEFONO':          ['telefono', 'contactoTelefono'],
  'CARGO':             ['cargo', 'cargoLaboral']
};

// Diccionario encabezado normalizado → clave interna
const DICCIONARIO = (function () {
  const d = {};
  function add(key, nombres) { nombres.forEach(function (n) { d[n] = key; }); }

  add('n',              ['N', 'N°', 'NO', 'NUM', 'NUMERO']);
  add('nombre',         ['NOMBRE Y APELLIDO', 'NOMBRE', 'NOMBRE Y APELLIDOS']);
  add('estado',         ['ESTADO', 'ESTATUS', 'STATUS']);
  add('cedula',         ['CEDULA']);
  add('rif',            ['RIF']);
  add('sexo',           ['SEXO', 'GENERO']);
  add('edad',           ['EDAD']);
  add('fechaCese',      ['FECHA CESE INACTIVO', 'FECHA DE CESE', 'FECHA CESE']);
  add('fechaNac',       ['FECHA NACIM', 'FECHA DE NACIM', 'FECHA NACIMIENTO', 'FECHA DE NACIMIENTO', 'FECHA NAC']);
  add('cargo',          ['CARGO']);
  add('telefono',       ['TELEFONO', 'TELF', 'TELEFONO CONTACTO']);
  add('direccion',      ['DIRECCION HABITACION', 'DIRECCION', 'DIRECCION DE HABITACION']);
  add('correo',         ['CORREO ELECTRONICO', 'CORREO', 'EMAIL', 'E MAIL']);

  // Constancias físicas/digitales:
  //  · subencabezados FISCO/DIGITAL combinados, o
  //  · columnas con prefijo V- (física) y D- (digital) como casillas TRUE/FALSE
  add('cedulaFisco',    ['CEDULA FISCO', 'CEDULA FISICO', 'V CEDULA']);
  add('cedulaDigital',  ['CEDULA DIGITAL', 'D CEDULA']);
  add('cvFisco',        ['CURRICULUM FISCO', 'CURRICULUM FISICO', 'CURRICULUM VITAE FISCO', 'CV FISCO', 'V CURRICULUM']);
  add('cvDigital',      ['CURRICULUM DIGITAL', 'CURRICULUM VITAE DIGITAL', 'CV DIGITAL', 'D CURRICULUM']);
  add('medicoFisco',    ['CERTIFICADO MEDICO FISCO', 'CERTIFICADO MEDICO FISICO', 'V CERT MED']);
  add('medicoDigital',  ['CERTIFICADO MEDICO DIGITAL', 'D CERT MED']);
  add('licenciaFisco',  ['LICENCIA DE CONDUCIR FISCO', 'LICENCIA DE CONDUCIR FISICO', 'LICENCIA FISCO', 'LICENCIA FISICO', 'V LICENCIA']);
  add('licenciaDigital',['LICENCIA DE CONDUCIR DIGITAL', 'LICENCIA DIGITAL', 'D LICENCIA']);
  add('rifFisco',       ['RIF FISCO', 'RIF FISICO', 'V RIF']);
  add('rifDigital',     ['RIF DIGITAL', 'D RIF']);
  add('certFisco',      ['CERTIFICACION FISCO', 'CERTIFICACION FISICO', 'V CERTIFICACION']);
  add('certDigital',    ['CERTIFICACION DIGITAL', 'D CERTIFICACION']);

  add('banco',          ['BANCO', 'BANCO ASOCIADO']);
  add('nCuenta',        ['N CUENTA', 'N° CUENTA', 'N° DE CUENTA', 'NUMERO DE CUENTA', 'CUENTA']);

  add('contactoNombre', ['NOMBRE Y APELLIDO EMERGENCIA', 'CONTACTO EMERGENCIA', 'PERSONA DE CONTACTO', 'CONTACTO DE EMERGENCIA']);
  add('contactoTelefono',['TELEFONO EMERGENCIA', 'TELEFONO DE EMERGENCIA', 'TLFN EMERGENCIA', 'TLFN DE EMERGENCIA', 'TEL EMERGENCIA']);

  add('cargoLaboral',   ['CARGO LABORAL', 'CARGO FICHA LABORAL']);
  add('supervisor',     ['SUPERVISOR DIRECTO', 'SUPERVISOR']);
  add('jornada',        ['JORNADA']);
  add('tipoNomina',     ['TIPO NOMINA', 'TIPO DE NOMINA']);
  add('ingresoReal',    ['FECHA DE INGRESO REAL', 'FECHA DE INGRESO (REAL)', 'INGRESO REAL', 'FECHA DE INGRESO']);
  add('ingresoIVSS',    ['FECHA DE INGRESO IVSS', 'FECHA DE INGRESO (IVSS)', 'INGRESO IVSS']);

  add('salarioSemanal', ['SALARIO SEMANAL USD', 'SALARIO SEMANAL']);
  add('sueldoMensual',  ['SUELDO MENSUAL USD', 'SUELDO MENSUAL']);
  add('bonoAlimentacion',['BONO ALIMENTACION USD', 'BONO ALIMENTACION', 'BONO DE ALIMENTACION']);
  add('ayudaUnica',     ['AYUDA UNICA ESPECIAL USD', 'AYUDA UNICA ESPECIAL', 'AYUDA UNICA']);
  add('totalRemuneracion',['TOTAL REMUNERACION', 'TOTAL REMUNERACION USD']);
  add('comisiones',     ['COMISIONES']);
  add('bonoVacacional', ['BONO VACACIONAL']);
  add('otros',          ['OTROS']);
  add('comentarios',    ['COMENTARIOS', 'OBSERVACIONES']);

  // Validación de recibo de pago (meses)
  var meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  meses.forEach(function (m) { d[m] = 'm_' + m.toLowerCase(); });

  return d;
})();

// Claves de meses (para convertir texto a estado de casilla)
function esMes(key) { return /^m_(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)$/.test(key); }

/** Normaliza un encabezado: sin tildes, sin símbolos, un espacio. */
function normTxt(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s°]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Busca la clave de un encabezado normalizado; acepta variantes con "(USD)" etc. */
function claveDeEncabezado(norm) {
  if (DICCIONARIO[norm]) return DICCIONARIO[norm];
  // variante sin sufijos entre paréntesis ya eliminados por normTxt; probar sin "USD" final
  const sinUsd = norm.replace(/\s*USD$/, '').trim();
  if (DICCIONARIO[sinUsd]) return DICCIONARIO[sinUsd];
  // año de la tabla de recibos ("2026", "VALIDACION DE RECIBO ...")
  if (/^\d{4}$/.test(norm)) return 'reciboAnio';
  if (norm.indexOf('VALIDACION DE RECIBO') === 0) return 'reciboAnio';
  return null;
}

// ────────────────────────────────────────────────────────────
// ESTRUCTURA (se detecta en cada lectura; es barato y tolera cambios del sheet)
// ────────────────────────────────────────────────────────────
function estructura(h) {
  const ultimaCol = Math.max(1, h.getLastColumn());
  for (let f = 1; f <= MAX_FILA_ENCABEZADO; f++) {
    if (f > h.getLastRow()) break;
    const fila = h.getRange(f, 1, 1, ultimaCol).getValues()[0];
    const norms = fila.map(normTxt);
    const iCed = norms.indexOf('CEDULA');
    const iNom = norms.findIndex(function (v) { return v.indexOf('NOMBRE') === 0; });
    if (iCed === -1 || iNom === -1) continue;

    // ¿hay subencabezados FISCO / DIGITAL en la fila siguiente?
    let subFila = null;
    if (f + 1 <= h.getLastRow()) {
      const sub = h.getRange(f + 1, 1, 1, ultimaCol).getValues()[0].map(normTxt);
      const cantSub = sub.filter(function (v) { return v === 'FISCO' || v === 'FISICO' || v === 'DIGITAL'; }).length;
      if (cantSub >= 2) subFila = sub;
    }

    // Construir el mapa columna → clave
    const mapa = [];       // clave interna por columna (null si no reconocida)
    const encabezados = []; // encabezado final (con subencabezado combinado)
    const usados = {};     // contador para encabezados duplicados
    for (let j = 0; j < ultimaCol; j++) {
      let enc = norms[j];
      if (subFila) {
        const s = subFila[j];
        if (s === 'FISCO' || s === 'FISICO' || s === 'DIGITAL') enc = (enc + ' ' + (s === 'FISICO' ? 'FISCO' : s)).trim();
      }
      encabezados.push(enc);

      let clave = null;
      if (DUPLICADOS[enc]) {
        const i = usados[enc] || 0;
        clave = DUPLICADOS[enc][i] || null;
        usados[enc] = i + 1;
      } else {
        clave = claveDeEncabezado(enc);
      }
      mapa.push(clave);
    }

    return {
      headerRow: f,
      subRow: subFila ? f + 1 : null,
      dataStart: (subFila ? f + 2 : f + 1),
      mapa: mapa,
      encabezados: encabezados,
      idxCedula: mapa.indexOf('cedula'),
      idxEstado: mapa.indexOf('estado'),
      idxN: mapa.indexOf('n')
    };
  }
  throw new Error('No se encontró la fila de encabezados (buscando CEDULA + NOMBRE en las primeras ' + MAX_FILA_ENCABEZADO + ' filas).');
}

// ────────────────────────────────────────────────────────────
// PUNTOS DE ENTRADA
// ────────────────────────────────────────────────────────────
function doGet(e) {
  const a = String((e && e.parameter && e.parameter.action) || '').toLowerCase();
  try {
    if (a === 'ping')        return ok(info());
    if (a === 'login')       return ok(login(e.parameter.usuario, e.parameter.clave));
    if (a === 'list')        return ok(listar(e.parameter.hoja));
    if (a === 'pagos_list')  return ok(pagosList(e.parameter.periodo));
    return ok({ ok: false, msg: 'Acción no válida: usa ping, login, list o pagos_list' });
  } catch (err) {
    return ok({ ok: false, msg: 'Error: ' + err.message });
  }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'login')      return ok(login(b.usuario, b.clave));
    if (b.action === 'fin_list')   { finSesion(b.token); return ok(finList()); }
    if (b.action === 'fin_save')   return ok(finSave(b.token, b.data, b.permitirDuplicado));
    if (b.action === 'fin_cierre') return ok({ok:false,msg:'Genera reportes separados por Personal o Jurídico.'});
    if (b.action === 'fin_reporte') return ok(finReporte(b.token, b.seleccion));
    if (b.action === 'fin_saldo') return ok(finCorregirSaldo(b.token, b));
    if (b.action === 'th_estado') return ok(thCambiarEstado(b.token,b.hoja,b.check,b.anterior,b.estado));
    if (b.action === 'create')     return ok(crear(b.hoja, b.data));
    if (b.action === 'update')     return ok(actualizar(b.hoja, b.fila, b.check, b.data, b.data && b.data.estado !== undefined ? finSesion(b.token) : ''));
    if (b.action === 'del')        return ok(eliminar(b.hoja, b.fila, b.check));
    if (b.action === 'pagos_save') return ok(pagosSave(b.data));
    if (b.action === 'pagos_create') return ok(pagosSave(b.data, false, true));
    if (b.action === 'pagos_del')  return ok(pagosDel(b.id));
    if (b.action === 'cerrar_mes') return ok(cerrarMes(b.periodo, b.tasa));
    return ok({ ok: false, msg: 'Acción no válida' });
  } catch (err) {
    return ok({ ok: false, msg: 'Error: ' + err.message });
  }
}

// ────────────────────────────────────────────────────────────
// UTILIDADES
// ────────────────────────────────────────────────────────────
function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

/** Devuelve la pestaña a operar. Si "INACTIVOS" no existe, usa la de activos (filtra por ESTADO). */
function sh(hoja) {
  const libro = ss();
  const nombre = hoja === 'inactivos' ? HOJA_INACTIVOS : HOJA_ACTIVOS;
  const h = libro.getSheetByName(nombre);
  if (h) return h;
  if (hoja === 'inactivos') {
    const hA = libro.getSheetByName(HOJA_ACTIVOS);
    if (hA) return hA; // base unificada: se filtrará por la columna ESTADO
  }
  throw new Error('No existe la pestaña: ' + nombre);
}

/** Información de diagnóstico que muestra el panel Configuración. */
function info() {
  const h = sh('activos');
  const est = estructura(h);
  const sinMapear = [];
  est.mapa.forEach(function (k, j) { if (!k && est.encabezados[j]) sinMapear.push(est.encabezados[j]); });
  const ultima = h.getLastRow();
  let filas = 0;
  if (ultima >= est.dataStart) filas = ultima - est.dataStart + 1;
  return {
    ok: true,
    sistema: 'CorpSan Gestión v2 — Backend Apps Script (mapeo dinámico)',
    spreadsheet: SPREADSHEET_ID,
    hoja: h.getName(),
    filaEncabezados: est.headerRow,
    filaDatosDesde: est.dataStart,
    columnasDetectadas: est.mapa.length,
    columnasReconocidas: est.mapa.filter(function (k) { return k; }).length,
    columnasSinMapear: sinMapear,
    tieneColumnaEstado: est.idxEstado > -1,
    filasTotales: filas
  };
}

/** Normaliza un valor del sheet para enviarlo como JSON. */
let TH_TIMEZONE = null;
function valor(v) {
  if (v instanceof Date) {
    if (!TH_TIMEZONE) TH_TIMEZONE=ss().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, TH_TIMEZONE, 'yyyy-MM-dd');
  }
  // Casillas de verificación (TRUE/FALSE) → SI / NO
  if (v === true) return 'SI';
  if (v === false) return 'NO';
  return v === null || v === undefined ? '' : v;
}

/** Convierte un valor recibido al tipo correcto antes de escribirlo. */
function escribir(key, v) {
  if (DATE_KEYS.indexOf(key) > -1 && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    var p = String(v).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  if (NUM_KEYS.indexOf(key) > -1) {
    if (v === '' || v === null || v === undefined) return '';
    var n = Number(v);
    return isNaN(n) ? v : n;
  }
  if (esMes(key)) return v === 'X' ? 'X' : '';
  if (SINO_KEYS.indexOf(key) > -1) {
    var s = String(v || '').toUpperCase();
    if (s === 'SI') return true;            // casilla marcada
    if (s === 'NO') return false;           // casilla desmarcada
    if (s === 'NO APLICA') return 'NO APLICA'; // texto en la celda (la casilla se sustituye)
    return '';
  }
  return v;
}

/** ¿La fila (array de valores según el mapa) es del estado solicitado? */
function pasaFiltroEstado(est, filaValores, hoja) {
  if (est.idxEstado === -1) return true; // pestaña sin ESTADO: se devuelven todas
  const e = normTxt(filaValores[est.idxEstado]);
  if (hoja === 'inactivos') return e === 'INACTIVO';
  // activos: explícitamente ACTIVO o celda vacía (pestañas antiguas sin estado marcado)
  return e === 'ACTIVO' || e === '';
}

// ────────────────────────────────────────────────────────────
// OPERACIONES
// ────────────────────────────────────────────────────────────
function listar(hoja) {
  const source=['activos'];if(ss().getSheetByName(HOJA_INACTIVOS))source.push('inactivos');
  let rows=[];source.forEach(function(origin){rows=rows.concat(listarFisica(origin,hoja).data.map(function(r){r._hoja=origin;return r;}));});
  const seen={};rows=rows.filter(function(r){const estado=normTxt(r.estado||'ACTIVO');r.estado=estado;const selected=hoja==='inactivos'?'INACTIVO':'ACTIVO';if(estado!==selected)return false;const id=String(r.cedula);if(seen[id])throw new Error('Cédula duplicada entre bases de personal: '+id);seen[id]=true;return true;});
  return {ok:true,data:rows};
}
function listarFisica(hoja,estadoFiltro) {
  const h = sh(hoja);
  const est = estructura(h);
  const ultima = h.getLastRow();
  if (ultima < est.dataStart) return { ok: true, data: [], headers: est.encabezados };

  const rango = h.getRange(est.dataStart, 1, ultima - est.dataStart + 1, est.mapa.length);
  const filas = rango.getValues();
  const data = [];
  for (var i = 0; i < filas.length; i++) {
    if (!filas[i].join('')) continue; // fila totalmente vacía
    const estado=est.idxEstado<0?(hoja==='inactivos'?'INACTIVO':'ACTIVO'):normTxt(filas[i][est.idxEstado]||'ACTIVO');
    if(estadoFiltro&&estado!==(estadoFiltro==='inactivos'?'INACTIVO':'ACTIVO'))continue;
    const o = { _fila: est.dataStart + i, estado: hoja === 'inactivos' ? 'INACTIVO' : 'ACTIVO' };
    for (var j = 0; j < est.mapa.length; j++) {
      if (est.mapa[j]) o[est.mapa[j]] = valor(filas[i][j]);
    }
    data.push(o);
  }
  return { ok: true, data: data, headers: est.encabezados };
}

function crear(hoja, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const h = sh(hoja);
    const est = estructura(h);

    // N° consecutivo: máximo N° existente + 1
    let maxN = 0;
    if (est.idxN > -1 && h.getLastRow() >= est.dataStart) {
      const colN = h.getRange(est.dataStart, est.idxN + 1, h.getLastRow() - est.dataStart + 1, 1).getValues();
      colN.forEach(function (r) { const n = Number(r[0]); if (!isNaN(n) && n > maxN) maxN = n; });
    }

    const fila = est.mapa.map(function (k) {
      if (k === 'n') return maxN + 1;
      if (SOLO_LECTURA.indexOf(k) > -1) return ''; // edad: fórmula del sheet
      if (k === 'estado') return (datos && datos.estado) ? datos.estado : (hoja === 'inactivos' ? 'INACTIVO' : 'ACTIVO');
      if (k === null || datos[k] === undefined || datos[k] === null) return '';
      return escribir(k, datos[k]);
    });
    h.appendRow(fila);
    return { ok: true, msg: 'Registro creado', n: maxN + 1 };
  } finally {
    lock.releaseLock();
  }
}

function actualizar(hoja, fila, check, datos, usuario) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const h = sh(hoja);
    const est = estructura(h);
    if (est.idxCedula === -1) throw new Error('No se encontró la columna CEDULA en el sheet');

    let filaReal = Number(fila);
    const cedulaFila = String(valor(h.getRange(filaReal, est.idxCedula + 1).getValue())).trim();
    if (String(check) !== cedulaFila) {
      const encontrada = buscarFilaPorCedula(h, est, String(check));
      if (!encontrada) {
        return { ok: false, msg: 'La fila cambió en el sheet y no se encontró la cédula «' + check + '». Recarga y reintenta.' };
      }
      filaReal = encontrada;
    }

    const actual = h.getRange(filaReal, 1, 1, est.mapa.length).getValues()[0];
    const estadoAntes = est.idxEstado < 0 ? '' : normTxt(actual[est.idxEstado] || 'ACTIVO');
    if(datos.estado !== undefined && ['ACTIVO','INACTIVO'].indexOf(normTxt(datos.estado))<0) throw new Error('Estado inválido');
    est.mapa.forEach(function (k, j) {
      if (!k || SOLO_LECTURA.indexOf(k) > -1) return; // N° y Edad no se modifican
      if (datos[k] !== undefined) h.getRange(filaReal,j+1).setValue(escribir(k,k === 'estado' ? normTxt(datos[k]) : datos[k]));
    });
    if(datos.estado !== undefined && estadoAntes !== normTxt(datos.estado)) thAudit(ss(),check,estadoAntes,normTxt(datos.estado),usuario || 'No disponible','webapp',h.getName(),filaReal);
    SpreadsheetApp.flush();
    return { ok: true, msg: 'Registro actualizado', fila: filaReal };
  } finally {
    lock.releaseLock();
  }
}

function eliminar(hoja, fila, check) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const h = sh(hoja);
    const est = estructura(h);
    if (est.idxCedula === -1) throw new Error('No se encontró la columna CEDULA en el sheet');

    let filaReal = Number(fila);
    const cedulaFila = String(valor(h.getRange(filaReal, est.idxCedula + 1).getValue())).trim();
    if (String(check) !== cedulaFila) {
      const encontrada = buscarFilaPorCedula(h, est, String(check));
      if (!encontrada) {
        return { ok: false, msg: 'La fila cambió en el sheet y no se encontró la cédula «' + check + '». Recarga y reintenta.' };
      }
      filaReal = encontrada;
    }
    h.deleteRow(filaReal);
    return { ok: true, msg: 'Registro eliminado' };
  } finally {
    lock.releaseLock();
  }
}

function buscarFilaPorCedula(h, est, cedula) {
  const ultima = h.getLastRow();
  if (ultima < est.dataStart || !cedula) return null;
  const col = h.getRange(est.dataStart, est.idxCedula + 1, ultima - est.dataStart + 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(valor(col[i][0])).trim() === cedula) return est.dataStart + i;
  }
  return null;
}

function login(usuario, clave) {
  if (
    String(usuario || '').toLowerCase() === ADMIN_USER.toLowerCase() &&
    String(clave || '') === ADMIN_PASS
  ) {
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('fin_' + token, ADMIN_USER, 21600);
    return { ok: true, usuario: ADMIN_USER, nombre: 'Gerencia General', rol: 'Administrador', token: token };
  }
  return { ok: false, msg: 'Credenciales inválidas' };
}

// ════════════════════════════════════════════════════════════
// NÓMINA Y PAGOS — pestaña PAGOS (formato largo: una fila por trabajador/mes)
// Fórmulas replicadas 1:1 de la plantilla de recibos de CorpSan.
// La tasa BCV se congela dentro de cada fila: el histórico nunca se recalcula.
// ════════════════════════════════════════════════════════════

const HOJA_PAGOS = 'PAGOS';

// Entradas + snapshot del trabajador + resultados calculados (guardados como valores)
const PAGOS_HEADERS = [
  'ID', 'Periodo', 'Cedula', 'Nombre', 'Cargo', 'FechaIngreso', 'Banco', 'Cuenta', 'Estado',
  'TasaBCV', 'Dias', 'Lunes', 'SalarioIntegralUSD',
  'PctSueldo', 'PctDisp', 'PctResp', 'PctRepr', 'PctAntig',
  'BonoLimpieza', 'BonoPuntual', 'BonoMovilidad', 'BonoCoordin', 'BonoProductiv',
  'PctCestaticket', 'AsistencialUSD',
  'PctIVSS', 'PctParo', 'PctFAOV', 'PctISLR', 'AnticiposBs',
  'SueldoBasicoUSD', 'TotalA_USD', 'TotalB_USD', 'CestaticketUSD', 'TotalC_USD',
  'TotalDeduccBs', 'NetoBs', 'NetoUSD', 'Actualizado',
  'Origen', 'Fuente', 'CalculoHistorico', 'Observaciones', 'InicioPeriodo', 'FinPeriodo'
];

// Valores por defecto según la plantilla (primas como % del salario integral)
const PAGOS_DEFAULTS = {
  PctSueldo: 0.2, PctDisp: 0.1, PctResp: 0.15, PctRepr: 0, PctAntig: 0.08,
  BonoLimpieza: 0, BonoPuntual: 0, BonoMovilidad: 0, BonoCoordin: 0, BonoProductiv: 0,
  PctCestaticket: 0.2, AsistencialUSD: 0,
  PctIVSS: 0.04, PctParo: 0.005, PctFAOV: 0.01, PctISLR: 0.1232, AnticiposBs: 0
};

function r2(v) { return Math.round(Number(v) * 100) / 100; }

/** Días del mes y cantidad de lunes (para IVSS), desde "YYYY-MM". */
function diasYlunes(periodo) {
  const y = Number(String(periodo).slice(0, 4));
  const m = Number(String(periodo).slice(5, 7));
  if (!y || !m) return { dias: 0, lunes: 0 };
  const dias = new Date(y, m, 0).getDate();
  let lunes = 0;
  for (let d = 1; d <= dias; d++) {
    if (new Date(y, m - 1, d).getDay() === 1) lunes++;
  }
  return { dias: dias, lunes: lunes };
}

/**
 * Cálculo de nómina — FÓRMULAS INVARIABLES de la plantilla:
 *  · Asignaciones: % del salario integral mensual USD (sueldo 20%, primas por fila)
 *  · Bonos: montos USD manuales (sección B; tabla de % de gerencia queda fuera)
 *  · No salariales: cestaticket % + asistencial
 *  · Deducciones (Bs, sobre el sueldo básico): IVSS (Bs×12/52×%×lunes), paro, FAOV, ISLR, anticipos
 *  · Neto Bs = (A + B + C) × tasa − deducciones
 */
function calcNomina(p) {
  function g(k, def) { const v = Number(p[k]); return isNaN(v) ? (def || 0) : v; }
  const dl = diasYlunes(p.Periodo);
  const tasa = g('TasaBCV') || 0;
  const si = g('SalarioIntegralUSD');

  const sueldo = si * g('PctSueldo');
  const disp = si * g('PctDisp');
  const resp = si * g('PctResp');
  const repr = si * g('PctRepr');
  const antig = si * g('PctAntig');
  const totalA = sueldo + disp + resp + repr + antig;

  const totalB = g('BonoLimpieza') + g('BonoPuntual') + g('BonoMovilidad') + g('BonoCoordin') + g('BonoProductiv');

  const cesta = si * g('PctCestaticket');
  const totalC = cesta + g('AsistencialUSD');

  const sueldoBs = sueldo * tasa;
  const ivssBs = (sueldoBs * 12 / 52) * g('PctIVSS') * dl.lunes;
  const paroBs = sueldoBs * g('PctParo');
  const faovBs = sueldoBs * g('PctFAOV');
  const islrBs = sueldoBs * g('PctISLR');
  const antBs = g('AnticiposBs');
  const deducc = ivssBs + paroBs + faovBs + islrBs + antBs;

  const netoBs = (totalA + totalB + totalC) * tasa - deducc;

  return {
    Dias: dl.dias, Lunes: dl.lunes,
    SueldoBasicoUSD: r2(sueldo),
    TotalA_USD: r2(totalA),
    TotalB_USD: r2(totalB),
    CestaticketUSD: r2(cesta),
    TotalC_USD: r2(totalC),
    TotalDeduccBs: r2(deducc),
    NetoBs: r2(netoBs),
    NetoUSD: tasa ? r2(netoBs / tasa) : 0
  };
}

function pagosSh() {
  const h = ss().getSheetByName(HOJA_PAGOS);
  if (h) {
    const existentes = h.getRange(1, 1, 1, Math.min(h.getMaxColumns(), PAGOS_HEADERS.length)).getValues()[0];
    existentes.forEach(function (nombre, i) {
      if (nombre && nombre !== PAGOS_HEADERS[i]) throw new Error('Encabezado PAGOS inesperado en columna ' + (i + 1));
    });
    if (h.getMaxColumns() < PAGOS_HEADERS.length) h.insertColumnsAfter(h.getMaxColumns(), PAGOS_HEADERS.length - h.getMaxColumns());
    h.getRange(1, 1, 1, PAGOS_HEADERS.length).setValues([PAGOS_HEADERS]);
    return h;
  }
  const nueva = ss().insertSheet(HOJA_PAGOS);
  nueva.getRange(1, 1, 1, PAGOS_HEADERS.length).setValues([PAGOS_HEADERS]);
  nueva.setFrozenRows(1);
  return nueva;
}

function pagosList(periodo) {
  const h = pagosSh();
  const ultima = h.getLastRow();
  if (ultima < 2) return { ok: true, data: [] };
  const vals = h.getRange(2, 1, ultima - 1, PAGOS_HEADERS.length).getValues();
  const data = [];
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i].join('')) continue;
    const o = {};
    for (var j = 0; j < PAGOS_HEADERS.length; j++) o[PAGOS_HEADERS[j]] = valor(vals[i][j]);
    if (periodo && String(o.Periodo) !== String(periodo)) continue;
    data.push(o);
  }
  return { ok: true, data: data };
}

/** Crea o actualiza un pago (por ID determinista periodo+cedula) y recalcula totales. */
function pagosSave(datos, lockAdquirido, crearSolo) {
  const lock = LockService.getScriptLock();
  if (!lockAdquirido) lock.waitLock(10000);
  try {
    const h = pagosSh();
    if (!datos.Periodo || !datos.Cedula) return { ok: false, msg: 'Faltan Periodo o Cedula' };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(datos.Periodo))) return { ok: false, msg: 'Período inválido' };
    if (!Number.isFinite(Number(datos.TasaBCV)) || Number(datos.TasaBCV) <= 0) return { ok: false, msg: 'Indica una tasa BCV positiva' };
    if (datos.Origen === 'Historico Excel') return { ok: false, msg: 'Los históricos originales no se recalculan desde el editor' };

    const id = 'PG-' + String(datos.Periodo).replace('-', '') + '-' + String(datos.Cedula).trim();
    const calc = calcNomina(datos);
    const fila = PAGOS_HEADERS.map(function (k) {
      if (k === 'ID') return id;
      if (k === 'Estado') return datos.Estado || 'Calculado';
      if (calc[k] !== undefined) return calc[k];
      if (k === 'Actualizado') return new Date();
      const v = datos[k];
      return v === undefined || v === null ? '' : v;
    });

    // localizar fila existente por ID
    const ultima = h.getLastRow();
    let filaReal = 0;
    if (ultima >= 2) {
      const ids = h.getRange(2, 1, ultima - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === id) { filaReal = 2 + i; break; }
      }
    }
    if (filaReal) {
      if (crearSolo) return { ok: false, msg: 'Ya existe un pago para este trabajador y período. Abre el registro existente para consultarlo o editarlo.' };
      if (h.getRange(filaReal, PAGOS_HEADERS.indexOf('Origen') + 1).getValue() === 'Historico Excel') {
        return { ok: false, msg: 'El registro es un histórico original y no puede sobrescribirse desde el editor' };
      }
    }
    if (crearSolo) {
      const personas = listar('activos').data.concat(listar('inactivos').data);
      if (!personas.some(function (p) { return String(p.cedula).trim() === String(datos.Cedula).trim(); })) {
        return { ok: false, msg: 'El trabajador no existe en Talento Humano' };
      }
      if (!Number.isFinite(Number(datos.SalarioIntegralUSD)) || Number(datos.SalarioIntegralUSD) < 0) return { ok: false, msg: 'Salario integral inválido' };
    }
    // La cédula vincula la ficha actual, sin repetir datos maestros en cada pago.
    const th = sh('activos');
    const est = estructura(th);
    const letras = function (indice) {
      let s = ''; let n = indice + 1;
      while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
      return s;
    };
    const hoja = "'" + th.getName().replace(/'/g, "''") + "'!";
    const ced = letras(est.idxCedula);
    const destino = filaReal || ultima + 1;
    [['Nombre','nombre'],['Cargo','cargo'],['FechaIngreso','ingresoReal'],['Banco','banco'],['Cuenta','nCuenta']].forEach(function (par) {
      const idx = est.mapa.indexOf(par[1]);
      if (idx < 0) { fila[PAGOS_HEADERS.indexOf(par[0])] = ''; return; }
      const col = letras(idx);
      fila[PAGOS_HEADERS.indexOf(par[0])] = '=IFERROR(INDEX(' + hoja + col + ':' + col + ',MATCH(VALUE($C' + destino + '),' + hoja + ced + ':' + ced + ',0)),"SIN VINCULO")';
    });
    if (filaReal) {
      h.getRange(filaReal, 1, 1, PAGOS_HEADERS.length).setValues([fila]);
    } else {
      h.appendRow(fila);
    }
    h.getRange(destino, PAGOS_HEADERS.indexOf('FechaIngreso') + 1).setNumberFormat('yyyy-mm-dd');
    return { ok: true, msg: 'Pago guardado', id: id, calc: calc };
  } finally {
    if (!lockAdquirido) lock.releaseLock();
  }
}

function pagosDel(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const h = pagosSh();
    const ultima = h.getLastRow();
    if (ultima < 2) return { ok: false, msg: 'No hay pagos registrados' };
    const ids = h.getRange(2, 1, ultima - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        h.deleteRow(2 + i);
        return { ok: true, msg: 'Pago eliminado' };
      }
    }
    return { ok: false, msg: 'ID no encontrado: ' + id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cierra un mes: crea una fila de pago por cada trabajador ACTIVO del Talento Humano
 * con salario y datos en snapshot. No duplica pagos ya existentes del período.
 */
function cerrarMes(periodo, tasa) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!periodo || !Number(tasa)) return { ok: false, msg: 'Indica el período (YYYY-MM) y la tasa BCV' };

    const existentes = {};
    const actuales = pagosList(periodo).data;
    actuales.forEach(function (p) { existentes[String(p.Cedula).trim()] = true; });

    const activos = listar('activos').data;
    let creados = 0, omitidos = 0;
    for (var i = 0; i < activos.length; i++) {
      const a = activos[i];
      const cedula = String(a.cedula || '').trim();
      if (!cedula || existentes[cedula]) { if (cedula) omitidos++; continue; }

      const integral = Number(a.totalRemuneracion) ||
        (Number(a.sueldoMensual) || 0) + (Number(a.bonoAlimentacion) || 0) + (Number(a.ayudaUnica) || 0);

      const datos = {
        Periodo: periodo,
        Cedula: cedula,
        Nombre: a.nombre || '',
        Cargo: a.cargo || a.cargoLaboral || '',
        FechaIngreso: a.ingresoReal || '',
        Banco: a.banco || '',
        Cuenta: a.nCuenta || '',
        Estado: 'Calculado',
        TasaBCV: Number(tasa),
        SalarioIntegralUSD: integral
      };
      Object.keys(PAGOS_DEFAULTS).forEach(function (k) {
        if (datos[k] === undefined) datos[k] = PAGOS_DEFAULTS[k];
      });
      const resultado = pagosSave(datos, true);
      if (!resultado.ok) throw new Error(resultado.msg);
      creados++;
    }
    return { ok: true, msg: 'Mes cerrado: ' + creados + ' pagos creados, ' + omitidos + ' omitidos (ya existían o sin cédula)', creados: creados };
  } finally {
    lock.releaseLock();
  }
}

// FINANZAS v1 — acceso autenticado, histórico conservado y bitácora.
const FIN_HEADERS = ['ID','Fecha','Cuenta','Tipo','Monto','Referencia','Concepto','Contraparte','Metodo','Factura','Codigo','Conciliado','Origen','Fuente','Revision','TraspasoID','Actualizado'];
function finSesion(token) {
  const usuario = token && CacheService.getScriptCache().get('fin_' + String(token));
  if (!usuario) throw new Error('La sesión financiera venció. Vuelve a iniciar sesión.');
  return usuario;
}
function finTabla(nombre) {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(nombre);
  if (!hoja) throw new Error('Falta preparar la pestaña ' + nombre);
  const values = hoja.getDataRange().getValues();
  const headers = values.shift().map(String);
  return { hoja: hoja, headers: headers, rows: values.filter(function(r) { return r[0] !== ''; }).map(function(r) {
    const o = {}; headers.forEach(function(h,i) { o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'America/Caracas', 'yyyy-MM-dd') : r[i]; }); return o;
  }) };
}
function finList() {
  const control = {}; finTabla('FIN_CONTROL').rows.forEach(function(r) { control[r.Parametro] = r.Valor; });
  const movimientos = finTabla('FIN_MOVIMIENTOS').rows.map(function(r) { r.Codigo = String(r.Codigo || ''); r.Referencia = String(r.Referencia || ''); return r; });
  const categorias = finTabla('FIN_CATEGORIAS').rows.map(function(r) { r.Codigo = String(r.Codigo); return r; });
  if(ss().getSheetByName('FIN_METODOS_ORIGINALES')){const originales=finTabla('FIN_METODOS_ORIGINALES').rows;movimientos.forEach(function(r){const original=originales.find(function(o){return o.ID===r.ID;});if(original)r.MetodoOriginal=original.Metodo;});}
  const ajustesSheet=ss().getSheetByName('FIN_AJUSTES_SALDO');
  const ajustes=ajustesSheet ? finTabla('FIN_AJUSTES_SALDO').rows.map(function(a){return {ID:a.ID,Cuenta:a.Cuenta,Periodo:a.Periodo,Valor:Number(a.Valor),Oficial:a.Oficial,Usuario:a.Usuario,Fecha:a.Fecha,Motivo:a.Motivo,Anterior:a.Anterior};}) : [];
  return { ok: true, movimientos: movimientos, cuentas: finTabla('FIN_CUENTAS').rows, categorias: categorias, control: control, ajustes:ajustes };
}
function finSave(token, input, permitirDuplicado) {
  const usuario = finSesion(token);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const t = finTabla('FIN_MOVIMIENTOS');
    if (t.headers.join('|') !== FIN_HEADERS.join('|')) throw new Error('Encabezados financieros incompatibles');
    input = input || {};
    const idx = input.ID ? t.rows.findIndex(function(r) { return r.ID === input.ID; }) : -1;
    if (input.ID && idx < 0) throw new Error('El movimiento ya no existe');
    const anterior = idx < 0 ? null : t.rows[idx];
    const historico = anterior && anterior.Origen !== 'WebApp';
    const row = historico ? Object.assign({}, anterior) : {};
    if (!historico) {
      ['Fecha','Cuenta','Tipo','Referencia','Concepto','Contraparte','Metodo','Factura','Conciliado','TraspasoID'].forEach(function(k) { row[k] = String(input[k] || '').trim(); });
      row.Monto = Math.round(Number(input.Monto) * 1e6) / 1e6;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.Fecha) || isNaN(new Date(row.Fecha + 'T12:00:00Z').getTime()) || new Date(row.Fecha + 'T12:00:00Z').toISOString().slice(0,10) !== row.Fecha) throw new Error('Fecha inválida');
      const control = finTabla('FIN_CONTROL').rows;
      const inicio = control.find(function(r) { return r.Parametro === 'FechaSaldoInicial'; });
      if (inicio && row.Fecha < String(inicio.Valor)) throw new Error('La fecha es anterior al inicio del control financiero');
      const cuenta=finTabla('FIN_CUENTAS').rows.find(function(c) { return c.Cuenta === row.Cuenta; });
      if (!cuenta || !cuenta.Banco || !accountKind(cuenta)) throw new Error('Completa banco y tipo de cuenta');
      if (['ENTRADA','SALIDA'].indexOf(row.Tipo) < 0 || !isFinite(row.Monto) || row.Monto <= 0 || !row.Concepto) throw new Error('Completa concepto, tipo e importe mayor a cero');
      if (['Pendiente','Sí','No'].indexOf(row.Conciliado) < 0) throw new Error('Estado de conciliación inválido');
      row.ID = anterior ? anterior.ID : 'FIN-' + Utilities.getUuid();
      row.Origen = 'WebApp'; row.Fuente = anterior ? anterior.Fuente : 'Registro manual';
      if (!permitirDuplicado && t.rows.some(function(r) { return r.ID !== row.ID && r.Fecha === row.Fecha && r.Cuenta === row.Cuenta && r.Tipo === row.Tipo && Number(r.Monto) === row.Monto && String(r.Referencia) === row.Referencia; })) return { ok: false, duplicado: true, msg: 'Existe un movimiento con la misma fecha, cuenta, referencia e importe. Revisa antes de repetirlo.' };
    }
    // Permite conciliar y corregir el método de históricos sin cambiar sus importes.
    row.Metodo=String(input.Metodo === undefined ? row.Metodo : input.Metodo).trim();
    row.Conciliado=String(input.Conciliado === undefined ? row.Conciliado : input.Conciliado);
    if(['Pendiente','Sí','No'].indexOf(row.Conciliado)<0 && row.Conciliado !== (anterior && anterior.Conciliado)) throw new Error('Estado de conciliación inválido');
    if (anterior && row.Metodo !== anterior.Metodo) {
      const originalSheet=rfTable('FIN_METODOS_ORIGINALES',['ID','Metodo']);
      if(!finTabla('FIN_METODOS_ORIGINALES').rows.some(function(r){return r.ID===anterior.ID;}))originalSheet.appendRow([anterior.ID,rfLiteral(anterior.Metodo)]);
    }
    row.Codigo = String(input.Codigo || '').trim(); row.Revision = String(input.Revision || '').trim();
    if (row.Codigo && !finTabla('FIN_CATEGORIAS').rows.some(function(c) { return String(c.Codigo) === row.Codigo && c.Tipo === row.Tipo; })) throw new Error('El código no corresponde al tipo de movimiento');
    row.Actualizado = new Date().toISOString();
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let audit = book.getSheetByName('FIN_BITACORA');
    if (!audit) { audit = book.insertSheet('FIN_BITACORA'); audit.appendRow(['Fecha','Usuario','Accion','ID','Antes','Despues']); }
    // Los textos se escriben como literales, nunca como fórmulas introducidas desde un formulario.
    const literal = function(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; };
    const values = FIN_HEADERS.map(function(k) { return literal(row[k] == null ? '' : row[k]); });
    const target = idx < 0 ? t.hoja.getLastRow() + 1 : idx + 2;
    t.hoja.getRange(target,1,1,FIN_HEADERS.length).setValues([values]);
    audit.appendRow([row.Actualizado,usuario,anterior ? 'ACTUALIZAR' : 'CREAR',row.ID,JSON.stringify(anterior),JSON.stringify(row)]);
    SpreadsheetApp.flush();
    if(ss().getSheetByName('FIN_AJUSTES_SALDO')) finPersistirSaldos(row.Cuenta,finList(),usuario);
    return { ok: true, data: row };
  } finally { lock.releaseLock(); }
}

// Una copia mensual por período. Nunca se recalcula ni sobrescribe al descargarla otra vez.
// El mismo bloqueo que finSave evita capturar un movimiento a medio guardar.
function finCierre(token, periodo) {
  const usuario = finSesion(token);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo))) throw new Error('Mes inválido');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let hoja = book.getSheetByName('FIN_CIERRES');
    if (hoja) {
      const partes = finTabla('FIN_CIERRES').rows.filter(function(r) { return r.Periodo === periodo; }).sort(function(a,b) { return Number(a.Parte) - Number(b.Parte); });
      if (partes.length) {
        if (partes.length !== Number(partes[0].Partes) || partes.some(function(r,i) { return Number(r.Parte) !== i + 1 || Number(r.Partes) !== partes.length; })) throw new Error('La copia mensual está incompleta. Solicita revisión; no se sobrescribirá.');
        return { ok: true, cierre: JSON.parse(partes.map(function(r) { return JSON.parse(r.Contenido); }).join('')), existente: true };
      }
    }
    const data = finList();
    const desde = periodo + '-01';
    const fin = new Date(Date.UTC(Number(periodo.slice(0,4)), Number(periodo.slice(5,7)), 0, 12)).toISOString().slice(0,10);
    const hoy = Utilities.formatDate(new Date(), 'America/Caracas', 'yyyy-MM-dd');
    if (desde < String(data.control.FechaSaldoInicial) || fin > String(data.control.CorteHistorico) || fin >= hoy) throw new Error('Solo se generan documentos de meses completos dentro del corte validado. El mes en curso no está cerrado.');
    const round = function(n) { return Math.round((n + Number.EPSILON) * 1e6) / 1e6; };
    const saldoAnterior = function(cuentas) {
      let inicial;
      if (cuentas.length === data.cuentas.length && data.control.SaldoInicialGlobal !== '' && data.control.SaldoInicialGlobal !== undefined) inicial = Number(data.control.SaldoInicialGlobal);
      else {
        const elegidas = data.cuentas.filter(function(c) { return cuentas.indexOf(c.Cuenta) >= 0; });
        if (!elegidas.length || elegidas.some(function(c) { return c.SaldoInicial === '' || !Number.isFinite(Number(c.SaldoInicial)) || c.FechaSaldoInicial !== data.control.FechaSaldoInicial; })) return '';
        inicial = elegidas.reduce(function(n,c) { return round(n + Number(c.SaldoInicial)); }, 0);
      }
      if (!Number.isFinite(inicial)) return '';
      let entradas = 0, salidas = 0;
      data.movimientos.filter(function(r) { return cuentas.indexOf(r.Cuenta) >= 0 && r.Fecha >= String(data.control.FechaSaldoInicial) && r.Fecha < desde; }).forEach(function(r) {
        if (!Number.isFinite(Number(r.Monto)) || ['ENTRADA','SALIDA'].indexOf(r.Tipo) < 0) throw new Error('Movimiento financiero inválido: ' + r.ID);
        if (r.Tipo === 'ENTRADA') entradas = round(entradas + Number(r.Monto)); else salidas = round(salidas + Number(r.Monto));
      });
      return round(inicial + round(entradas - salidas));
    };
    const copia = { version: 1, periodo: periodo, creado: new Date().toISOString(), usuario: usuario, data: {
      movimientos: data.movimientos.filter(function(r) { return r.Fecha >= desde && r.Fecha <= fin; }),
      cuentas: data.cuentas.map(function(c) { return Object.assign({}, c, { SaldoInicial: saldoAnterior([c.Cuenta]), FechaSaldoInicial: desde }); }),
      categorias: data.categorias,
      control: Object.assign({}, data.control, { SaldoInicialGlobal: saldoAnterior(data.cuentas.map(function(c) { return c.Cuenta; })), FechaSaldoInicial: desde, CorteHistorico: fin })
    } };
    const json = JSON.stringify(copia), chunks = [];
    // Las celdas de Sheets admiten 50.000 caracteres; las partes conservan el JSON completo.
    for (let i = 0; i < json.length; i += 30000) chunks.push(json.slice(i, i + 30000));
    if (!hoja) { hoja = book.insertSheet('FIN_CIERRES'); hoja.appendRow(['Periodo','Creado','Usuario','Parte','Partes','Contenido']); hoja.setFrozenRows(1); }
    const values = chunks.map(function(s,i) { return [periodo,copia.creado,usuario,i+1,chunks.length,JSON.stringify(s)]; });
    const inicio = hoja.getLastRow() + 1, ultima = inicio + values.length - 1;
    if (ultima > hoja.getMaxRows()) hoja.insertRowsAfter(hoja.getMaxRows(), ultima - hoja.getMaxRows());
    // Cada fragmento codificado empieza por comillas: nunca se interpreta como fórmula.
    hoja.getRange(inicio,1,values.length,6).setNumberFormat('@').setValues(values);
    SpreadsheetApp.flush();
    return { ok: true, cierre: copia, existente: false };
  } finally { lock.releaseLock(); }
}

// BEGIN RF FEATURES
// Nuevos flujos. scripts/sync-domain.cjs los integra en Code.gs para una sola publicación.
function rfToday() { return Utilities.formatDate(new Date(),'America/Caracas','yyyy-MM-dd'); }
function rfTable(name,headers) { const book=ss(); let sheet=book.getSheetByName(name); if(!sheet){sheet=book.insertSheet(name);sheet.appendRow(headers);sheet.setFrozenRows(1);} else if(sheet.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|')) throw new Error('Encabezados incompatibles: '+name); return sheet; }
function rfLiteral(v) { return typeof v==='string' && /^[=+\-@]/.test(v) ? "'"+v : v; }
function thAudit(book,cedula,antes,despues,usuario,origen,hoja,fila) {
  let audit=book.getSheetByName('TH_BITACORA'); if(!audit){audit=book.insertSheet('TH_BITACORA');audit.appendRow(['Fecha','Usuario','Cedula','Anterior','Nuevo','Origen','Hoja','Fila']);}
  audit.appendRow([new Date().toISOString(),usuario,String(cedula),antes,despues,origen,hoja,fila].map(rfLiteral));
  thShadowSet(book,hoja,cedula,despues);
}
function thShadowSet(book,hoja,cedula,estado) {
  let shadow=book.getSheetByName('TH_ESTADOS'); if(!shadow){shadow=book.insertSheet('TH_ESTADOS');shadow.appendRow(['Hoja','Cedula','Estado']);}
  const values=shadow.getDataRange().getValues(); const idx=values.findIndex(function(r,i){return i>0&&r[0]===hoja&&String(r[1])===String(cedula);});
  if(idx<0) shadow.appendRow([hoja,String(cedula),estado]); else shadow.getRange(idx+1,3).setValue(estado);
}
function thCambiarEstado(token,hoja,cedula,anterior,nuevo) {
  const usuario=finSesion(token), lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    nuevo=normTxt(nuevo);if(['ACTIVO','INACTIVO'].indexOf(nuevo)<0)throw new Error('Estado inválido');
    const h=sh(hoja),est=estructura(h),fila=buscarFilaPorCedula(h,est,String(cedula));
    if(!fila)throw new Error('Empleado no encontrado. Sincroniza nuevamente.');
    if(est.idxEstado<0)throw new Error('La base requiere una columna ESTADO para conservar la fila y sus fórmulas.');
    const antes=normTxt(h.getRange(fila,est.idxEstado+1).getValue()||'ACTIVO');
    if(antes!==normTxt(anterior))throw new Error('El estado cambió desde otra sesión. Actualiza antes de continuar.');
    // En el piloto la base es unificada. No se mueve ni elimina ninguna fila.
    if(antes===nuevo)return {ok:true,estado:nuevo};
    h.getRange(fila,est.idxEstado+1).setValue(nuevo);thAudit(ss(),cedula,antes,nuevo,usuario,'webapp',h.getName(),fila);SpreadsheetApp.flush();
    return {ok:true,estado:nuevo};
  }finally{lock.releaseLock();}
}
// Instalar una sola vez desde Apps Script. Inicializa el estado anterior para pegados de varias celdas.
function prepararRF20261029() {
  const book=ss();
  [HOJA_ACTIVOS,HOJA_INACTIVOS].forEach(function(name){const h=book.getSheetByName(name);if(!h)return;const est=estructura(h);if(est.idxEstado<0)throw new Error('Falta ESTADO en '+name);if(h.getLastRow()<est.dataStart)return;h.getRange(est.dataStart,1,h.getLastRow()-est.dataStart+1,est.mapa.length).getValues().forEach(function(r){if(r[est.idxCedula])thShadowSet(book,name,String(r[est.idxCedula]),normTxt(r[est.idxEstado]||'ACTIVO'));});});
}
// Disparador simple del archivo vinculado: no amplía permisos ni crea credenciales.
function onEdit(e) { auditarEstadoSheet(e); }
function auditarEstadoSheet(e) {
  if(!e||!e.range)return;
  const h=e.range.getSheet(),name=h.getName();if([HOJA_ACTIVOS,HOJA_INACTIVOS].indexOf(name)<0)return;
  const est=estructura(h),col=est.idxEstado+1;if(col<1||e.range.getColumn()>col||e.range.getLastColumn()<col)return;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const book=e.source,shadow=book.getSheetByName('TH_ESTADOS'),values=shadow?shadow.getDataRange().getValues():[];
    const usuario=e.user&&e.user.getEmail?e.user.getEmail():'';
    for(let fila=Math.max(est.dataStart,e.range.getRow());fila<=e.range.getLastRow();fila++){
      const cedula=String(h.getRange(fila,est.idxCedula+1).getValue()),nuevo=normTxt(h.getRange(fila,col).getValue()||'ACTIVO');if(!cedula)continue;
      const baseline=values.find(function(r){return r[0]===name&&String(r[1])===cedula;});
      const antes=e.range.getNumRows()===1&&e.range.getNumColumns()===1&&e.oldValue!==undefined?normTxt(e.oldValue||'ACTIVO'):baseline?String(baseline[2]):'No disponible';
      if(antes!==nuevo)thAudit(book,cedula,antes,nuevo,usuario||'No disponible (Google)', 'sheet',name,fila);
    }
  }finally{lock.releaseLock();}
}
const RF_BALANCE_HEADERS=['ID','Cuenta','Periodo','Valor','Oficial','Anterior','Fecha','Usuario','Motivo','RevisionAnterior'];
const RF_MONTH_HEADERS=['Cuenta','Periodo','SaldoInicial','Ingresos','Egresos','SaldoFinal','Oficial','Actualizado','Usuario'];
function finPersistirSaldos(account,data,usuario) {
  // Tabla nueva derivada de movimientos y ajustes. Las fuentes originales no se sobreescriben.
  const sheet=rfTable('FIN_SALDOS',RF_MONTH_HEADERS),current=finTabla('FIN_SALDOS').rows.filter(function(r){return r.Cuenta!==account;});
  const rows=accountMonths(data,account,rfToday()).map(function(m){return {Cuenta:account,Periodo:m.periodo,SaldoInicial:m.inicial===null?'':m.inicial,Ingresos:m.entradas,Egresos:m.salidas,SaldoFinal:m.final===null?'':m.final,Oficial:m.oficial===null?'':m.oficial,Actualizado:new Date().toISOString(),Usuario:usuario};});
  const all=current.concat(rows).map(function(r){return RF_MONTH_HEADERS.map(function(h){return rfLiteral(r[h]===undefined?'':r[h]);});});
  if(all.length){if(all.length+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),all.length+1-sheet.getMaxRows());sheet.getRange(2,1,all.length,RF_MONTH_HEADERS.length).setValues(all);}
  // Cada cuenta conserva el mismo inicio y el número de meses solo crece; no se borran registros fuente.
}
function finCorregirSaldo(token,b) {
  const usuario=finSesion(token),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const data=finList(),preview=balancePreview(data,b.cuenta,b.periodo,b.valor,b.oficial,rfToday(),String(b.motivo||''));
    if(!b.confirmar)return {ok:true,preview:preview};
    if(b.revision!==preview.revision||Number(b.meses)!==preview.afectados.length)throw new Error('Los datos cambiaron. Revisa una nueva vista previa antes de confirmar.');
    const sheet=rfTable('FIN_AJUSTES_SALDO',RF_BALANCE_HEADERS),edit=Object.assign({},preview.edit,{ID:'SAL-'+Utilities.getUuid(),Fecha:new Date().toISOString(),Usuario:usuario,Anterior:preview.anterior===null?'':preview.anterior,RevisionAnterior:preview.revision});
    sheet.getRange(sheet.getLastRow()+1,1,1,RF_BALANCE_HEADERS.length).setNumberFormat('@').setValues([RF_BALANCE_HEADERS.map(function(k){return rfLiteral(edit[k]);})]);
    const updated=finList();finPersistirSaldos(b.cuenta,updated,usuario);SpreadsheetApp.flush();
    return {ok:true,preview:preview,data:updated};
  }finally{lock.releaseLock();}
}
function finReporte(token,request) {
  const usuario=finSesion(token),lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const data=reportData(finList(),request,rfToday());
    const copy={version:2,periodo:request.desde+'_'+request.hasta,creado:new Date().toISOString(),usuario:usuario,seleccion:request,data:data};
    // Una nueva revisión separada por tipo. Las copias antiguas de FIN_CIERRES permanecen intactas.
    const sheet=rfTable('FIN_REPORTES',['ID','Creado','Usuario','Tipo','Desde','Hasta','Parte','Partes','Contenido']),json=JSON.stringify(copy),chunks=[];
    for(let i=0;i<json.length;i+=30000)chunks.push(json.slice(i,i+30000));
    const id='REP-'+Utilities.getUuid(),rows=chunks.map(function(s,i){return [id,copy.creado,usuario,request.tipo,request.desde,request.hasta,i+1,chunks.length,JSON.stringify(s)];});
    const start=sheet.getLastRow()+1;if(start+rows.length-1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),start+rows.length-1-sheet.getMaxRows());
    sheet.getRange(start,1,rows.length,9).setNumberFormat('@').setValues(rows);SpreadsheetApp.flush();return {ok:true,cierre:copy};
  }finally{lock.releaseLock();}
}

// BEGIN SHARED BUSINESS DOMAIN
// Fuente compartida con Apps Script mediante scripts/sync-domain.cjs.
function civilDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error('Fecha inválida');
    const d = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
        throw new Error('Fecha inválida');
    return d;
}
function shiftDay(value, days) { const d = civilDate(value); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function firstBusinessSaturday(year) { const jan = `${year}-01-01`; return shiftDay(jan, (6 - civilDate(jan).getUTCDay() + 7) % 7); }
function getBusinessWeek(fecha) {
    const start = shiftDay(fecha, -((civilDate(fecha).getUTCDay() + 1) % 7));
    let year = civilDate(fecha).getUTCFullYear();
    if (start < firstBusinessSaturday(year))
        year--;
    const numeroSemana = 1 + Math.round((civilDate(start).getTime() - civilDate(firstBusinessSaturday(year)).getTime()) / 604800000);
    return { numeroSemana, fechaInicio: start, fechaFin: shiftDay(start, 6), año: year };
}
function getRangoSemana(year, week) {
    if (!Number.isInteger(year) || year < 1900 || year > 9998 || !Number.isInteger(week) || week < 1)
        throw new Error('Semana inválida');
    const start = shiftDay(firstBusinessSaturday(year), (week - 1) * 7);
    if (start >= firstBusinessSaturday(year + 1))
        throw new Error('Semana inexistente en ese año');
    return getBusinessWeek(start);
}
function businessWeekLabel(fecha) { const w = getBusinessWeek(fecha), short = (s) => s.slice(8) + '/' + s.slice(5, 7); return `Semana ${w.numeroSemana} (${short(w.fechaInicio)} – ${short(w.fechaFin)})`; }
const PAYMENT_METHODS = ['Transferencia', 'Pago Móvil', 'Tarjeta de Débito', 'Biopago', 'Efectivo', 'Cheque', 'Otro'];
function normalizedText(v) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
function paymentMethod(v) {
    const n = normalizedText(v);
    if (/^(PM|P M|PAGO MOVIL|PAGOMOVIL)$/.test(n))
        return 'Pago Móvil';
    if (/^(TD|T D|DEBITO|TARJETA DEBITO|TARJETA DE DEBITO|PUNTO|PUNTO DE VENTA)$/.test(n))
        return 'Tarjeta de Débito';
    if (/^(TRANSFERENCIA|TRANSFER|TRANSF|TRF)$/.test(n))
        return 'Transferencia';
    if (n === 'BIOPAGO')
        return 'Biopago';
    if (n === 'EFECTIVO')
        return 'Efectivo';
    if (n === 'CHEQUE')
        return 'Cheque';
    return n ? 'Otro' : 'Sin indicar';
}
function accountKind(c) {
    if (!c)
        return '';
    const n = normalizedText(c.Titularidad);
    if (/^(PERSONAL|PERS)$/.test(n))
        return 'Personal';
    if (/^(JURIDIC[AO]|JUR)$/.test(n))
        return 'Jurídico';
    return '';
}
function bankName(c) {
    if (!c)
        return 'Banco pendiente';
    const n = normalizedText(c.Banco + ' ' + c.Cuenta);
    if (/\b(BDV|VENEZUELA)\b/.test(n))
        return 'Banco de Venezuela (BDV)';
    if (/\b(BNC|NACIONAL DE CREDITO)\b/.test(n))
        return 'Banco Nacional de Crédito (BNC)';
    if (/\b(BPL|BPLS|BANPLUS)\b/.test(n))
        return 'Banplus (BPLS)';
    if (/\b(MERC|BMC|MERCANTIL)\b/.test(n))
        return 'Banco Mercantil (BMC)';
    if (/\b(PROV|BPR|PROVINCIAL)\b/.test(n))
        return 'Banco Provincial (BPR)';
    return String(c.Banco || 'Banco pendiente');
}
function incompleteMovement(r, data) { const c = data.cuentas.find(c => c.Cuenta === r.Cuenta); return !c || !c.Banco || !accountKind(c); }
function methodTotals(rows) { const totals = {}; rows.forEach(r => { const k = paymentMethod(r.Metodo), t = totals[k] || (totals[k] = { entradas: 0, salidas: 0 }); if (r.Tipo === 'ENTRADA')
    t.entradas = roundMoney(t.entradas + Number(r.Monto));
else
    t.salidas = roundMoney(t.salidas + Number(r.Monto)); }); return totals; }
function roundMoney(v) { return Math.round((v + Number.EPSILON) * 1e6) / 1e6; }
function numericBalance(v) { if (v === '' || v === null || v === undefined || typeof v === 'boolean' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(v).trim()))
    return null; const n = Number(v); return Number.isFinite(n) ? roundMoney(n) : null; }
function monthEnd(period) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    throw new Error('Mes inválido'); return new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0, 12)).toISOString().slice(0, 10); }
function nextMonth(p) { return shiftDay(monthEnd(p), 1).slice(0, 7); }
function activeBalanceEdits(data, account) {
    const active = [];
    (data.ajustes || []).filter(a => a.Cuenta === account).forEach(a => { for (let i = active.length - 1; i >= 0; i--)
        if (active[i].Periodo >= a.Periodo)
            active.splice(i, 1); active.push(a); });
    return active;
}
// Saldo absoluto por cuenta: ningún saldo global se reparte entre bancos.
function accountBalance(data, account, through) {
    civilDate(through);
    const c = data.cuentas.find(c => c.Cuenta === account);
    if (!c)
        throw new Error('Cuenta inválida');
    let start = String(c.FechaSaldoInicial || data.control.FechaSaldoInicial), balance = numericBalance(c.SaldoInicial);
    if (through < start)
        return null;
    for (const a of activeBalanceEdits(data, account).sort((a, b) => a.Periodo.localeCompare(b.Periodo))) {
        const date = a.Periodo + '-01';
        if (date <= through) {
            start = date;
            balance = a.Valor;
        }
    }
    if (balance === null)
        return null;
    return roundMoney(balance + data.movimientos.filter(r => r.Cuenta === account && r.Fecha >= start && r.Fecha <= through).reduce((sum, r) => sum + (r.Tipo === 'ENTRADA' ? Number(r.Monto) : -Number(r.Monto)), 0));
}
function periodBalance(data, account, from) {
    const c = data.cuentas.find(c => c.Cuenta === account);
    if (!c)
        throw new Error('Cuenta inválida');
    const edit = activeBalanceEdits(data, account).find(a => a.Periodo + '-01' === from);
    if (edit)
        return edit.Valor;
    if (from === c.FechaSaldoInicial)
        return numericBalance(c.SaldoInicial);
    return accountBalance(data, account, shiftDay(from, -1));
}
function accountMonths(data, account, through) {
    const result = [];
    const c = data.cuentas.find(c => c.Cuenta === account);
    if (!c)
        throw new Error('Cuenta inválida');
    for (let p = String(c.FechaSaldoInicial || data.control.FechaSaldoInicial).slice(0, 7), i = 0; p <= through.slice(0, 7) && i < 1200; p = nextMonth(p), i++) {
        const initial = periodBalance(data, account, p + '-01'), end = monthEnd(p) < through ? monthEnd(p) : through;
        const rows = data.movimientos.filter(r => r.Cuenta === account && r.Fecha >= p + '-01' && r.Fecha <= end);
        const entradas = roundMoney(rows.filter(r => r.Tipo === 'ENTRADA').reduce((s, r) => s + Number(r.Monto), 0)), salidas = roundMoney(rows.filter(r => r.Tipo === 'SALIDA').reduce((s, r) => s + Number(r.Monto), 0));
        const final = accountBalance(data, account, end), oficial = numericBalance([...(data.ajustes || [])].reverse().find(a => a.Cuenta === account && a.Periodo === p && numericBalance(a.Oficial) !== null)?.Oficial);
        result.push({ periodo: p, inicial: initial, entradas, salidas, final, oficial, discrepancia: oficial !== null && initial !== null && Math.abs(oficial - initial) > 0.000001 });
    }
    return result;
}
function financeRevision(data) { const s = JSON.stringify([data.movimientos, data.cuentas, data.ajustes || []]); let h = 2166136261; for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
function balancePreview(data, account, period, value, official, today, reason = '') {
    monthEnd(period);
    civilDate(today);
    const c = data.cuentas.find(c => c.Cuenta === account), n = numericBalance(value);
    if (!c || !accountKind(c) || !c.Banco)
        throw new Error('Completa banco y tipo de cuenta antes de corregir su saldo.');
    if (n === null)
        throw new Error('El saldo debe ser un número válido y no puede estar vacío.');
    if (period < String(c.FechaSaldoInicial || data.control.FechaSaldoInicial).slice(0, 7) || period > today.slice(0, 7))
        throw new Error('Elige un mes entre el inicio del control y el mes actual.');
    if (official !== '' && official !== undefined && numericBalance(official) === null)
        throw new Error('Saldo oficial inválido');
    const edit = { ID: 'preview', Cuenta: account, Periodo: period, Valor: n, Oficial: numericBalance(official) ?? '', Usuario: '', Fecha: '', Motivo: reason };
    const updated = { ...data, ajustes: [...(data.ajustes || []), edit] };
    return { revision: financeRevision(data), edit, anterior: periodBalance(data, account, period + '-01'), afectados: accountMonths(updated, account, today).filter(m => m.periodo >= period), reemplazados: activeBalanceEdits(data, account).filter(a => a.Periodo >= period).length };
}
function reportData(data, request, today) {
    if (!['Personal', 'Jurídico'].includes(request.tipo))
        throw new Error('El reporte requiere un único tipo: Personal o Jurídico.');
    civilDate(request.desde);
    civilDate(request.hasta);
    civilDate(today);
    if (request.desde > request.hasta || request.hasta > today || request.desde < String(data.control.FechaSaldoInicial))
        throw new Error('Rango de fechas inválido');
    if (!['mes', 'semana', 'rango'].includes(request.modo))
        throw new Error('Período inválido');
    if (request.modo === 'mes' && (request.desde.slice(8) !== '01' || request.hasta !== monthEnd(request.desde.slice(0, 7)) || request.hasta >= today || request.hasta > String(data.control.CorteHistorico)))
        throw new Error('Elige un mes cerrado dentro del corte validado.');
    if (request.modo === 'semana') {
        const w = getBusinessWeek(request.desde);
        if (w.fechaInicio !== request.desde || w.fechaFin !== request.hasta)
            throw new Error('La semana empresarial va de sábado a viernes.');
    }
    const accounts = data.cuentas.filter(c => accountKind(c) === request.tipo && (!request.banco || bankName(c) === request.banco));
    if (!accounts.length || accounts.some(c => !c.Banco))
        throw new Error('No hay cuentas completas para esa selección.');
    const ids = accounts.map(c => c.Cuenta);
    const movements = data.movimientos.filter(r => ids.includes(r.Cuenta) && r.Fecha >= request.desde && r.Fecha <= request.hasta);
    if (movements.some(r => incompleteMovement(r, data)))
        throw new Error('Hay movimientos sin banco o tipo de cuenta. Corrígelos antes de emitir.');
    return { ...data, ajustes: [], movimientos: movements, cuentas: accounts.map(c => {
            const initial = periodBalance(data, c.Cuenta, request.desde), final = accountBalance(data, c.Cuenta, request.hasta), net = movements.filter(r => r.Cuenta === c.Cuenta).reduce((s, r) => s + (r.Tipo === 'ENTRADA' ? Number(r.Monto) : -Number(r.Monto)), 0);
            return { ...c, SaldoInicial: initial ?? '', SaldoFinalPeriodo: final ?? '', AjustePeriodo: initial === null || final === null ? 0 : roundMoney(final - initial - net), FechaSaldoInicial: request.desde };
        }), control: { ...data.control, SaldoInicialGlobal: '', FechaSaldoInicial: request.desde, CorteHistorico: request.hasta } };
}
// END SHARED BUSINESS DOMAIN

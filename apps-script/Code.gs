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

// Cuentas en la pestaña USUARIOS. El primer administrador requiere SETUP_CODE
// en Propiedades del script; nunca se incluyen claves en este archivo.
const HOJA_USUARIOS = 'USUARIOS';

// Escaneo de encabezados: busca en las primeras 12 filas la que contenga CEDULA + NOMBRE
const MAX_FILA_ENCABEZADO = 12;

const DATE_KEYS = ['fechaNac', 'ingresoReal', 'ingresoIVSS', 'fechaCese'];
const NUM_KEYS  = ['salarioSemanal', 'sueldoMensual', 'bonoAlimentacion', 'ayudaUnica', 'totalRemuneracion', 'comisiones', 'bonoVacacional', 'otros'];

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
    if (a === 'ping') return ok({ok:true,sistema:'CorpSan Gestión',estado:'Disponible'});
    return ok({ ok: false, msg: 'Usa el acceso seguro de la aplicación.' });
  } catch (err) {
    return ok({ ok: false, msg: 'Error: ' + err.message });
  }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'auth_status') return ok(authStatus());
    if (b.action === 'auth_challenge') return ok(authChallenge(b.usuario));
    if (b.action === 'register') return ok(authRegister(b));
    if (b.action === 'email_confirm') return ok(authEmailConfirm(b));
    if (b.action === 'email_resend') return ok(authEmailResend(b));
    if (b.action === 'password_reset_request') return ok(authResetRequest(b));
    if (b.action === 'password_reset') return ok(authReset(b));
    if (b.action === 'login') return ok(login(b.usuario, b.proof, b.trustDevice));
    if (b.action === 'login_mfa') return ok(authLoginMfa(b));
    if (b.action === 'logout') return ok(authLogout(b.token));
    if (b.action === 'auth_validate') return ok(authValidate(b.token));
    finSesion(b.token);
    if (b.action === 'ping') return ok(info());
    if (b.action === 'list') return ok(listar(b.hoja));
    if (b.action === 'pagos_list') return ok(pagosList(b.periodo));
    if (b.action === 'users_list') return ok(authUsersList());
    if (b.action === 'users_update') return ok(authUsersUpdate(b));
    if (b.action === 'change_password') return ok(authChangePassword(b));
    if (b.action === 'email_start') return ok(authEmailStart(b));
    if (b.action === 'totp_start') return ok(authTotpStart(b.token));
    if (b.action === 'totp_confirm') return ok(authTotpConfirm(b));
    if (b.action === 'totp_disable') return ok(authTotpDisable(b));
    if (b.action === 'auth_profile') return ok(authProfile(b.token));
    if (b.action === 'adm_list') return ok(admList(b.coleccion));
    if (b.action === 'adm_save') return ok(admSave(b.token, b.coleccion, b.data));
    if (b.action === 'adm_del') return ok(admDel(b.token, b.coleccion, b.id));
    if (b.action === 'adm_resumen') return ok(admResumen());
    if (b.action === 'fin_list')   { const user=finSesion(b.token); finPrepare2026(user); finNumerosCuenta(user); return ok(finList()); }
    if (b.action === 'fin_cuenta') return ok(finCuentaSave(b.token,b.data,b.operacion));
    if (b.action === 'fin_cuenta_eliminar') return ok(finCuentaDelete(b.token,b.cuenta));
    if (b.action === 'fin_save')   return ok(finSave(b.token, b.data, b.permitirDuplicado));
    if (b.action === 'fin_cierre') return ok({ok:false,msg:'Genera reportes separados por Personal o Jurídico.'});
    if (b.action === 'fin_reporte') return ok(finReporte(b.token, b.seleccion));
    if (b.action === 'fin_saldo') return ok(finCorregirSaldo(b.token, b));
    if (b.action === 'th_estado') return ok(thCambiarEstado(b.token,b.hoja,b.check,b.anterior,b.estado));
    if (b.action === 'create')     return ok(crear(b.hoja, b.data));
    if (b.action === 'update')     return ok(actualizar(b.hoja, b.fila, b.check, b.data, finSesion(b.token)));
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
  // Diagnóstico de la pestaña PAGOS (alineación de encabezados y última reparación)
  let pagosDiag = null;
  try {
    const hp = ss().getSheetByName(HOJA_PAGOS);
    if (hp) {
      const encP = hp.getRange(1, 1, 1, Math.min(hp.getMaxColumns(), PAGOS_HEADERS.length)).getValues()[0];
      const dif = [];
      encP.forEach(function (v, i) {
        const n = String(v == null ? '' : v).trim();
        if (n !== PAGOS_HEADERS[i]) dif.push('col ' + (i + 1) + ': «' + (n || '(vacía)') + '» ≠ «' + PAGOS_HEADERS[i] + '»');
      });
      pagosDiag = { filas: Math.max(0, hp.getLastRow() - 1), columnas: hp.getMaxColumns(), encabezadosCorrectos: dif.length === 0, diferencias: dif.slice(0, 8), ultimaReparacion: PAGOS_ULTIMA_REPARACION };
    } else {
      pagosDiag = { existe: false };
    }
  } catch (ePagos) {
    pagosDiag = { error: String(ePagos.message || ePagos) };
  }
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
    filasTotales: filas,
    pagos: pagosDiag
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
    if (!Number.isFinite(n)) throw new Error('El campo ' + key + ' solo admite números');
    return n;
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
  const perfiles=nominaPerfilMap();
  rows.forEach(function(r){
    const perfil=perfiles[cedulaCanon(r.cedula)] || NOMINA_PROFILE_DEFAULTS;
    NOMINA_PROFILE_KEYS.forEach(function(k){r[k]=Number(perfil[k] === undefined ? NOMINA_PROFILE_DEFAULTS[k] : perfil[k]);});
  });
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
    prepararPerfilNomina(datos);
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
      if (k === 'totalRemuneracion') return calcularRemuneracion(datos);
      if (k === null || datos[k] === undefined || datos[k] === null) return '';
      return escribir(k, datos[k]);
    });
    h.appendRow(fila);
    nominaPerfilSave(datos, datos.cedula);
    return { ok: true, msg: 'Registro creado', n: maxN + 1 };
  } finally {
    lock.releaseLock();
  }
}

function actualizar(hoja, fila, check, datos, usuario) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    prepararPerfilNomina(datos);
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
      if (datos[k] !== undefined) h.getRange(filaReal,j+1).setValue(escribir(k,k === 'estado' ? normTxt(datos[k]) : (k === 'totalRemuneracion' ? calcularRemuneracion(datos) : datos[k])));
    });
    nominaPerfilSave(datos, datos.cedula || check);
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

// La ficha sigue siendo la fuente maestra. La distribución se guarda en una pestaña
// auxiliar para no alterar el diseño actual de BD PERSONAL ACTIVO.
const HOJA_NOMINA_PERFILES = 'NOMINA_PERFILES';
const NOMINA_PROFILE_KEYS = [
  'PctSueldo','PctDisp','PctResp','PctRepr','PctAntig','PctCestaticket',
  'PctLimpieza','PctPuntual','PctMovilidad','PctCoordin'
];
const NOMINA_PROFILE_HEADERS = ['Cedula'].concat(NOMINA_PROFILE_KEYS).concat(['Actualizado']);
const NOMINA_PROFILE_DEFAULTS = {
  PctSueldo:0.20,PctDisp:0.10,PctResp:0.15,PctRepr:0,PctAntig:0.08,
  PctCestaticket:0.20,PctLimpieza:0.05,PctPuntual:0.02,PctMovilidad:0.05,PctCoordin:0.15
};
const NOMINA_PROFILE_MAX = {
  PctSueldo:0.20,PctDisp:0.10,PctResp:0.15,PctRepr:0.15,PctAntig:0.10,
  PctCestaticket:0.20,PctLimpieza:0.05,PctPuntual:0.02,PctMovilidad:0.05,PctCoordin:0.15
};

function cedulaCanon(value) { return String(value == null ? '' : value).replace(/\D/g,''); }
function calcularRemuneracion(datos) {
  return r2(['sueldoMensual','bonoAlimentacion','ayudaUnica','comisiones','bonoVacacional','otros'].reduce(function(total,k){
    const value=Number(datos && datos[k]); return total+(Number.isFinite(value)?value:0);
  },0));
}
/**
 * La ficha de Talento Humano debe tener su total explícitamente registrado.
 * No se infiere aquí desde los componentes, para impedir pagos sobre una
 * estructura salarial incompleta.
 */
function remuneracionRegistrada(datos) {
  if (!datos || datos.totalRemuneracion === '' || datos.totalRemuneracion === null || datos.totalRemuneracion === undefined) return 0;
  const total=Number(datos.totalRemuneracion);
  return Number.isFinite(total) && total>0 ? total : 0;
}
function nominaPerfilSh() {
  let h=ss().getSheetByName(HOJA_NOMINA_PERFILES);
  if(!h){h=ss().insertSheet(HOJA_NOMINA_PERFILES);h.getRange(1,1,1,NOMINA_PROFILE_HEADERS.length).setValues([NOMINA_PROFILE_HEADERS]);h.setFrozenRows(1);}
  const headers=h.getRange(1,1,1,NOMINA_PROFILE_HEADERS.length).getValues()[0];
  NOMINA_PROFILE_HEADERS.forEach(function(name,i){if(headers[i] && headers[i]!==name)throw new Error('Encabezado NOMINA_PERFILES inesperado en columna '+(i+1));if(!headers[i])h.getRange(1,i+1).setValue(name);});
  return h;
}
function nominaPerfilMap() {
  const h=nominaPerfilSh(),map={};
  if(h.getLastRow()<2)return map;
  h.getRange(2,1,h.getLastRow()-1,NOMINA_PROFILE_HEADERS.length).getValues().forEach(function(row){
    const key=cedulaCanon(row[0]);if(!key)return;const item={};NOMINA_PROFILE_KEYS.forEach(function(k,i){item[k]=Number(row[i+1]);});map[key]=item;
  });
  return map;
}
function validarPerfilNomina(datos) {
  let total=0;
  NOMINA_PROFILE_KEYS.forEach(function(k){
    const value=Number(datos[k]);
    if(!Number.isFinite(value)||value<0||value>NOMINA_PROFILE_MAX[k]+0.000001)throw new Error('Porcentaje de '+k+' fuera del máximo permitido');
    if(Math.abs(value*200-Math.round(value*200))>0.000001)throw new Error('Los porcentajes deben seleccionarse en intervalos de 0,5 %');
    total+=value;
  });
  if(Math.abs(total-1)>0.000001)throw new Error('La distribución de nómina debe sumar exactamente 100 %; actualmente suma '+r2(total*100)+' %');
}
function perfilNominaCompleto(datos) {
  const completo={};NOMINA_PROFILE_KEYS.forEach(function(k){completo[k]=datos[k]===undefined?NOMINA_PROFILE_DEFAULTS[k]:Number(datos[k]);});
  return completo;
}
function prepararPerfilNomina(datos) {
  if(!datos || !NOMINA_PROFILE_KEYS.some(function(k){return datos[k]!==undefined;}))return null;
  const completo=perfilNominaCompleto(datos);validarPerfilNomina(completo);nominaPerfilSh();return completo;
}
function nominaPerfilSave(datos,cedula) {
  if(!datos || !NOMINA_PROFILE_KEYS.some(function(k){return datos[k]!==undefined;}))return;
  const completo=perfilNominaCompleto(datos);
  validarPerfilNomina(completo);
  const key=cedulaCanon(cedula);if(!key)throw new Error('Falta la cédula para guardar la distribución de nómina');
  const h=nominaPerfilSh();let row=0;
  if(h.getLastRow()>=2){const ids=h.getRange(2,1,h.getLastRow()-1,1).getValues();for(let i=0;i<ids.length;i++)if(cedulaCanon(ids[i][0])===key){row=i+2;break;}}
  const values=[String(cedula)].concat(NOMINA_PROFILE_KEYS.map(function(k){return completo[k];})).concat([new Date()]);
  if(row)h.getRange(row,1,1,values.length).setValues([values]);else h.appendRow(values);
}

const AUTH_HEADERS = ['ID','Usuario','Nombre','Rol','Estado','Salt','Verificador','Creado','Actualizado','UltimoAcceso','Correo','CorreoVerificado','TotpActivo'];
function authSheet(create) {
  const book = ss(); let sheet = book.getSheetByName(HOJA_USUARIOS);
  if (!sheet && create) { sheet = book.insertSheet(HOJA_USUARIOS); sheet.getRange(1,1,1,AUTH_HEADERS.length).setValues([AUTH_HEADERS]); sheet.setFrozenRows(1); }
  if (sheet) {
    const headers=sheet.getRange(1,1,1,AUTH_HEADERS.length).getValues()[0];
    AUTH_HEADERS.forEach(function(h,i){if (headers[i]!==h && i>=10) sheet.getRange(1,i+1).setValue(h);});
  }
  return sheet;
}
function authRows() {
  const sheet = authSheet(false); if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,AUTH_HEADERS.length).getValues().map(function(r,i){
    const o = {_row:i+2}; AUTH_HEADERS.forEach(function(h,j){o[h]=r[j];}); return o;
  }).filter(function(r){return r.Usuario !== '';});
}
function authUser(value) {
  const user = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(user)) throw new Error('Usuario inválido: usa entre 3 y 40 letras, números, puntos, guiones o guiones bajos.');
  return user;
}
function authInput(b) {
  if (!/^[a-f0-9]{32}$/.test(String(b.salt || '')) || !/^[a-f0-9]{64}$/.test(String(b.proof || ''))) throw new Error('Credenciales inválidas.');
}
function authName(value) {
  const name = String(value || '').trim();
  if (name.length < 3 || name.length > 100 || /^[=+@-]/.test(name)) throw new Error('Escribe un nombre válido de 3 a 100 caracteres.');
  return name;
}
function authEmail(value) {
  const email=String(value||'').trim().toLowerCase();
  if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /^[=+@-]/.test(email)) throw new Error('Escribe un correo electrónico válido.');
  return email;
}
function authHex(bytes) { return bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join(''); }
function authEqual(a,b) {
  a=String(a||''); b=String(b||''); let diff=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) diff |= (a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}
function authPepper() {
  const props=PropertiesService.getScriptProperties(); let value=props.getProperty('AUTH_PEPPER');
  if (!value) { value=Utilities.getUuid()+Utilities.getUuid(); props.setProperty('AUTH_PEPPER',value); }
  return value;
}
function authVerifier(user,salt,proof) {
  return authHex(Utilities.computeHmacSha256Signature(user+'|'+salt+'|'+proof,authPepper()));
}
function authStatus() { return {ok:true,needsSetup:authRows().length===0}; }
/** Ejecutar una sola vez en Apps Script antes del primer registro. */
function prepararCodigoInicial() {
  if (authRows().length) throw new Error('Ya existe una cuenta; no se puede abrir de nuevo el registro inicial.');
  const code=Utilities.getUuid()+Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('SETUP_CODE',code);
  Logger.log('Código de instalación (copiar y usar una vez): '+code);
}
/** Ejecutar una vez como propietario para autorizar el envío de correos. */
function autorizarCorreos() {
  Logger.log('Destinatarios disponibles hoy: '+MailApp.getRemainingDailyQuota());
}
/** Rescate único de una cuenta antigua sin correo: configurar RECOVERY_USER y
 * RECOVERY_EMAIL en Propiedades del script y ejecutar manualmente como propietario. */
function prepararRecuperacionDeCuenta() {
  const props=PropertiesService.getScriptProperties(),user=authUser(props.getProperty('RECOVERY_USER'));
  const email=authEmail(props.getProperty('RECOVERY_EMAIL'));
  const row=authRows().find(function(r){return r.Usuario===user;});
  if (!row || row.Correo) throw new Error('La cuenta no existe o ya tiene correo.');
  if (authRows().some(function(r){return String(r.Correo).toLowerCase()===email;})) throw new Error('Correo ya usado.');
  authSendEmailCode(user,email);
  authSheet(false).getRange(row._row,11,1,2).setValues([[email,'No']]);
  props.deleteProperty('RECOVERY_USER');props.deleteProperty('RECOVERY_EMAIL');
  Logger.log('Correo de recuperación pendiente de verificación para '+user+'. Revisa la bandeja de entrada.');
}
function authChallenge(value) {
  let user; try { user=authUser(value); } catch (_) { user='invalid-user'; }
  const row=authRows().find(function(r){return r.Usuario===user;});
  return {ok:true,salt:row ? String(row.Salt) : authHex(Utilities.computeHmacSha256Signature(user,authPepper())).slice(0,32),iterations:600000};
}
function authRegister(b) {
  const user=authUser(b.usuario),name=authName(b.nombre),email=authEmail(b.email); authInput(b);
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const rows=authRows();
    if (rows.some(function(r){return r.Usuario===user;})) return {ok:false,msg:'Ese usuario ya existe.'};
    if (rows.some(function(r){return String(r.Correo).toLowerCase()===email;})) return {ok:false,msg:'Ese correo ya está registrado.'};
    const first=rows.length===0,props=PropertiesService.getScriptProperties();
    if (first) {
      const setup=props.getProperty('SETUP_CODE');
      if (!setup || setup.length<24) return {ok:false,msg:'El código de instalación aún no está configurado por el propietario.'};
      if (!authEqual(String(b.setupCode||''),setup)) return {ok:false,msg:'Código de instalación incorrecto.'};
    }
    const now=new Date().toISOString(),state=first?'Activo':'Pendiente';
    authSendEmailCode(user,email);
    authSheet(true).appendRow([Utilities.getUuid(),user,name,'Administrador',state,b.salt,authVerifier(user,b.salt,b.proof),now,now,'',email,'No','No']);
    if (first) props.deleteProperty('SETUP_CODE');
    return {ok:true,estado:state,msg:'Cuenta creada. Revisa tu correo para verificar la dirección antes de ingresar.'};
  } finally { lock.releaseLock(); }
}
function login(value,proof,trustDevice) {
  let user; try {user=authUser(value);} catch (_) {return {ok:false,msg:'Usuario o contraseña incorrectos.'};}
  const cache=CacheService.getScriptCache(),failKey='auth_fail_'+user;
  if (Number(cache.get(failKey)||0)>=5) return {ok:false,msg:'Demasiados intentos. Espera diez minutos y vuelve a probar.'};
  const row=authRows().find(function(r){return r.Usuario===user;});
  const valid=row && row.Estado==='Activo' && row.Rol==='Administrador' && /^[a-f0-9]{64}$/.test(String(proof||'')) && authEqual(authVerifier(user,String(row.Salt),String(proof)),String(row.Verificador));
  if (!valid) {cache.put(failKey,String(Number(cache.get(failKey)||0)+1),600);return {ok:false,msg:'Usuario o contraseña incorrectos, o cuenta pendiente de aprobación.'};}
  if (row.Correo && row.CorreoVerificado!=='Sí') return {ok:false,msg:'Verifica tu correo antes de iniciar sesión.'};
  cache.remove(failKey);
  if (row.TotpActivo==='Sí') {
    const challenge=Utilities.getUuid()+Utilities.getUuid();
    cache.put('auth_mfa_'+challenge,JSON.stringify({user:user,version:String(row.Actualizado),trust:!!trustDevice}),300);
    return {ok:true,mfaRequired:true,challenge:challenge};
  }
  return authIssueSession(row,!!trustDevice);
}
function authLogout(token) {
  if (token && String(token).length===72) {
    CacheService.getScriptCache().remove('auth_'+String(token));
    PropertiesService.getScriptProperties().deleteProperty('auth_trust_'+authTokenHash(token));
  }
  return {ok:true};
}
function authUsersList() {
  return {ok:true,users:authRows().map(function(r){return {id:r.ID,usuario:r.Usuario,nombre:r.Nombre,rol:r.Rol,estado:r.Estado,creado:r.Creado,ultimoAcceso:r.UltimoAcceso,correo:r.Correo,correoVerificado:r.CorreoVerificado};})};
}
function authUsersUpdate(b) {
  const user=authUser(b.usuario),state=String(b.estado||'');
  if (['Activo','Suspendido'].indexOf(state)<0) throw new Error('Estado inválido.');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const rows=authRows(),row=rows.find(function(r){return r.Usuario===user;});
    if(!row) throw new Error('Usuario no encontrado.');
    if(user===finSesion(b.token)&&state==='Suspendido') throw new Error('No puedes suspender tu propia cuenta.');
    if(state==='Activo'&&row.Correo && row.CorreoVerificado!=='Sí') throw new Error('La persona debe verificar su correo antes de activar la cuenta.');
    if(state==='Suspendido'&&rows.filter(function(r){return r.Estado==='Activo';}).length<=1) throw new Error('Debe quedar al menos un administrador activo.');
    const sheet=authSheet(false);
    sheet.getRange(row._row,3).setValue(authName(b.nombre||row.Nombre));
    sheet.getRange(row._row,5).setValue(state);
    sheet.getRange(row._row,9).setValue(new Date().toISOString());
    return {ok:true};
  } finally {lock.releaseLock();}
}
function authChangePassword(b) {
  const user=finSesion(b.token),row=authRows().find(function(r){return r.Usuario===user;});
  if(!row || !/^[a-f0-9]{64}$/.test(String(b.oldProof||'')) || !authEqual(authVerifier(user,String(row.Salt),String(b.oldProof)),String(row.Verificador))) return {ok:false,msg:'La contraseña actual es incorrecta.'};
  authInput(b);
  const sheet=authSheet(false),now=new Date().toISOString();
  sheet.getRange(row._row,6,1,2).setValues([[b.salt,authVerifier(user,b.salt,b.proof)]]);
  sheet.getRange(row._row,9).setValue(now);
  return {ok:true,msg:'Contraseña actualizada. Inicia sesión de nuevo.'};
}

function authTokenHash(token) { return authHex(Utilities.computeHmacSha256Signature(String(token||''),authPepper())); }
function authIssueSession(row,trust) {
  const token=Utilities.getUuid()+Utilities.getUuid(),session={user:row.Usuario,version:String(row.Actualizado)};
  if (trust) {
    const props=PropertiesService.getScriptProperties(),key='auth_trust_'+authTokenHash(token);
    props.setProperty(key,JSON.stringify({user:session.user,version:session.version,until:Date.now()+7*86400000}));
    const indexKey='auth_trust_index_'+row.ID;
    let keys=[]; try {keys=JSON.parse(props.getProperty(indexKey)||'[]');} catch (_) {}
    keys.push(key);
    while (keys.length>5) props.deleteProperty(keys.shift());
    props.setProperty(indexKey,JSON.stringify(keys));
  } else CacheService.getScriptCache().put('auth_'+token,JSON.stringify(session),21600);
  authSheet(false).getRange(row._row,10).setValue(new Date().toISOString());
  return {ok:true,usuario:row.Usuario,nombre:row.Nombre,rol:row.Rol,token:token,trusted:!!trust,expiresIn:trust?7*86400:21600};
}
function authValidate(token) {
  const user=finSesion(token),row=authRows().find(function(r){return r.Usuario===user;});
  return {ok:true,usuario:user,nombre:row.Nombre,rol:row.Rol};
}
function authProfile(token) {
  const user=finSesion(token),row=authRows().find(function(r){return r.Usuario===user;});
  return {ok:true,correo:String(row.Correo||''),correoVerificado:row.CorreoVerificado==='Sí',totpActivo:row.TotpActivo==='Sí'};
}
function authCodeHash(user,code) {return authHex(Utilities.computeHmacSha256Signature(user+'|'+String(code),authPepper()));}
function authNewCode() {return String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,12),16)%100000000).padStart(8,'0');}
function authSendEmailCode(user,email) {
  if (MailApp.getRemainingDailyQuota()<1) throw new Error('No hay cupo de correos disponible hoy. Inténtalo mañana.');
  const code=authNewCode();
  MailApp.sendEmail(email,'Verifica tu correo en CorpSan Gestión','Tu código de verificación es: '+code+'\n\nVence en 15 minutos. Si no lo solicitaste, ignora este mensaje.');
  CacheService.getScriptCache().put('auth_email_'+user,JSON.stringify({email:email,hash:authCodeHash(user,code),attempts:0}),900);
}
function authEmailStart(b) {
  const user=finSesion(b.token),email=authEmail(b.email),row=authRows().find(function(r){return r.Usuario===user;});
  if (authRows().some(function(r){return r.Usuario!==user && String(r.Correo).toLowerCase()===email;})) throw new Error('Ese correo ya está registrado.');
  const cache=CacheService.getScriptCache();
  if (cache.get('auth_email_rate_'+user)) return {ok:false,msg:'Espera un minuto antes de solicitar otro código.'};
  authSendEmailCode(user,email);
  cache.put('auth_email_rate_'+user,'1',60);
  return {ok:true,msg:'Enviamos un código al correo indicado.'};
}
function authEmailResend(b) {
  const generic={ok:true,msg:'Si la cuenta tiene un correo pendiente, enviaremos un nuevo código.'};
  let user;try {user=authUser(b.usuario);} catch (_) {return generic;}
  const row=authRows().find(function(r){return r.Usuario===user && r.Correo && r.CorreoVerificado!=='Sí';});
  if (!row) return generic;
  const cache=CacheService.getScriptCache(),rate='auth_email_rate_'+user;
  if (cache.get(rate)) return generic;
  try {authSendEmailCode(user,String(row.Correo));cache.put(rate,'1',60);} catch (_) {}
  return generic;
}
function authEmailConfirm(b) {
  const user=authUser(b.usuario),row=authRows().find(function(r){return r.Usuario===user;});
  const cache=CacheService.getScriptCache(),key='auth_email_'+user,raw=cache.get(key);
  if (!row || !raw) return {ok:false,msg:'Código inválido o vencido.'};
  const item=JSON.parse(raw);
  if (item.attempts>=5) return {ok:false,msg:'Demasiados intentos. Solicita otro código.'};
  if (!authEqual(item.hash,authCodeHash(user,b.code))) {
    item.attempts++; cache.put(key,JSON.stringify(item),900);
    return {ok:false,msg:'Código inválido o vencido.'};
  }
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if (authRows().some(function(r){return r.Usuario!==user && String(r.Correo).toLowerCase()===item.email;})) throw new Error('Ese correo ya está registrado.');
    const sheet=authSheet(false);sheet.getRange(row._row,11,1,2).setValues([[item.email,'Sí']]);
    sheet.getRange(row._row,9).setValue(new Date().toISOString());
    cache.remove(key);
    return {ok:true,msg:'Correo verificado.'};
  } finally {lock.releaseLock();}
}
function authResetRequest(b) {
  const email=String(b.email||'').trim().toLowerCase(),generic={ok:true,msg:'Si el correo está registrado y verificado, recibirás un código de recuperación.'};
  const row=authRows().find(function(r){return String(r.Correo).toLowerCase()===email && r.CorreoVerificado==='Sí' && r.Estado==='Activo';});
  if (!row) return generic;
  const cache=CacheService.getScriptCache(),rate='auth_reset_rate_'+row.ID;
  if (cache.get(rate) || MailApp.getRemainingDailyQuota()<1) return generic;
  const code=authNewCode();
  try { MailApp.sendEmail(email,'Recupera tu acceso a CorpSan Gestión','Tu código de recuperación es: '+code+'\n\nVence en 15 minutos. Si no lo solicitaste, ignora este mensaje.'); }
  catch (_) { return generic; }
  cache.put('auth_reset_'+row.ID,JSON.stringify({hash:authCodeHash(row.ID,code),attempts:0}),900);
  cache.put(rate,'1',60);
  return generic;
}
function authReset(b) {
  const email=String(b.email||'').trim().toLowerCase(),row=authRows().find(function(r){return String(r.Correo).toLowerCase()===email && r.CorreoVerificado==='Sí' && r.Estado==='Activo';});
  if (!row) return {ok:false,msg:'Código inválido o vencido.'};
  const cache=CacheService.getScriptCache(),key='auth_reset_'+row.ID,raw=cache.get(key);
  if (!raw) return {ok:false,msg:'Código inválido o vencido.'};
  const item=JSON.parse(raw);
  if (item.attempts>=5) return {ok:false,msg:'Demasiados intentos. Solicita otro código.'};
  if (!authEqual(item.hash,authCodeHash(row.ID,b.code))) {
    item.attempts++;cache.put(key,JSON.stringify(item),900);return {ok:false,msg:'Código inválido o vencido.'};
  }
  authInput(b);
  if (row.TotpActivo==='Sí' && !authVerifySecondFactor(row,b.totp)) {
    item.attempts++;cache.put(key,JSON.stringify(item),900);
    return {ok:false,msg:'Código de Authenticator inválido.'};
  }
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const sheet=authSheet(false),now=new Date().toISOString();
    sheet.getRange(row._row,6,1,2).setValues([[b.salt,authVerifier(row.Usuario,b.salt,b.proof)]]);
    sheet.getRange(row._row,9).setValue(now);
    cache.remove(key);
    return {ok:true,msg:'Contraseña actualizada. Inicia sesión con la nueva clave.'};
  } finally {lock.releaseLock();}
}
function authBase32(bytes) {
  const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out='';
  bytes.forEach(function(byte){value=(value<<8)|(byte&255);bits+=8;while(bits>=5){out+=abc[(value>>>(bits-5))&31];bits-=5;}});
  if(bits) out+=abc[(value<<(5-bits))&31];return out;
}
function authUnbase32(value) {
  const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,n=0,out=[];
  String(value).replace(/=+$/,'').toUpperCase().split('').forEach(function(ch){const idx=abc.indexOf(ch);if(idx<0) throw new Error('Clave de Authenticator inválida.');n=(n<<5)|idx;bits+=5;if(bits>=8){out.push((n>>>(bits-8))&255);bits-=8;}});
  return out;
}
function authTotpValue(secret,step) {
  const counter=[];for(let i=7;i>=0;i--) counter.push(Math.floor(step/Math.pow(256,i))&255);
  const mac=Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1,counter,authUnbase32(secret)),offset=mac[mac.length-1]&15;
  const code=(((mac[offset]&127)<<24)|((mac[offset+1]&255)<<16)|((mac[offset+2]&255)<<8)|(mac[offset+3]&255))%1000000;
  return String(code).padStart(6,'0');
}
function authVerifyTotp(row,code,secretOverride) {
  if (!/^\d{6}$/.test(String(code||''))) return false;
  const props=PropertiesService.getScriptProperties(),secret=secretOverride||props.getProperty('auth_totp_'+row.ID);
  if (!secret) return false;
  const step=Math.floor(Date.now()/30000),last=Number(props.getProperty('auth_totp_last_'+row.ID)||-1);
  for(let diff=-1;diff<=1;diff++) {
    const candidate=step+diff;
    if (candidate>last && authEqual(authTotpValue(secret,candidate),String(code))) {
      props.setProperty('auth_totp_last_'+row.ID,String(candidate));return true;
    }
  }
  return false;
}
function authBackupCodes(row) {
  const codes=[];
  for(let i=0;i<8;i++) {
    const value=Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    codes.push(value.slice(0,4)+'-'+value.slice(4,8)+'-'+value.slice(8));
  }
  PropertiesService.getScriptProperties().setProperty('auth_backup_'+row.ID,JSON.stringify(codes.map(function(code){return authCodeHash(row.ID,code);}))) ;
  return codes;
}
function authVerifySecondFactor(row,code) {
  if (authVerifyTotp(row,code)) return true;
  const value=String(code||'').trim().toUpperCase();
  if (!/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(value)) return false;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const props=PropertiesService.getScriptProperties(),key='auth_backup_'+row.ID;
    let hashes=[];try {hashes=JSON.parse(props.getProperty(key)||'[]');} catch (_) {}
    const hash=authCodeHash(row.ID,value),idx=hashes.findIndex(function(h){return authEqual(h,hash);});
    if (idx<0) return false;
    hashes.splice(idx,1);props.setProperty(key,JSON.stringify(hashes));return true;
  } finally {lock.releaseLock();}
}
function authTotpStart(token) {
  const user=finSesion(token),row=authRows().find(function(r){return r.Usuario===user;});
  if (row.TotpActivo==='Sí') return {ok:false,msg:'Authenticator ya está activado.'};
  if (row.CorreoVerificado!=='Sí') return {ok:false,msg:'Verifica primero tu correo de recuperación.'};
  const hex=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'').slice(0,40);
  const secret=authBase32(hex.match(/.{2}/g).map(function(p){return parseInt(p,16);}));
  CacheService.getScriptCache().put('auth_totp_pending_'+row.ID,secret,600);
  return {ok:true,secret:secret,uri:'otpauth://totp/CorpSan%20Gesti%C3%B3n:'+encodeURIComponent(user)+'?secret='+secret+'&issuer=CorpSan%20Gesti%C3%B3n&algorithm=SHA1&digits=6&period=30'};
}
function authTotpConfirm(b) {
  const user=finSesion(b.token),row=authRows().find(function(r){return r.Usuario===user;}),cache=CacheService.getScriptCache(),secret=cache.get('auth_totp_pending_'+row.ID);
  if (!secret || !authVerifyTotp(row,b.code,secret)) return {ok:false,msg:'Código inválido o vencido.'};
  PropertiesService.getScriptProperties().setProperty('auth_totp_'+row.ID,secret);
  const sheet=authSheet(false);sheet.getRange(row._row,13).setValue('Sí');
  sheet.getRange(row._row,9).setValue(new Date().toISOString());
  cache.remove('auth_totp_pending_'+row.ID);
  return {ok:true,msg:'Google Authenticator activado. Guarda los códigos de respaldo; se mostrarán una sola vez.',backupCodes:authBackupCodes(row)};
}
function authTotpDisable(b) {
  const user=finSesion(b.token),row=authRows().find(function(r){return r.Usuario===user;});
  if (!authVerifySecondFactor(row,b.code)) return {ok:false,msg:'Código de Authenticator inválido.'};
  const props=PropertiesService.getScriptProperties();props.deleteProperty('auth_totp_'+row.ID);props.deleteProperty('auth_totp_last_'+row.ID);
  props.deleteProperty('auth_backup_'+row.ID);
  authSheet(false).getRange(row._row,13).setValue('No');
  authSheet(false).getRange(row._row,9).setValue(new Date().toISOString());
  return {ok:true,msg:'Google Authenticator desactivado. Inicia sesión de nuevo.'};
}
function authLoginMfa(b) {
  if (String(b.challenge||'').length!==72) return {ok:false,msg:'La verificación venció. Inicia sesión de nuevo.'};
  const cache=CacheService.getScriptCache(),key='auth_mfa_'+String(b.challenge||''),raw=cache.get(key);
  if (!raw) return {ok:false,msg:'La verificación venció. Inicia sesión de nuevo.'};
  const pending=JSON.parse(raw),row=authRows().find(function(r){return r.Usuario===pending.user;});
  const rate='auth_mfa_attempts_'+pending.user,attempts=Number(cache.get(rate)||0);
  if (attempts>=5) return {ok:false,msg:'Demasiados intentos. Espera diez minutos.'};
  if (!row || row.Estado!=='Activo' || row.TotpActivo!=='Sí' || String(row.Actualizado)!==pending.version || !authVerifySecondFactor(row,b.code)) {
    cache.put(rate,String(attempts+1),600);return {ok:false,msg:'Código de Authenticator inválido.'};
  }
  cache.remove(rate);cache.remove(key);
  return authIssueSession(row,pending.trust);
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
  'Origen', 'Fuente', 'CalculoHistorico', 'Observaciones', 'InicioPeriodo', 'FinPeriodo',
  'DistribucionVersion', 'PctLimpieza', 'PctPuntual', 'PctMovilidad', 'PctCoordin',
  'AnticipoS1', 'AnticipoS2', 'AnticipoS3', 'AnticipoS4'
];

// Valores por defecto según la plantilla (primas como % del salario integral)
const PAGOS_DEFAULTS = {
  PctSueldo: 0.2, PctDisp: 0.1, PctResp: 0.15, PctRepr: 0, PctAntig: 0.08,
  DistribucionVersion: 2,
  PctLimpieza: 0.05, PctPuntual: 0.02, PctMovilidad: 0.05, PctCoordin: 0.15,
  BonoLimpieza: 0, BonoPuntual: 0, BonoMovilidad: 0, BonoCoordin: 0, BonoProductiv: 0,
  PctCestaticket: 0.2, AsistencialUSD: 0,
  PctIVSS: 0.04, PctParo: 0.005, PctFAOV: 0.01, PctISLR: 0.1232, AnticiposBs: 0
};

const SEMANAS_ANTICIPO = ['AnticipoS1', 'AnticipoS2', 'AnticipoS3', 'AnticipoS4'];

/** Total de anticipos: suma de las semanas cuando existen, o el campo único histórico. */
function totalAnticipos(p) {
  const crudo = SEMANAS_ANTICIPO.map(function (k) { return p[k]; });
  const informada = crudo.some(function (v) { return v !== undefined && v !== null && String(v).trim() !== ''; });
  if (informada) {
    return r2(crudo.reduce(function (s, v) { return s + (v === undefined || v === null || String(v).trim() === '' ? 0 : (Number(v) || 0)); }, 0));
  }
  return Number(p.AnticiposBs) || 0;
}

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
 *  · Bonos nuevos: porcentajes del perfil individual; pagos anteriores conservan sus montos originales
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

  const distribucionV2 = g('DistribucionVersion') >= 2;
  const totalB = distribucionV2
    ? si * (g('PctLimpieza') + g('PctPuntual') + g('PctMovilidad') + g('PctCoordin'))
    : g('BonoLimpieza') + g('BonoPuntual') + g('BonoMovilidad') + g('BonoCoordin') + g('BonoProductiv');

  const cesta = si * g('PctCestaticket');
  const totalC = cesta + g('AsistencialUSD');

  const sueldoBs = sueldo * tasa;
  const ivssBs = (sueldoBs * 12 / 52) * g('PctIVSS') * dl.lunes;
  const paroBs = sueldoBs * g('PctParo');
  const faovBs = sueldoBs * g('PctFAOV');
  const islrBs = sueldoBs * g('PctISLR');
  const antBs = totalAnticipos(p);
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
    pagosAcomodar(h);
    if (h.getMaxColumns() < PAGOS_HEADERS.length) h.insertColumnsAfter(h.getMaxColumns(), PAGOS_HEADERS.length - h.getMaxColumns());
    h.getRange(1, 1, 1, PAGOS_HEADERS.length).setValues([PAGOS_HEADERS]);
    return h;
  }
  const nueva = ss().insertSheet(HOJA_PAGOS);
  if (nueva.getMaxColumns() < PAGOS_HEADERS.length) nueva.insertColumnsAfter(nueva.getMaxColumns(), PAGOS_HEADERS.length - nueva.getMaxColumns());
  nueva.getRange(1, 1, 1, PAGOS_HEADERS.length).setValues([PAGOS_HEADERS]);
  nueva.setFrozenRows(1);
  return nueva;
}

var PAGOS_ULTIMA_REPARACION = [];
function pagosLog(msg) { PAGOS_ULTIMA_REPARACION.push(msg); }

function pagosSh() {
  const h = ss().getSheetByName(HOJA_PAGOS);
  if (h) {
    PAGOS_ULTIMA_REPARACION = [];
    pagosAcomodar(h);
    if (h.getMaxColumns() < PAGOS_HEADERS.length) h.insertColumnsAfter(h.getMaxColumns(), PAGOS_HEADERS.length - h.getMaxColumns());
    h.getRange(1, 1, 1, PAGOS_HEADERS.length).setValues([PAGOS_HEADERS]);
    return h;
  }
  const nueva = ss().insertSheet(HOJA_PAGOS);
  if (nueva.getMaxColumns() < PAGOS_HEADERS.length) nueva.insertColumnsAfter(nueva.getMaxColumns(), PAGOS_HEADERS.length - nueva.getMaxColumns());
  nueva.getRange(1, 1, 1, PAGOS_HEADERS.length).setValues([PAGOS_HEADERS]);
  nueva.setFrozenRows(1);
  return nueva;
}

/**
 * Alineación automática de la pestaña PAGOS con el encabezado estándar, sin perder datos.
 * Reconstruye las columnas 1..PAGOS_HEADERS.length cuando el sheet fue editado a mano
 * (columnas insertadas, encabezados cortados y pegados, copias repetidas, columnas ajenas):
 *  1. Encabezado vacío CON datos debajo → si el nombre estándar de esa posición existe en
 *     otra columna sin datos, se restaura el nombre y la copia vacía se retira al final
 *     (firma típica de un corte y pegado de solo los encabezados).
 *  2. Columnas totalmente vacías dentro del rango administrado → se eliminan.
 *  3. Copias repetidas de un encabezado estándar → se reubican al extremo derecho
 *     (se conserva la copia que tiene datos; si dos tienen datos, se detiene con error claro).
 *  4. Encabezados ajenos (restos de Excel, notas) dentro del rango → al extremo derecho.
 *  5. Cada encabezado estándar se coloca en su posición moviendo la columna completa con
 *     sus datos; si no existe, se crea la columna vacía (p. ej. AnticipoS1-S4 en sheets viejos).
 * Nunca se sobrescribe una celda de datos. Solo se detiene ante ambigüedad real.
 */
function pagosAcomodar(h) {
  const N = PAGOS_HEADERS.length;
  const maxCol = h.getMaxColumns();
  if (!maxCol) return;

  // Camino rápido: encabezados ya correctos → no tocar nada (ni leer datos).
  const enc0 = h.getRange(1, 1, 1, Math.min(maxCol, N)).getValues()[0];
  let sano = maxCol >= N;
  for (var z = 0; sano && z < Math.min(maxCol, N); z++) {
    if (String(enc0[z] == null ? '' : enc0[z]).trim() !== PAGOS_HEADERS[z]) sano = false;
  }
  if (sano) return;

  function conDato(col) {
    const u = h.getLastRow();
    if (u < 2) return false;
    const vals = h.getRange(2, col, u - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) { const v = vals[i][0]; if (v !== '' && v !== null && v !== undefined) return true; }
    return false;
  }
  function columnaDe(nombre, desde) {
    const maxC = h.getMaxColumns();
    const d = Math.max(1, desde || 1);
    if (d > maxC) return -1;
    const actuales = h.getRange(1, d, 1, maxC - d + 1).getValues()[0];
    for (var i = 0; i < actuales.length; i++) if (String(actuales[i] == null ? '' : actuales[i]).trim() === nombre) return d + i;
    return -1;
  }
  function aparicionesConDato(nombre) {
    const out = [];
    let p = columnaDe(nombre);
    while (p > -1) { if (conDato(p)) out.push(p); p = columnaDe(nombre, p + 1); }
    return out;
  }
  function moverAlFinal(col) {
    h.insertColumnsAfter(h.getMaxColumns(), 1);
    const destino = h.getMaxColumns();
    const filas = Math.max(1, h.getLastRow());
    h.getRange(1, col, filas, 1).copyTo(h.getRange(1, destino, filas, 1));
    h.deleteColumns(col, 1);
  }
  function mover(col, destino) { // mueve la columna «col» a la posición «destino» (destino ≤ col)
    h.insertColumnsBefore(destino, 1);
    const filas = Math.max(1, h.getLastRow());
    h.getRange(1, col + 1, filas, 1).copyTo(h.getRange(1, destino, filas, 1));
    h.deleteColumns(col + 1, 1);
  }
  function asegurarColchon(pendientes) {
    const necesarias = N + pendientes;
    if (h.getMaxColumns() < necesarias) h.insertColumnsAfter(h.getMaxColumns(), necesarias - h.getMaxColumns());
  }

  // ── 0. Validación previa (solo lectura): detecta ambigüedades ANTES de tocar nada ──
  // Si algo es genuinamente ambiguo, se aborta sin modificar una sola celda.
  const nombresV = h.getRange(1, 1, 1, maxCol).getValues()[0].map(function (v) { return String(v == null ? '' : v).trim(); });
  const gruposV = {};
  nombresV.forEach(function (nm, i) { if (nm && PAGOS_HEADERS.indexOf(nm) > -1) (gruposV[nm] = gruposV[nm] || []).push(i + 1); });
  for (var nmV in gruposV) {
    const conDatosV = gruposV[nmV].filter(function (col) { return conDato(col); });
    if (conDatosV.length > 1) throw new Error('Ambigüedad en la pestaña PAGOS: «' + nmV + '» aparece con datos en las columnas ' + conDatosV.join(' y ') + '. Deja una sola columna con esos datos y vuelve a cargar.');
  }
  for (var cV = 1; cV <= Math.min(maxCol, N); cV++) {
    if (nombresV[cV - 1] || !conDato(cV)) continue;
    const slotV = PAGOS_HEADERS[cV - 1];
    const conDatosV2 = aparicionesConDato(slotV);
    if (conDatosV2.length) throw new Error('Ambigüedad en la pestaña PAGOS: la columna ' + cV + ' tiene datos sin encabezado y «' + slotV + '» también tiene datos en la columna ' + conDatosV2[0] + '. Deja una sola columna con esos datos y vuelve a cargar.');
  }

  // ── 1. Restaurar encabezados perdidos (celda vacía con datos debajo) ──
  for (var c = 1; c <= Math.min(maxCol, N); c++) {
    const nombre = String(enc0[c - 1] == null ? '' : enc0[c - 1]).trim();
    if (nombre || !conDato(c)) continue;
    const slot = PAGOS_HEADERS[c - 1];
    const conDatos = aparicionesConDato(slot);
    if (conDatos.length) throw new Error('Ambigüedad en la pestaña PAGOS: la columna ' + c + ' tiene datos sin encabezado y «' + slot + '» también tiene datos en la columna ' + conDatos[0] + '. Deja una sola columna con esos datos y vuelve a cargar.');
    const copia = columnaDe(slot);
    if (copia > -1) {
      h.getRange(1, c).setValue(slot);
      pagosLog('Encabezado «' + slot + '» restaurado en la columna ' + c + ' (su copia vacía de la columna ' + copia + ' se retirará al final)');
    }
  }

  // ── 2. Eliminar columnas totalmente vacías dentro del rango administrado ──
  // Se recorre de derecha a izquierda para que los índices no se desplacen.
  let borradas = 0;
  for (var c2 = Math.min(maxCol, N); c2 >= 1; c2--) {
    const nombre2 = String(enc0[c2 - 1] == null ? '' : enc0[c2 - 1]).trim();
    if (!nombre2 && !conDato(c2)) { h.deleteColumns(c2, 1); borradas++; }
  }
  if (borradas) pagosLog('Se eliminaron ' + borradas + ' columna(s) totalmente vacía(s) antes de la posición ' + (N + 1));

  // ── 3. Retirar copias repetidas de encabezados estándar ──
  let proteccion = 0;
  while (proteccion++ < 50) {
    const actuales = h.getRange(1, 1, 1, h.getMaxColumns()).getValues()[0];
    const grupos = {};
    actuales.forEach(function (v, i) {
      const nm = String(v == null ? '' : v).trim();
      if (nm && PAGOS_HEADERS.indexOf(nm) > -1) (grupos[nm] = grupos[nm] || []).push(i + 1);
    });
    let lista = null, nombreG = '';
    for (var nm2 in grupos) if (grupos[nm2].length > 1) { lista = grupos[nm2]; nombreG = nm2; break; }
    if (!lista) break;
    const conDatos = lista.filter(function (col) { return conDato(col); });
    if (conDatos.length > 1) throw new Error('Ambigüedad en la pestaña PAGOS: «' + nombreG + '» aparece con datos en las columnas ' + conDatos.join(' y ') + '. Deja una sola columna con esos datos y vuelve a cargar.');
    const conservar = conDatos.length === 1 ? conDatos[0] : lista[0];
    const extra = lista.filter(function (col) { return col !== conservar && col <= N; }).sort(function (a, b) { return b - a; });
    if (!extra.length) break;
    asegurarColchon(extra.length);
    extra.forEach(function (col) { moverAlFinal(col); pagosLog('Copia extra de «' + nombreG + '» reubicada al extremo derecho (estaba en la columna ' + col + ')'); });
  }

  // ── 4. Encabezados ajenos dentro del rango administrado → extremo derecho ──
  {
    let foraneas = [];
    const actuales = h.getRange(1, 1, 1, h.getMaxColumns()).getValues()[0];
    actuales.forEach(function (v, i) {
      const nm = String(v == null ? '' : v).trim();
      if (nm && PAGOS_HEADERS.indexOf(nm) < 0 && i + 1 <= N) foraneas.push(i + 1);
    });
    if (foraneas.length) {
      asegurarColchon(foraneas.length);
      // De izquierda a derecha compensando el desplazamiento de cada eliminación:
      // así las ajenas conservan su orden relativo al quedar al extremo derecho.
      let procesadas = 0;
      foraneas.forEach(function (colOriginal) {
        const col = colOriginal - procesadas;
        const nm = String(h.getRange(1, col).getValue() || '').trim();
        moverAlFinal(col);
        pagosLog('Columna ajena «' + nm + '» reubicada al extremo derecho (estaba en la columna ' + col + ')');
        procesadas++;
      });
    }
  }

  // ── 5. Datos sin encabezado que quedaron dentro del rango → extremo derecho ──
  {
    let perdidas = [];
    const actuales = h.getRange(1, 1, 1, h.getMaxColumns()).getValues()[0];
    actuales.forEach(function (v, i) {
      const nm = String(v == null ? '' : v).trim();
      if (!nm && i + 1 <= N && conDato(i + 1)) perdidas.push(i + 1);
    });
    if (perdidas.length) {
      asegurarColchon(perdidas.length);
      perdidas.sort(function (a, b) { return b - a; }).forEach(function (col) {
        moverAlFinal(col);
        pagosLog('Columna ' + col + ' con datos pero sin encabezado reubicada al extremo derecho para revisión');
      });
    }
  }

  // ── 6. Colocar cada encabezado estándar en su posición (moviendo columnas completas) ──
  for (var t = 1; t <= N; t++) {
    const nombreT = PAGOS_HEADERS[t - 1];
    const p = columnaDe(nombreT, t);
    if (p === t) continue;
    if (p > t) { mover(p, t); pagosLog('«' + nombreT + '» movido de la columna ' + p + ' a la ' + t + ' (con todos sus datos)'); }
    else if (t <= h.getMaxColumns()) { h.insertColumnsBefore(t, 1); pagosLog('Columna vacía creada en la posición ' + t + ' para «' + nombreT + '»'); }
    else { h.insertColumnsAfter(h.getMaxColumns(), 1); pagosLog('Columna vacía creada en la posición ' + t + ' para «' + nombreT + '»'); }
  }
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
  const respuesta = { ok: true, data: data };
  if (PAGOS_ULTIMA_REPARACION.length) respuesta.reparacion = PAGOS_ULTIMA_REPARACION;
  const personas={};
  listar('activos').data.concat(listar('inactivos').data).forEach(function(p){personas[cedulaCanon(p.cedula)]=p;});
  data.forEach(function(p){
    if(p.Origen==='Historico Excel')return;
    const persona=personas[cedulaCanon(p.Cedula)];
    const faltantes=[];
    if(!persona){p.FaltantesTalentoHumano=['vínculo con el expediente'];return;}
    p.Nombre=persona.nombre||'';p.Cargo=persona.cargo||persona.cargoLaboral||'';
    p.FechaIngreso=persona.ingresoReal||'';p.Banco=persona.banco||'';p.Cuenta=persona.nCuenta||'';
    p.SalarioSemanalFuente=persona.salarioSemanal||'';p.SueldoMensualFuente=persona.sueldoMensual||'';
    if(!p.Banco)faltantes.push('banco');if(!p.Cuenta)faltantes.push('número de cuenta');
    if(!remuneracionRegistrada(persona))faltantes.push('remuneración total');
    p.FaltantesTalentoHumano=faltantes;
  });
  return respuesta;
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

    if (crearSolo) {
      const personas = listar('activos').data.concat(listar('inactivos').data);
      const persona = personas.find(function (p) { return cedulaCanon(p.cedula) === cedulaCanon(datos.Cedula); });
      if (!persona) return { ok: false, msg: 'El trabajador no existe en Talento Humano' };
      datos.Nombre=persona.nombre||'';datos.Cargo=persona.cargo||persona.cargoLaboral||'';
      datos.FechaIngreso=persona.ingresoReal||'';datos.Banco=persona.banco||'';datos.Cuenta=persona.nCuenta||'';
      datos.SalarioIntegralUSD=remuneracionRegistrada(persona);
      NOMINA_PROFILE_KEYS.forEach(function(k){if(datos[k]===undefined)datos[k]=Number(persona[k]);});
      datos.DistribucionVersion=2;
      if (!(Number(datos.SalarioIntegralUSD)>0)) return { ok:false,msg:'Completa «Total remuneración» del trabajador en Talento Humano antes de registrar el pago' };
    }
    if (Number(datos.DistribucionVersion)>=2) {
      validarPerfilNomina(datos);
    }

    const idBase = 'PG-' + String(datos.Periodo).replace(/\D/g, '') + '-' + cedulaCanon(datos.Cedula);
    const calc = calcNomina(datos);

    // La unicidad se decide por período+cédula normalizados. El ID solo localiza una edición;
    // así una fila antigua con ID incorrecto no produce un falso duplicado en otro período.
    const ultima = h.getLastRow();
    let filaPorId = 0, filaNatural = 0;
    const idsUsados={};
    if (ultima >= 2) {
      const rows = h.getRange(2, 1, ultima - 1, PAGOS_HEADERS.length).getValues();
      const idxPeriodo=PAGOS_HEADERS.indexOf('Periodo'),idxCedula=PAGOS_HEADERS.indexOf('Cedula');
      for (var i = 0; i < rows.length; i++) {
        const rowId=String(rows[i][0]);idsUsados[rowId]=true;
        if(datos.ID && rowId===String(datos.ID))filaPorId=2+i;
        if(String(rows[i][idxPeriodo])===String(datos.Periodo) && cedulaCanon(rows[i][idxCedula])===cedulaCanon(datos.Cedula))filaNatural=2+i;
      }
    }
    if (crearSolo && filaNatural) {
      const existente=pagosList(datos.Periodo).data.find(function(p){return cedulaCanon(p.Cedula)===cedulaCanon(datos.Cedula);});
      return { ok:false,msg:'Ya existe el pago de '+(existente&&existente.Nombre||datos.Cedula)+' para '+datos.Periodo+'. Se mostró el registro existente para que puedas abrirlo o editarlo.',existente:existente };
    }
    let filaReal=filaPorId||filaNatural;
    if (filaReal) {
      if (crearSolo) return { ok: false, msg: 'Ya existe un pago para este trabajador y período. Abre el registro existente para consultarlo o editarlo.' };
      if (h.getRange(filaReal, PAGOS_HEADERS.indexOf('Origen') + 1).getValue() === 'Historico Excel') {
        return { ok: false, msg: 'El registro es un histórico original y no puede sobrescribirse desde el editor' };
      }
    }
    if (!Number.isFinite(Number(datos.SalarioIntegralUSD)) || Number(datos.SalarioIntegralUSD) <= 0) return { ok: false, msg: 'La remuneración de Talento Humano debe ser mayor que cero' };
    let id=filaReal ? String(h.getRange(filaReal,1).getValue()||idBase) : idBase;
    if(!filaReal && idsUsados[id]){let suffix=2;while(idsUsados[idBase+'-'+suffix])suffix++;id=idBase+'-'+suffix;}
    const fila = PAGOS_HEADERS.map(function (k) {
      if (k === 'ID') return id;
      if (k === 'Estado') return datos.Estado || 'Calculado';
      if (calc[k] !== undefined) return calc[k];
      if (k === 'Actualizado') return new Date();
      const v = datos[k];
      return v === undefined || v === null ? '' : v;
    });
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
    if (Number(datos.DistribucionVersion)>=2) nominaPerfilSave(datos,datos.Cedula);
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
    actuales.forEach(function (p) { existentes[cedulaCanon(p.Cedula)] = true; });

    const activos = listar('activos').data;
    const sinRemuneracion=activos.filter(function(a){return !remuneracionRegistrada(a);});
    if(sinRemuneracion.length)return {ok:false,msg:'No se cerró el mes. Completa «Total remuneración» en Talento Humano para: '+sinRemuneracion.map(function(a){return a.nombre||a.cedula;}).join(', ')};
    let creados = 0, omitidos = 0;
    for (var i = 0; i < activos.length; i++) {
      const a = activos[i];
      const cedula = String(a.cedula || '').trim();
      const cedulaKey=cedulaCanon(cedula);
      if (!cedulaKey || existentes[cedulaKey]) { if (cedulaKey) omitidos++; continue; }

      const integral = remuneracionRegistrada(a);
      if(!(integral>0))throw new Error('Completa «Total remuneración» de '+(a.nombre||cedula)+' en Talento Humano antes de cerrar el mes');

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
        SalarioIntegralUSD: integral,
        DistribucionVersion: 2
      };
      NOMINA_PROFILE_KEYS.forEach(function(k){datos[k]=Number(a[k]);});
      Object.keys(PAGOS_DEFAULTS).forEach(function (k) {
        if (datos[k] === undefined) datos[k] = PAGOS_DEFAULTS[k];
      });
      const resultado = pagosSave(datos, true, true);
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
  if (String(token||'').length!==72) throw new Error('La sesión venció. Vuelve a iniciar sesión.');
  let raw = token && CacheService.getScriptCache().get('auth_' + String(token));
  if (!raw && token) {
    const props=PropertiesService.getScriptProperties(),key='auth_trust_'+authTokenHash(token),trusted=props.getProperty(key);
    if (trusted) {
      const item=JSON.parse(trusted);
      if (item.until>Date.now()) raw=JSON.stringify(item);
      else props.deleteProperty(key);
    }
  }
  if (!raw) throw new Error('La sesión venció. Vuelve a iniciar sesión.');
  let session; try {session=JSON.parse(raw);} catch (_) {throw new Error('Sesión inválida.');}
  const row=authRows().find(function(r){return r.Usuario===session.user;});
  if (!row || row.Estado!=='Activo' || row.Rol!=='Administrador' || String(row.Actualizado)!==session.version) throw new Error('La cuenta ya no tiene acceso. Vuelve a iniciar sesión.');
  return session.user;
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
  const movimientos = finTabla('FIN_MOVIMIENTOS').rows.map(function(r) { r.Codigo = String(r.Codigo || ''); r.Referencia = String(r.Referencia || ''); const state=normalizedText(r.Conciliado);r.Conciliado=state==='SI'?'Sí':state==='NO'?'No':'Pendiente'; return r; });
  const categorias = finTabla('FIN_CATEGORIAS').rows.map(function(r) { r.Codigo = String(r.Codigo).padStart(String(r.Codigo).length<4?4:String(r.Codigo).length,'0'); return r; }).filter(function(c){return ['0001','0002'].indexOf(c.Codigo)<0;}).concat(OWN_TRANSFER_CATEGORIES);
  if(ss().getSheetByName('FIN_METODOS_ORIGINALES')){const originales=finTabla('FIN_METODOS_ORIGINALES').rows;movimientos.forEach(function(r){const original=originales.find(function(o){return o.ID===r.ID;});if(original)r.MetodoOriginal=original.Metodo;});}
  const ajustesSheet=ss().getSheetByName('FIN_AJUSTES_SALDO');
  const ajustes=ajustesSheet ? finTabla('FIN_AJUSTES_SALDO').rows.map(function(a){return {ID:a.ID,Cuenta:a.Cuenta,Periodo:a.Periodo,Valor:Number(a.Valor),Oficial:a.Oficial,Usuario:a.Usuario,Fecha:a.Fecha,Motivo:a.Motivo,Anterior:a.Anterior};}) : [];
  return { ok: true, bancosVersion: 3, movimientos: movimientos, cuentas: finTabla('FIN_CUENTAS').rows, categorias: categorias, control: Object.assign(control,{Base2026Version:ss().getSheetByName('FIN_MIGRACION_20261106')?1:0}), ajustes:ajustes };
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
    const historico = false;
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
    validateMovementCategory(row);
    if (row.Codigo && !finList().categorias.some(function(c) { return String(c.Codigo) === row.Codigo && c.Tipo === row.Tipo; })) throw new Error('El código no corresponde al tipo de movimiento');
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
    const updated=finList(); finPersistirSaldos(row.Cuenta,updated,usuario);
    if(anterior && anterior.Cuenta!==row.Cuenta)finPersistirSaldos(anterior.Cuenta,updated,usuario);
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
// Saldos de instalación: se mantienen exclusivamente en el servidor.
const FIN_INITIAL_BALANCES_2026 = {
 'Jurídico|Banco de Venezuela':3496.42,'Jurídico|Banco Nacional de Crédito':42256.69,'Jurídico|Banco Mercantil':339.16,
 'Personal|Banco de Venezuela':20226,'Personal|Banplus':0.04,'Personal|Banco Nacional de Crédito':22701.11,'Personal|Banco Mercantil':696,'Personal|Banco Provincial':202.48
};
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
  const previousRows=sheet.getLastRow()-1;
  const all=current.concat(rows).map(function(r){return RF_MONTH_HEADERS.map(function(h){return rfLiteral(r[h]===undefined?'':r[h]);});});
  if(all.length){if(all.length+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),all.length+1-sheet.getMaxRows());sheet.getRange(2,1,all.length,RF_MONTH_HEADERS.length).setValues(all);}
  if(previousRows>all.length)sheet.getRange(all.length+2,1,previousRows-all.length,RF_MONTH_HEADERS.length).clearContent();
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

function finPrepare2026(usuario) {
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  if(ss().getSheetByName('FIN_MIGRACION_20261106'))return;
  // También permite instalar Finanzas sin cargar archivos ni movimientos de ejemplo.
  rfTable('FIN_CONTROL',['Parametro','Valor']);rfTable('FIN_MOVIMIENTOS',FIN_HEADERS);
  rfTable('FIN_CATEGORIAS',['Codigo','Nombre','Tipo']);
  const accounts=rfTable('FIN_CUENTAS',['Cuenta','Banco','Titularidad','Moneda','SaldoInicial','FechaSaldoInicial']);
  const data=finList(), migrated=migrateFinance2026(data,FIN_INITIAL_BALANCES_2026), table=finTabla('FIN_CUENTAS');
  migrated.cuentas.forEach(function(c,i){accounts.getRange(i+2,1,1,table.headers.length).setValues([table.headers.map(function(k){return rfLiteral(c[k]===undefined?'':c[k]);})]);});
  const edits=rfTable('FIN_AJUSTES_SALDO',RF_BALANCE_HEADERS);
  migrated.ajustes.filter(function(a){return String(a.ID).indexOf('BASE2026-')===0;}).forEach(function(a){if(!finTabla('FIN_AJUSTES_SALDO').rows.some(function(old){return old.ID===a.ID;}))edits.appendRow(RF_BALANCE_HEADERS.map(function(k){return rfLiteral(a[k]===undefined?'':a[k]);}));});
  const control=finTabla('FIN_CONTROL');
  ['FechaSaldoInicial','SaldoInicialGlobal','CorteHistorico','Moneda'].forEach(function(k){let value=migrated.control[k];if(k==='CorteHistorico'&&!value)value='2026-01-01';if(k==='Moneda'&&!value)value='Bs';const i=control.rows.findIndex(function(r){return r.Parametro===k;});if(i<0)control.hoja.appendRow([k,value===undefined?'':value]);else control.hoja.getRange(i+2,2).setValue(value===undefined?'':value);});
  const updated=finList();updated.cuentas.forEach(function(c){finPersistirSaldos(c.Cuenta,updated,usuario);});
  rfTable('FIN_MIGRACION_20261106',['Version','Fecha']).appendRow([1,new Date().toISOString()]);
  SpreadsheetApp.flush();
 }finally{lock.releaseLock();}
}
// Números de cuenta reales por titularidad y banco (fuente: administración CorpSan).
// La migración los asigna una sola vez a los bancos ya registrados; luego se editan normal.
const FIN_NUMEROS_CUENTA = {
 'Personal|ACTIVO':'0171-0006-8060-0009-8132','Personal|BANPLUS':'0174-0152-1915-2412-3443',
 'Personal|BNC':'0191-0151-7021-0007-0233','Personal|MERCANTIL':'0105-0125-3511-2507-6437',
 'Personal|TESORO':'0163-0402-6140-2301-5436','Personal|VENEZUELA':'0102-0453-4100-0001-5558',
 'Jurídico|ACTIVO':'0171-0017-3660-0063-7611','Jurídico|BANPLUS':'0174-0152-1015-2412-5216',
 'Jurídico|BNC':'0191-0151-7121-0000-2764','Jurídico|MERCANTIL':'0105-0054-1810-5451-2701',
 'Jurídico|PROVINCIAL':'0108-0257-1501-0013-2530','Jurídico|TESORO':'0163-0402-6840-2301-5438',
 'Jurídico|VENEZUELA':'0102-0453-4100-0003-7633'
};
function finBancoClave(c){
 const n=normalizedText(c.Banco||c.Cuenta);
 if(/\bACTIVO\b/.test(n))return 'ACTIVO';
 if(/\bBANPLUS\b/.test(n))return 'BANPLUS';
 if(/\b(BNC|NACIONAL DE CREDITO)\b/.test(n))return 'BNC';
 if(/\b(MERC|MERCANTIL)\b/.test(n))return 'MERCANTIL';
 if(/\b(PROV|PROVINCIAL)\b/.test(n))return 'PROVINCIAL';
 if(/\bTESORO\b/.test(n))return 'TESORO';
 if(/\b(BDV|VENEZUELA)\b/.test(n))return 'VENEZUELA';
 return '';
}
// Migra una sola vez: agrega la columna Numero a FIN_CUENTAS y rellena la de los bancos existentes.
// Escanea la hoja cruda (como finCuentaRow) para tolerar filas vacías intermedias.
function finNumerosCuenta(usuario) {
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  if(ss().getSheetByName('FIN_NUMEROS_20261112'))return;
  const t=finTabla('FIN_CUENTAS');
  let headers=t.headers;
  if(headers.indexOf('Numero')<0){headers=headers.concat(['Numero']);if(t.hoja.getMaxColumns()<headers.length)t.hoja.insertColumnsAfter(t.hoja.getMaxColumns(),headers.length-t.hoja.getMaxColumns());t.hoja.getRange(1,1,1,headers.length).setValues([headers]);}
  const col= headers.indexOf('Numero')+1,idxCuenta=headers.indexOf('Cuenta'),idxBanco=headers.indexOf('Banco'),idxTitular=headers.indexOf('Titularidad');
  if(t.hoja.getLastRow()>=2){
   const crudo=t.hoja.getRange(2,1,t.hoja.getLastRow()-1,headers.length).getValues();
   crudo.forEach(function(r,i){
    if(!String(r[idxCuenta]))return;
    if(String(r[col-1]||'').trim())return;
    const numero=FIN_NUMEROS_CUENTA[accountKind({Titularidad:r[idxTitular]})+'|'+finBancoClave({Banco:r[idxBanco],Cuenta:r[idxCuenta]})];
    if(numero)t.hoja.getRange(i+2,col).setNumberFormat('@').setValue(rfLiteral(numero));
   });
  }
  rfTable('FIN_NUMEROS_20261112',['Version','Fecha','Usuario']).appendRow([1,new Date().toISOString(),usuario||'']);
  SpreadsheetApp.flush();
 }finally{lock.releaseLock();}
}
function finCuentaSave(token,input,operacion) {
 const usuario=finSesion(token),lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  const t=finTabla('FIN_CUENTAS'),plan=bankSavePlan(input,t.rows,operacion),prior=plan.prior;
  const data=Object.assign({},plan.row,{Cuenta:prior?prior.Cuenta:'CTA-'+Utilities.getUuid()});
  let headers=t.headers;
  ['Numero','Logo'].forEach(function(columna){
   if(headers.indexOf(columna)<0){headers=headers.concat([columna]);if(t.hoja.getMaxColumns()<headers.length)t.hoja.insertColumnsAfter(t.hoja.getMaxColumns(),headers.length-t.hoja.getMaxColumns());t.hoja.getRange(1,1,1,headers.length).setValues([headers]);}
  });
  const idx=prior?finCuentaRow(t,prior.Cuenta):t.hoja.getLastRow()+1;
  t.hoja.getRange(idx,1,1,headers.length).setNumberFormat('@').setValues([headers.map(function(k){return rfLiteral(data[k]===undefined?'':data[k]);})]);
  // Cambiar el saldo base desde Bancos invalida el arrastre previo desde ese mes.
  if(prior&&(Number(prior.SaldoInicial)!==data.SaldoInicial||prior.FechaSaldoInicial!==data.FechaSaldoInicial)){
   const sheet=rfTable('FIN_AJUSTES_SALDO',RF_BALANCE_HEADERS),edit={ID:'SAL-'+Utilities.getUuid(),Cuenta:data.Cuenta,Periodo:data.FechaSaldoInicial.slice(0,7),Valor:data.SaldoInicial,Oficial:'',Anterior:prior.SaldoInicial,Fecha:new Date().toISOString(),Usuario:usuario,Motivo:'Saldo base actualizado en Bancos'};
   sheet.appendRow(RF_BALANCE_HEADERS.map(function(k){return rfLiteral(edit[k]===undefined?'':edit[k]);}));
  }
  finCuentaAudit(usuario,prior?'EDITAR':'CREAR',data.Cuenta,prior||null,data);finCuentaClearGlobal();
  finPersistirSaldos(data.Cuenta,finList(),usuario);SpreadsheetApp.flush();return {ok:true,operacion:prior?'editar':'crear',data:finList()};
 }finally{lock.releaseLock();}
}

// Usa la fila real de la hoja, incluso si existen filas vacías intermedias.
function finCuentaRow(table,account){
 if(table.hoja.getLastRow()<2)throw new Error('El banco ya no existe.');
 const column=table.headers.indexOf('Cuenta'),rows=table.hoja.getRange(2,1,table.hoja.getLastRow()-1,table.headers.length).getValues();
 const idx=rows.findIndex(function(r){return String(r[column])===String(account);});
 if(idx<0)throw new Error('El banco ya no existe. Actualiza la lista.');return idx+2;
}
function finCuentaAudit(usuario,accion,cuenta,antes,despues){
 rfTable('FIN_CUENTAS_BITACORA',['Fecha','Usuario','Accion','Cuenta','Antes','Despues']).appendRow([new Date().toISOString(),usuario,accion,cuenta,JSON.stringify(antes),JSON.stringify(despues)].map(rfLiteral));
}
function finCuentaClearGlobal(){
 const t=finTabla('FIN_CONTROL'),idx=t.hoja.getDataRange().getValues().findIndex(function(r,i){return i>0&&r[t.headers.indexOf('Parametro')]==='SaldoInicialGlobal';});
 if(idx>0)t.hoja.getRange(idx+1,t.headers.indexOf('Valor')+1).setValue('');
}
function finCuentaDelete(token,account){
 const usuario=finSesion(token),lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  account=String(account||'');const data=finList(),prior=bankForDeletion(data,account),t=finTabla('FIN_CUENTAS'),row=finCuentaRow(t,account);
  // Nunca se eliminan movimientos, ajustes de saldo ni copias de reportes.
  finCuentaAudit(usuario,'ELIMINAR',account,prior,null);
  t.hoja.deleteRow(row);
  if(ss().getSheetByName('FIN_SALDOS')){
   const balances=finTabla('FIN_SALDOS'),before=balances.hoja.getLastRow()-1,remaining=balances.rows.filter(function(r){return String(r.Cuenta)!==account;}),values=remaining.map(function(r){return balances.headers.map(function(k){return rfLiteral(r[k]===undefined?'':r[k]);});});
   if(values.length)balances.hoja.getRange(2,1,values.length,balances.headers.length).setValues(values);
   if(before>values.length)balances.hoja.getRange(values.length+2,1,before-values.length,balances.headers.length).clearContent();
  }
  finCuentaClearGlobal();SpreadsheetApp.flush();return {ok:true,data:finList()};
 }finally{lock.releaseLock();}
}


// ════════════════════════════════════════════════════════════════
// GESTIÓN ADMINISTRATIVA — libros, cotizaciones, órdenes, pólizas,
// solvencias, comunicaciones y requisiciones sobre pestañas ADM_*.
// Las colecciones y su validación/cálculo viven en el dominio
// compartido (src/lib/adm.ts) que sync-domain añade a Code.gs.
// ════════════════════════════════════════════════════════════════
function admDef(coleccion) {
 const def=ADM_COLECCIONES[coleccion];
 if(!def) throw new Error('Colección desconocida: '+coleccion);
 return def;
}
function admSheet(coleccion) {
 const def=admDef(coleccion);
 return rfTable(def.hoja, def.campos.map(function(c){return c.key;}));
}
function admValor(v) {
 if(v instanceof Date) return Utilities.formatDate(v, ss().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
 if(v===true) return 'SI';
 if(v===false) return 'NO';
 return v===null||v===undefined?'':v;
}
function admRows(coleccion) {
 const def=admDef(coleccion),h=admSheet(coleccion);
 const headers=def.campos.map(function(c){return c.key;});
 const ultima=h.getLastRow(),out=[];
 if(ultima<2)return out;
 h.getRange(2,1,ultima-1,headers.length).getValues().forEach(function(r,i){
  if(!r.join(''))return;
  const o={_fila:2+i};
  headers.forEach(function(k,j){o[k]=admValor(r[j]);});
  out.push(o);
 });
 return out;
}
function admList(coleccionCsv) {
 const hoy=rfToday();
 const pedidas=String(coleccionCsv||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
 const datos={},siguiente={};
 pedidas.forEach(function(c){
  const def=admDef(c); // falla claro si la colección no existe
  datos[c]=admRows(c);
  const sig=admSiguiente(c,datos[c],hoy);
  if(sig)siguiente[c]=sig;
 });
 return {ok:true,hoy:hoy,datos:datos,siguiente:siguiente};
}
function admSave(token,coleccion,datos) {
 const usuario=finSesion(token);
 const def=admDef(coleccion);
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  const filas=admRows(coleccion);
  const preparada=admPreparar(coleccion,datos||{},filas,rfToday());
  if(preparada.error)return {ok:false,msg:preparada.error};
  const fila=preparada.fila;
  const existente=fila.ID?filas.find(function(f){return String(f.ID)===String(fila.ID);}):null;
  if(datos&&datos.ID&&!existente)throw new Error('El registro ya no existe. Actualiza la lista.');
  const h=admSheet(coleccion);
  const headers=def.campos.map(function(c){return c.key;});
  const target=existente?existente._fila:h.getLastRow()+1;
  if(target>h.getMaxRows())h.insertRowsAfter(h.getMaxRows(),target-h.getMaxRows());
  const values=headers.map(function(k){
   const v=fila[k]===undefined||fila[k]===null?'':fila[k];
   return rfLiteral(typeof v==='number'?v:String(v));
  });
  h.getRange(target,1,1,headers.length).setNumberFormat('@').setValues([values]);
  admAudit(usuario,existente?'EDITAR':'CREAR',coleccion,String(fila.ID),existente||null,fila);
  SpreadsheetApp.flush();
  return {ok:true,msg:existente?'Registro actualizado':'Registro creado',id:String(fila.ID)};
 } finally { lock.releaseLock(); }
}
function admDel(token,coleccion,id) {
 const usuario=finSesion(token);
 admDef(coleccion);
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  const filas=admRows(coleccion);
  const fila=filas.find(function(f){return String(f.ID)===String(id);});
  if(!fila)return {ok:false,msg:'El registro ya no existe. Actualiza la lista.'};
  admSheet(coleccion).deleteRow(fila._fila);
  admAudit(usuario,'ELIMINAR',coleccion,String(id),fila,null);
  SpreadsheetApp.flush();
  return {ok:true,msg:'Registro eliminado'};
 } finally { lock.releaseLock(); }
}
function admAudit(usuario,accion,coleccion,id,antes,despues) {
 const sheet=rfTable('ADM_BITACORA',['Fecha','Usuario','Coleccion','Accion','ID','Antes','Despues']);
 sheet.appendRow([new Date().toISOString(),usuario,coleccion,accion,id,
  antes?JSON.stringify(antes):'',despues?JSON.stringify(despues):''].map(rfLiteral));
}
function admResumen() {
 const hoy=rfToday();
 const datos={
  DECLARACIONES:admRows('DECLARACIONES'),
  POLIZAS:admRows('POLIZAS'),
  SOLVENCIAS:admRows('SOLVENCIAS'),
  FACTURAS:admRows('FACTURAS'),
  COMUNICACIONES:admRows('COMUNICACIONES'),
  COTIZACIONES:admRows('COTIZACIONES')
 };
 return Object.assign({ok:true},admCalcularResumen(datos,hoy));
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
    const n = normalizedText(c.Banco || c.Cuenta);
    if (/\b(BDV|VENEZUELA)\b/.test(n))
        return 'Banco de Venezuela';
    if (/\b(BNC|NACIONAL DE CREDITO)\b/.test(n))
        return 'Banco Nacional de Crédito';
    if (/\b(BPL|BPLS|BANPLUS)\b/.test(n))
        return 'Banplus';
    if (/\b(MERC|BMC|MERCANTIL)\b/.test(n))
        return 'Banco Mercantil';
    if (/\b(PROV|BPR|PROVINCIAL)\b/.test(n))
        return 'Banco Provincial';
    return String(c.Banco || 'Banco pendiente');
}
function incompleteMovement(r, data) { const c = data.cuentas.find(c => c.Cuenta === r.Cuenta); return !c || !c.Banco || !accountKind(c); }
function methodTotals(rows) { const totals = {}; rows.filter(r => !isOwnTransfer(r)).forEach(r => { const k = paymentMethod(r.Metodo), t = totals[k] || (totals[k] = { entradas: 0, salidas: 0 }); if (r.Tipo === 'ENTRADA')
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
        const entradas = roundMoney(rows.filter(r => r.Tipo === 'ENTRADA' && !isOwnTransfer(r)).reduce((s, r) => s + Number(r.Monto), 0)), salidas = roundMoney(rows.filter(r => r.Tipo === 'SALIDA' && !isOwnTransfer(r)).reduce((s, r) => s + Number(r.Monto), 0));
        const final = accountBalance(data, account, end), oficial = numericBalance([...(data.ajustes || [])].reverse().find(a => a.Cuenta === account && a.Periodo === p && numericBalance(a.Oficial) !== null)?.Oficial);
        const transferenciasEntrada = roundMoney(rows.filter(r => isOwnTransfer(r) && r.Tipo === 'ENTRADA').reduce((s, r) => s + Number(r.Monto), 0)), transferenciasSalida = roundMoney(rows.filter(r => isOwnTransfer(r) && r.Tipo === 'SALIDA').reduce((s, r) => s + Number(r.Monto), 0));
        result.push({ periodo: p, inicial: initial, entradas, salidas, transferenciasEntrada, transferenciasSalida, final, oficial, discrepancia: oficial !== null && initial !== null && Math.abs(oficial - initial) > 0.000001 });
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
// Clasificar una transferencia nunca elimina su efecto sobre el saldo bancario.
function isOwnTransfer(r) { return ['0001', '0002'].includes(String(r.Codigo)); }
const OWN_TRANSFER_CATEGORIES = [
    { Codigo: '0001', Nombre: 'Transferencias a bancos propios · Entrada', Tipo: 'ENTRADA' },
    { Codigo: '0002', Nombre: 'Transferencias a bancos propios · Salida', Tipo: 'SALIDA' }
];
function validateMovementCategory(r) {
    if ((r.Codigo === '0001' && r.Tipo !== 'ENTRADA') || (r.Codigo === '0002' && r.Tipo !== 'SALIDA'))
        throw new Error('0001 requiere una entrada y 0002 requiere una salida.');
}
function expenseCategories(data, rows) {
    const totals = {};
    rows.filter(r => r.Tipo === 'SALIDA' && !isOwnTransfer(r)).forEach(r => { const k = r.Codigo || ''; totals[k] = roundMoney((totals[k] || 0) + Number(r.Monto)); });
    return Object.entries(totals).map(([codigo, monto]) => ({ codigo, nombre: data.categorias.find(c => c.Codigo === codigo)?.Nombre || 'Sin clasificar', monto })).sort((a, b) => b.monto - a.monto);
}
function withFinanceCategories(data) {
    return { ...data, categorias: [...data.categorias.filter(c => !['0001', '0002'].includes(c.Codigo)), ...OWN_TRANSFER_CATEGORIES] };
}
function migrateFinance2026(data, initialBalances) {
    data = withFinanceCategories(data);
    if (data.control.Base2026Version === 1)
        return data;
    const cuentas = data.cuentas.map(c => { const value = initialBalances[accountKind(c) + '|' + bankName(c)]; return value === undefined ? c : { ...c, Banco: bankName(c), SaldoInicial: value, FechaSaldoInicial: '2026-01-01' }; });
    // El nuevo anclaje oficial sustituye los ajustes previos en el cálculo, conservados en el historial.
    const now = new Date().toISOString();
    const edits = cuentas.filter(c => initialBalances[accountKind(c) + '|' + bankName(c)] !== undefined).map(c => ({ ID: 'BASE2026-' + c.Cuenta, Cuenta: c.Cuenta, Periodo: '2026-01', Valor: Number(c.SaldoInicial), Oficial: Number(c.SaldoInicial), Usuario: 'Sistema', Fecha: now, Motivo: 'Saldo base oficial de enero de 2026' }));
    return { ...data, cuentas, ajustes: [...(data.ajustes || []), ...edits], control: { ...data.control, Base2026Version: 1, FechaSaldoInicial: '2026-01-01', SaldoInicialGlobal: '' } };
}
function emptyFinance() { return withFinanceCategories({ cuentas: [], movimientos: [], categorias: [], ajustes: [], control: { Base2026Version: 1, FechaSaldoInicial: '2026-01-01', CorteHistorico: '2026-01-01', Moneda: 'Bs', SaldoInicialGlobal: '' } }); }
function validateBankAccount(input, existing) {
    if (typeof input.Banco !== 'string' || !input.Banco.trim() || !accountKind(input) || numericBalance(input.SaldoInicial) === null)
        throw new Error('Completa banco, titularidad y saldo inicial (cero es válido).');
    const numero = String(input.Numero ?? '').trim();
    if (!numero)
        throw new Error('Completa el número de cuenta: es obligatorio para identificar cada banco.');
    if (numero.replace(/[\s-]/g, '').length < 4)
        throw new Error('El número de cuenta parece incompleto (4 dígitos como mínimo).');
    civilDate(input.FechaSaldoInicial);
    if (input.FechaSaldoInicial.slice(8) !== '01')
        throw new Error('La fecha del saldo base debe ser el primer día del mes.');
    if (existing.some(c => String(c.Cuenta) !== String(input.Cuenta) && normalizedText(bankName(c)) === normalizedText(bankName(input)) && accountKind(c) === accountKind(input)))
        throw new Error('Ese banco ya está registrado para esta titularidad. Abre su registro y utiliza «Editar».');
    if (input.Logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.Logo))
        throw new Error('Utiliza un logo PNG, JPEG o WebP.');
    if ((input.Logo || '').length > 45000)
        throw new Error('El logo debe ocupar menos de 32 KB.');
    return { ...input, Numero: numero, Banco: input.Banco.trim(), Moneda: 'Bs', Titularidad: accountKind(input), SaldoInicial: Number(input.SaldoInicial) };
}
function bankSavePlan(input, existing, operation) {
    if (!input || typeof input !== 'object')
        throw new Error('Faltan los datos del banco.');
    const id = String(input.Cuenta || '').trim(), mode = operation || (id ? 'editar' : 'crear');
    if (!['crear', 'editar'].includes(mode))
        throw new Error('Operación de banco no válida.');
    if (mode === 'editar' && !id)
        throw new Error('Falta el identificador del banco que quieres editar. No se creó otro registro.');
    if (mode === 'crear' && id)
        throw new Error('Para cambiar un banco existente, utiliza «Editar».');
    const matches = existing.filter(c => String(c.Cuenta) === id), prior = mode === 'editar' ? matches[0] : undefined;
    if (mode === 'editar' && (!prior || matches.length !== 1))
        throw new Error('El banco ya no existe o su identificador está repetido. Actualiza la lista antes de editar.');
    return { prior, operation: mode, row: validateBankAccount({ ...prior, ...input, Cuenta: prior ? prior.Cuenta : '' }, existing) };
}
function bankForDeletion(data, account) {
    const row = data.cuentas.find(c => String(c.Cuenta) === String(account));
    if (!row)
        throw new Error('El banco ya no existe. Actualiza la lista.');
    const count = data.movimientos.filter(r => String(r.Cuenta) === String(account)).length;
    if (count)
        throw new Error('Este banco tiene ' + count + ' movimiento(s) registrado(s). No se puede eliminar porque se perdería su vínculo con los saldos y reportes.');
    return row;
}
// END SHARED BUSINESS DOMAIN

// BEGIN SHARED ADM DOMAIN
// ════════════════════════════════════════════════════════════════
// GESTIÓN ADMINISTRATIVA — dominio compartido.
// Fuente única para el frontend y para Apps Script: scripts/sync-domain.cjs
// la transpila y la integra al final de apps-script/Code.gs.
// Sin imports con valor y sin acceso a ventana/navegador: solo lógica pura.
// ════════════════════════════════════════════════════════════════
// ────────────────────────────────────────────────────────────
// Catálogos fijos (etiquetas de la empresa)
// ────────────────────────────────────────────────────────────
const ADM_ETIQUETAS = {
    I: "Interna", E: "Externa",
    OP: "Operaciones", AD: "Administración", DIR: "Dirección",
};
const ADM_DIRECCIONES = ["I", "E"];
const ADM_DEPARTAMENTOS = ["OP", "AD", "DIR"];
const ADM_TIPOS_SOLVENCIA = [
    "Seguro Social (IVSS)", "Seguridad PDVSA", "Ambiente", "Bomberos",
    "Alcaldía", "RACDA", "RUPDAE", "Otro",
];
const ADM_TIPOS_COMUNICACION = [
    "Carta", "Oferta", "Solicitud", "Circular", "SSO", "Banahvi", "Requisición", "Otro",
];
const ADM_MODELOS_REQUISICION = ["Oficina", "Activo fijo", "Consumible", "Servicio", "Genérica"];
const ADM_IMPUESTOS = ["ISLR", "IVA", "Retenciones ISLR", "Retenciones IVA"];
/** Retención de ISLR sobre recibos eventuales: 2 % servicios · 1 % honorarios (criterio de administración). */
const ADM_RETENCION_RECIBO = { Servicio: 0.02, Honorarios: 0.01 };
/** Portales oficiales para consulta de RIF y solvencias (enlaces verificados). */
const ADM_PORTALES = [
    { nombre: "SENIAT · Portal fiscal", url: "https://www.seniat.gob.ve" },
    { nombre: "SENIAT · Consulta de RIF con cédula", url: "https://dgpatrimonios.seniat.gob.ve/registro/contribuyente" },
    { nombre: "IVSS · Trámites y consultas", url: "https://www.ivss.gov.ve" },
];
const campo = (key, label, tipo, extra = {}) => ({ key, label, tipo, ...extra });
const ACTUALIZADO = campo("Actualizado", "Actualizado", "fecha", { oculto: true, autogenerado: true });
// ────────────────────────────────────────────────────────────
// Colecciones (una pestaña por cada una; los "headers" del sheet
// son las claves, como en PAGOS y FIN_*)
// ────────────────────────────────────────────────────────────
const ADM_COLECCIONES = {
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
function admR2(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }
function admNumero(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function admDias(fecha, hoy) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha ?? ""));
    const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(hoy ?? ""));
    if (!m || !b)
        return null;
    const a = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const c = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
    return Math.round((a - c) / 86400000);
}
/** Situación de una declaración: alertas 5 días antes y 1 día antes. */
function admEstadoDeclaracion(fila, hoy) {
    if (String(fila.Estatus ?? "") === "Declarada" || fila.FechaDeclarada) {
        return { estado: "Declarada", alerta: "declarada", dias: null };
    }
    const dias = admDias(fila.FechaLimite, hoy);
    if (dias === null)
        return { estado: "Sin fecha", alerta: "sinfecha", dias: null };
    if (dias < 0)
        return { estado: "Vencida", alerta: "vencida", dias };
    if (dias === 0)
        return { estado: "Vence hoy", alerta: "hoy", dias };
    if (dias === 1)
        return { estado: "Vence mañana", alerta: "manana", dias };
    if (dias <= 5)
        return { estado: `En ${dias} días`, alerta: "cinco", dias };
    return { estado: "Programada", alerta: "ok", dias };
}
/** Vigencia de pólizas y solvencias: por vencer dentro de 30 días. */
function admVigencia(vencimiento, hoy) {
    const dias = admDias(vencimiento, hoy);
    if (dias === null)
        return "Sin fecha";
    if (dias < 0)
        return "Vencida";
    if (dias <= 30)
        return "Por vencer";
    return "Vigente";
}
/** Máximo consecutivo ya usado para un prefijo y año (código CS-2026-I-AD-00042 → 42). */
function admConsecutivo(filas, campoCodigo, prefijo, anio) {
    const re = new RegExp("^" + prefijo + "-" + anio + "-(?:[A-Z]{1,3}-){0,2}(\\d+)$");
    let max = 0;
    filas.forEach(function (f) {
        const m = String(f[campoCodigo] ?? "").match(re);
        if (m)
            max = Math.max(max, Number(m[1]));
    });
    return max;
}
function admPad(n, ancho) {
    return String(Math.max(1, n)).padStart(ancho, "0");
}
/** Vista previa del siguiente código (comunicaciones: CS-2026-[I|E]-[OP|AD|DIR]-00042). */
function admSiguiente(coleccion, filas, hoy) {
    const def = ADM_COLECCIONES[coleccion];
    if (!def || !def.consecutivo)
        return "";
    const anio = Number(String(hoy).slice(0, 4)) || 2000;
    const n = admConsecutivo(filas, def.consecutivo.campo, def.consecutivo.prefijo, anio) + 1;
    const cuerpo = def.consecutivo.comunicacion ? "[I|E]-[OP|AD|DIR]-" : "";
    return def.consecutivo.prefijo + "-" + anio + "-" + cuerpo + admPad(n, def.consecutivo.ancho);
}
/** Código definitivo de comunicaciones: CS-2026-I-AD-00042. */
function admCodigoComunicacion(anio, direccion, departamento, n, ancho) {
    return "CS-" + anio + "-" + (direccion || "I") + "-" + (departamento || "AD") + "-" + admPad(n, ancho);
}
/** Validación común (frontend antes de guardar; backend dentro del bloqueo). */
function admValidar(coleccion, fila) {
    const def = ADM_COLECCIONES[coleccion];
    if (!def)
        return "Colección desconocida: " + coleccion;
    for (const c of def.campos) {
        if (c.autogenerado || c.oculto)
            continue;
        const v = fila[c.key];
        const s = String(v ?? "").trim();
        if (c.requerido && !s)
            return c.label + " es obligatorio";
        if (!s)
            continue;
        if (c.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(s))
            return c.label + ": usa el formato de fecha del calendario";
        if (c.tipo === "numero") {
            const n = Number(s);
            if (!Number.isFinite(n) || n < 0)
                return c.label + " debe ser un número válido";
            if (c.min !== undefined && n < c.min)
                return c.label + " no puede ser menor que " + c.min;
            if (c.max !== undefined && n > c.max)
                return c.label + " no puede ser mayor que " + c.max;
        }
        if (c.tipo === "select" && c.opciones && !c.opciones.includes(s))
            return c.label + ": valor no válido";
        if (s.length > 600)
            return c.label + " es demasiado extenso";
    }
    if (coleccion === "RECIBOS" && !(Number(fila.PctRetencion) > 0)) {
        return "Indica el % de retención de ISLR (2 % servicio · 1 % honorarios)";
    }
    return "";
}
/** Campos calculados en un solo lugar (frontend y backend). */
function admCalcularFila(coleccion, fila) {
    const r = { ...fila };
    if (coleccion === "COMPRAS")
        r.Total = admR2(admNumero(r.Base) + admNumero(r.IVA));
    if (coleccion === "FACTURAS") {
        r.Total = admR2(admNumero(r.Base) + admNumero(r.IVA));
        r.Saldo = admR2(admNumero(r.Total) - admNumero(r.MontoCobrado));
    }
    if (coleccion === "RECIBOS") {
        r.Retencion = admR2(admNumero(r.Monto) * admNumero(r.PctRetencion));
        r.Neto = admR2(admNumero(r.Monto) - admNumero(r.Retencion));
    }
    if (coleccion === "ORDENES")
        r.PorCobrar = admR2(admNumero(r.Monto) - admNumero(r.Cobrado));
    return r;
}
/**
 * Prepara la fila para guardar: valida, calcula y asigna el código consecutivo.
 * `existente` conserva su código original (nunca se renumera).
 */
function admPreparar(coleccion, datos, filas, hoy) {
    const error = admValidar(coleccion, datos);
    if (error)
        return { fila: datos, error };
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
    if (existente)
        r.ID = existente.ID;
    r.Actualizado = new Date().toISOString();
    return { fila: r, error: "" };
}
function admCalcularResumen(datos, hoy) {
    const anio = String(hoy).slice(0, 4);
    const declaraciones = (datos.DECLARACIONES || [])
        .filter(function (f) { return String(f.Estatus ?? "") !== "Declarada" && !f.FechaDeclarada; })
        .map(function (f) { const s = admEstadoDeclaracion(f, hoy); const out = { ...f, estado: s.estado, alerta: s.alerta, dias: s.dias }; return out; })
        .sort(function (a, b) { return String(a.FechaLimite ?? "").localeCompare(String(b.FechaLimite ?? "")); });
    const vencimientos = [];
    (datos.POLIZAS || []).forEach(function (f) {
        const estado = admVigencia(f.Hasta, hoy);
        if (estado === "Vigente")
            return;
        vencimientos.push({ coleccion: "Pólizas y seguros", tipo: String(f.Tipo ?? ""), numero: String(f.Numero ?? f.Aseguradora ?? ""), vencimiento: String(f.Hasta ?? ""), estado, dias: admDias(f.Hasta, hoy) });
    });
    (datos.SOLVENCIAS || []).forEach(function (f) {
        const estado = admVigencia(f.Vencimiento, hoy);
        if (estado === "Vigente")
            return;
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
        if (n > ultimoNum || (n < 0 && String(f.ID ?? "") > ultimo)) {
            ultimoNum = n;
            ultimo = String(f.ID ?? "");
        }
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
function admDinero(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0)
        return "—";
    return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
// END SHARED ADM DOMAIN

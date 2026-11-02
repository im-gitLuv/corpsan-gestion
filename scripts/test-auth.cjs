const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const sheets = new Map(), properties = new Map(), cache = new Map();
let nextId = 0;
function sheet() {
  const rows = [];
  return {
    rows, getLastRow: () => rows.length, setFrozenRows() {}, appendRow: row => rows.push([...row]),
    getRange(row, col, height = 1, width = 1) {
      return {
        getValues: () => Array.from({length:height}, (_, i) => Array.from({length:width}, (_, j) => rows[row-1+i]?.[col-1+j] ?? '')),
        setValues(values) { values.forEach((valuesRow, i) => { rows[row-1+i] ||= []; valuesRow.forEach((v,j) => rows[row-1+i][col-1+j] = v); }); return this; },
        setValue(value) { rows[row-1] ||= []; rows[row-1][col-1] = value; return this; },
      };
    },
  };
}
const book = { getSheetByName: name => sheets.get(name), insertSheet: name => { const value = sheet(); sheets.set(name, value); return value; } };
const context = {
  Date, JSON, Math, Number, String, Array, Object, Map, Set, console,
  SpreadsheetApp: { openById: () => book },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) || null, setProperty: (key, value) => properties.set(key, value), deleteProperty: key => properties.delete(key) }) },
  CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
  Utilities: { getUuid: () => `test-id-${++nextId}`, computeHmacSha256Signature: (value, key) => Array.from(crypto.createHmac('sha256', key).update(value).digest()) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), context);
const call = body => JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).text);
const salt = 'a'.repeat(32), proof = 'b'.repeat(64), secondSalt = 'c'.repeat(32), secondProof = 'd'.repeat(64);
assert.equal(context.authStatus().needsSetup, true);
assert.equal(call({action:'register',usuario:'owner',nombre:'Owner CorpSan',salt,proof}).ok, false);
properties.set('SETUP_CODE', 'a'.repeat(32));
assert.equal(call({action:'register',usuario:'owner',nombre:'Owner CorpSan',salt,proof,setupCode:'wrong'}).ok, false);
assert.equal(call({action:'register',usuario:'owner',nombre:'Owner CorpSan',salt,proof,setupCode:'a'.repeat(32)}).estado, 'Activo');
assert.equal(properties.has('SETUP_CODE'), false);
assert.equal(sheets.get('USUARIOS').rows[1][6] === proof, false);
assert.equal(context.authStatus().needsSetup, false);
assert.equal(call({action:'login',usuario:'owner',proof:'0'.repeat(64)}).ok, false);
const owner = call({action:'login',usuario:'owner',proof});
assert.equal(owner.ok, true);
assert.equal(owner.rol, 'Administrador');
assert.equal(call({action:'list',hoja:'activos'}).ok, false);
assert.equal(call({action:'register',usuario:'new.user',nombre:'New User',salt:secondSalt,proof:secondProof}).estado, 'Pendiente');
assert.equal(call({action:'login',usuario:'new.user',proof:secondProof}).ok, false);
assert.equal(call({action:'users_list',token:owner.token}).users.length, 2);
assert.equal(call({action:'users_update',token:owner.token,usuario:'new.user',estado:'Activo'}).ok, true);
const newcomer = call({action:'login',usuario:'new.user',proof:secondProof});
assert.equal(newcomer.ok, true);
assert.equal(call({action:'users_update',token:owner.token,usuario:'new.user',estado:'Suspendido'}).ok, true);
assert.throws(() => context.finSesion(newcomer.token), /acceso/);
assert.equal(call({action:'change_password',token:owner.token,oldProof:'0'.repeat(64),salt:secondSalt,proof:secondProof}).ok, false);
assert.equal(call({action:'change_password',token:owner.token,oldProof:proof,salt:secondSalt,proof:secondProof}).ok, true);
assert.throws(() => context.finSesion(owner.token), /acceso/);
assert.equal(call({action:'login',usuario:'owner',proof:proof}).ok, false);
assert.equal(call({action:'login',usuario:'owner',proof:secondProof}).ok, true);
assert.equal(JSON.parse(context.doGet({parameter:{action:'list',hoja:'activos'}}).text).ok, false);
console.log('AUTH PASS: instalación única, verificador no reversible en Sheet, aprobación, suspensión, sesión y cambio de clave.');

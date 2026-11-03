const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const sheets = new Map(), properties = new Map(), cache = new Map(), emails = [];
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
  MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (to, subject, body) => emails.push({to,subject,body}) },
  Logger: { log() {} },
  Utilities: { getUuid: () => crypto.randomUUID(), computeHmacSha256Signature: (value, key) => Array.from(crypto.createHmac('sha256', key).update(value).digest()), computeHmacSha1Signature: (value, key) => Array.from(crypto.createHmac('sha1', Buffer.from(key)).update(Buffer.from(value)).digest()) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), context);
assert.equal(context.authTotpValue(context.authBase32(Array.from(Buffer.from('12345678901234567890'))), 1), '287082'); // RFC 6238, instante 59 s, últimos 6 dígitos.
const call = body => JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).text);
const salt = 'a'.repeat(32), proof = 'b'.repeat(64), secondSalt = 'c'.repeat(32), secondProof = 'd'.repeat(64);
assert.equal(context.authStatus().needsSetup, true);
assert.equal(call({action:'register',usuario:'owner',nombre:'Owner CorpSan',salt,proof}).ok, false);
properties.set('SETUP_CODE', 'a'.repeat(32));
assert.equal(call({action:'register',usuario:'owner',nombre:'Owner CorpSan',salt,proof,setupCode:'wrong'}).ok, false);
assert.equal(call({action:'register',usuario:'owner',nombre:'Owner CorpSan',email:'owner@example.com',salt,proof,setupCode:'a'.repeat(32)}).estado, 'Activo');
const emailCode = () => emails.at(-1).body.match(/\b\d{8}\b/)[0];
assert.equal(call({action:'login',usuario:'owner',proof}).ok, false);
assert.equal(call({action:'email_confirm',usuario:'owner',code:emailCode()}).ok, true);
assert.equal(properties.has('SETUP_CODE'), false);
assert.equal(sheets.get('USUARIOS').rows[1][6] === proof, false);
assert.equal(context.authStatus().needsSetup, false);
assert.equal(call({action:'login',usuario:'owner',proof:'0'.repeat(64)}).ok, false);
const owner = call({action:'login',usuario:'owner',proof});
assert.equal(owner.ok, true);
assert.equal(owner.rol, 'Administrador');
assert.equal(call({action:'list',hoja:'activos'}).ok, false);
assert.equal(call({action:'register',usuario:'new.user',nombre:'New User',email:'new@example.com',salt:secondSalt,proof:secondProof}).estado, 'Pendiente');
assert.equal(call({action:'login',usuario:'new.user',proof:secondProof}).ok, false);
assert.equal(call({action:'users_update',token:owner.token,usuario:'new.user',estado:'Activo'}).ok, false);
assert.equal(call({action:'email_resend',usuario:'new.user'}).ok, true);
assert.equal(call({action:'email_confirm',usuario:'new.user',code:emailCode()}).ok, true);
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
assert.equal(call({action:'password_reset_request',email:'owner@example.com'}).ok, true);
assert.equal(call({action:'password_reset',email:'owner@example.com',code:'00000000',salt,proof}).ok, false);
assert.equal(call({action:'password_reset',email:'owner@example.com',code:emailCode(),salt,proof}).ok, true);
const restored = call({action:'login',usuario:'owner',proof});
assert.equal(restored.ok, true);
const trusted = call({action:'login',usuario:'owner',proof,trustDevice:true});
assert.equal(trusted.trusted, true);
assert.equal(call({action:'auth_validate',token:trusted.token}).ok, true);
assert.equal(call({action:'logout',token:trusted.token}).ok, true);
assert.equal(call({action:'auth_validate',token:trusted.token}).ok, false);
const totp = call({action:'totp_start',token:restored.token});
assert.equal(totp.ok, true);
const step = Math.floor(Date.now()/30000);
const totpCode = context.authTotpValue(totp.secret,step);
const enabled = call({action:'totp_confirm',token:restored.token,code:totpCode});
assert.equal(enabled.ok, true);
assert.equal(enabled.backupCodes.length, 8);
assert.throws(() => context.finSesion(restored.token), /acceso/);
const mfa = call({action:'login',usuario:'owner',proof});
assert.equal(mfa.mfaRequired, true);
assert.equal(call({action:'login_mfa',challenge:mfa.challenge,code:'000000'}).ok, false);
assert.equal(call({action:'login_mfa',challenge:mfa.challenge,code:totpCode}).ok, false); // Código usado durante la activación no se reutiliza.
const nextCode = context.authTotpValue(totp.secret,step+1);
assert.equal(call({action:'login_mfa',challenge:mfa.challenge,code:nextCode}).ok, true);
const backupChallenge = call({action:'login',usuario:'owner',proof});
assert.equal(call({action:'login_mfa',challenge:backupChallenge.challenge,code:enabled.backupCodes[0]}).ok, true);
const usedBackupChallenge = call({action:'login',usuario:'owner',proof});
assert.equal(call({action:'login_mfa',challenge:usedBackupChallenge.challenge,code:enabled.backupCodes[0]}).ok, false);
cache.delete('auth_reset_rate_'+context.authRows().find(r => r.Usuario==='owner').ID);
assert.equal(call({action:'password_reset_request',email:'owner@example.com'}).ok, true);
assert.equal(call({action:'password_reset',email:'owner@example.com',code:emailCode(),totp:enabled.backupCodes[1],salt:secondSalt,proof:secondProof}).ok, true);
assert.equal(call({action:'auth_validate',token:restored.token}).ok, false);
const legacySalt = 'e'.repeat(32), legacyProof = 'f'.repeat(64);
const legacyNow = new Date().toISOString();
sheets.get('USUARIOS').appendRow([crypto.randomUUID(),'legacy','Legacy Admin','Administrador','Activo',legacySalt,context.authVerifier('legacy',legacySalt,legacyProof),legacyNow,legacyNow,'']);
assert.equal(call({action:'login',usuario:'legacy',proof:legacyProof}).ok, true);
properties.set('RECOVERY_USER','legacy');properties.set('RECOVERY_EMAIL','legacy@example.com');
context.prepararRecuperacionDeCuenta();
assert.equal(properties.has('RECOVERY_USER'), false);
assert.equal(call({action:'email_confirm',usuario:'legacy',code:emailCode()}).ok, true);
assert.equal(call({action:'password_reset_request',email:'legacy@example.com'}).ok, true);
assert.equal(call({action:'password_reset',email:'legacy@example.com',code:emailCode(),salt,proof}).ok, true);
assert.equal(JSON.parse(context.doGet({parameter:{action:'list',hoja:'activos'}}).text).ok, false);
console.log('AUTH PASS: correo verificado, recuperación, rescate de cuenta antigua, sesión persistente, TOTP RFC 6238 y respaldos de un solo uso.');

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
function finCuentaSave(token,input) {
 const usuario=finSesion(token),lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  const t=finTabla('FIN_CUENTAS'), prior=t.rows.find(function(c){return c.Cuenta===input.Cuenta;});
  if(input.Cuenta&&!prior)throw new Error('La cuenta ya no existe. Actualiza antes de continuar.');
  const data=validateBankAccount(Object.assign({},input,{Cuenta:prior?prior.Cuenta:'CTA-'+Utilities.getUuid()}),t.rows);
  let headers=t.headers;
  if(headers.indexOf('Logo')<0){headers=headers.concat(['Logo']);if(t.hoja.getMaxColumns()<headers.length)t.hoja.insertColumnsAfter(t.hoja.getMaxColumns(),headers.length-t.hoja.getMaxColumns());t.hoja.getRange(1,1,1,headers.length).setValues([headers]);}
  const idx=prior?t.rows.findIndex(function(c){return c.Cuenta===prior.Cuenta;})+2:t.hoja.getLastRow()+1;
  t.hoja.getRange(idx,1,1,headers.length).setNumberFormat('@').setValues([headers.map(function(k){return rfLiteral(data[k]===undefined?'':data[k]);})]);
  // Cambiar el saldo base desde Bancos invalida el arrastre previo desde ese mes.
  if(prior&&(Number(prior.SaldoInicial)!==data.SaldoInicial||prior.FechaSaldoInicial!==data.FechaSaldoInicial)){
   const sheet=rfTable('FIN_AJUSTES_SALDO',RF_BALANCE_HEADERS),edit={ID:'SAL-'+Utilities.getUuid(),Cuenta:data.Cuenta,Periodo:data.FechaSaldoInicial.slice(0,7),Valor:data.SaldoInicial,Oficial:'',Anterior:prior.SaldoInicial,Fecha:new Date().toISOString(),Usuario:usuario,Motivo:'Saldo base actualizado en Bancos'};
   sheet.appendRow(RF_BALANCE_HEADERS.map(function(k){return rfLiteral(edit[k]===undefined?'':edit[k]);}));
  }
  finPersistirSaldos(data.Cuenta,finList(),usuario);SpreadsheetApp.flush();return {ok:true,data:finList()};
 }finally{lock.releaseLock();}
}

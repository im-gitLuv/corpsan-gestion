const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const modules={};function load(name){if(modules[name])return modules[name];const context={exports:{},require:n=>load(n.replace('./','')),Date,Intl,console,setTimeout};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);return modules[name]=context.exports;}
const initialBalances=vm.runInNewContext('('+fs.readFileSync('apps-script/features.js','utf8').match(/const FIN_INITIAL_BALANCES_2026 = (\{[\s\S]*?\n\});/)[1]+')');
const b=load('business'),f=load('finanzas'),r=load('conciliacion');
const account=(Cuenta,Banco,Titularidad,SaldoInicial=0)=>({Cuenta,Banco,Titularidad,SaldoInicial,FechaSaldoInicial:'2026-01-01',Moneda:'Bs'});
const move=(ID,Cuenta,Tipo,Monto,Codigo='',Fecha='2026-01-10')=>({ID,Cuenta,Tipo,Monto,Codigo,Fecha,Concepto:'Compra / cobro',Referencia:'000123',Metodo:'Transferencia',Conciliado:'Pendiente',Origen:'Excel',Fuente:'ARCHIVO PRIVADO',Revision:'',Factura:'',Contraparte:'',TraspasoID:'',Actualizado:''});
const data=b.withFinanceCategories({cuentas:[account('BDV JUR','BDV','Jurídica',1000),account('BNC JUR','BNC','Jurídica',100)],movimientos:[move('in','BDV JUR','ENTRADA',500),move('out','BDV JUR','SALIDA',100,'2200'),move('own-out','BDV JUR','SALIDA',300,'0002'),move('own-in','BNC JUR','ENTRADA',300,'0001')],categorias:[{Codigo:'2200',Nombre:'Oficina',Tipo:'SALIDA'}],ajustes:[],control:{FechaSaldoInicial:'2026-01-01',CorteHistorico:'2026-08-31',SaldoInicialGlobal:1100}});
assert.equal(f.flujos(data.movimientos).entradas,500);assert.equal(f.flujos(data.movimientos).salidas,100);
assert.equal(b.accountBalance(data,'BDV JUR','2026-01-31'),1100);assert.equal(b.accountBalance(data,'BNC JUR','2026-01-31'),400);
assert.equal(b.accountMonths(data,'BDV JUR','2026-02-28')[1].inicial,1100);
assert.equal(f.mesesFin(data,['BDV JUR'],'2026-02-28')[0].salidas,100);
assert.equal(f.mesesFin(data,['BDV JUR'],'2026-02-28')[0].transferenciasSalida,300);
assert.equal(b.methodTotals(data.movimientos).Transferencia.salidas,100);
assert.equal(b.expenseCategories(data,data.movimientos)[0].monto,100);
assert.throws(()=>b.validateMovementCategory({Codigo:'0001',Tipo:'SALIDA'}));
assert.throws(()=>b.validateMovementCategory({Codigo:'0002',Tipo:'ENTRADA'}));
for(const banco of ['',b.bankName(data.cuentas[0])]){
 const request={tipo:'Jurídico',desde:'2026-01-01',hasta:'2026-01-31',modo:'mes',banco};
 const copy={version:2,periodo:'2026-01',creado:new Date().toISOString(),usuario:'test',seleccion:request,data:b.reportData(data,request,'2026-11-06')},totals=r.resumenCierre(copy);
 assert.equal(totals.final,b.roundMoney(totals.inicial+totals.variacionBancaria+totals.ajustes));
 const html=r.documentoCierre(copy),csv=r.csvCierre(copy);
 assert(html.includes('Gastos por categoría'));assert(csv.includes('Oficina'));
 for(const text of ['ARCHIVO PRIVADO','BDV JUR','Método original','Trazabilidad','Fuente']){assert(!html.includes(text),text);assert(!csv.includes(text),text);}
}
const accounts=Object.entries(initialBalances).map(([key],i)=>{const[kind,bank]=key.split('|');return account('legacy-'+i,bank,kind,'');});
const old={...data,cuentas:accounts,movimientos:[],ajustes:[{ID:'old',Cuenta:'legacy-0',Periodo:'2026-08',Valor:999,Oficial:'',Usuario:'test',Fecha:'',Motivo:''}]};
const migrated=b.migrateFinance2026(old,initialBalances);assert.equal(migrated.cuentas.reduce((s,c)=>s+c.SaldoInicial,0),89917.9);
for(const c of migrated.cuentas){assert.equal(b.accountBalance(migrated,c.Cuenta,'2026-11-06'),initialBalances[b.accountKind(c)+'|'+b.bankName(c)]);assert.equal(b.accountMonths(migrated,c.Cuenta,'2026-11-06').length,11);}
assert.equal(migrated.ajustes[0].ID,'old');assert.equal(b.migrateFinance2026(migrated,initialBalances).ajustes.length,migrated.ajustes.length);
const changed={...migrated,ajustes:[...migrated.ajustes,{ID:'new',Cuenta:'legacy-0',Periodo:'2026-01',Valor:5,Oficial:'',Usuario:'test',Fecha:'',Motivo:''}]};assert.equal(b.accountBalance(b.migrateFinance2026(changed,initialBalances),'legacy-0','2026-11-06'),5);
assert.equal(b.emptyFinance().cuentas.length,0);assert.equal(b.emptyFinance().movimientos.length,0);
const custom=account('custom','Mi banco nuevo','Personal',0);assert.equal(b.validateBankAccount(custom,[]).Banco,'Mi banco nuevo');assert.throws(()=>b.validateBankAccount({...custom,Logo:'javascript:alert(1)'},[]));assert.throws(()=>b.validateBankAccount({...custom,Cuenta:'new'},[custom]));
// Integración del backend con hojas simuladas: migración única, edición de cargas anteriores y alta de banco.
const tables=new Map();function sheet(headers){const rows=[headers];return {rows,deleteRow:n=>rows.splice(n-1,1),appendRow:r=>rows.push([...r]),setFrozenRows(){},getLastRow:()=>rows.length,getMaxRows:()=>1000,getMaxColumns:()=>26,getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),getRange:(row,col,n=1,width=1)=>{const range={getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),setValues:vs=>{vs.forEach((v,i)=>{rows[row-1+i]||=[];v.forEach((x,j)=>rows[row-1+i][col-1+j]=x);});return range;},clearContent:()=>{for(let i=0;i<n;i++)for(let j=0;j<width;j++)if(rows[row-1+i])rows[row-1+i][col-1+j]="";return range;},setNumberFormat:()=>range,setValue:v=>{rows[row-1]||=[];rows[row-1][col-1]=v;}};return range;}};}
let id=0;const book={getSheetByName:n=>tables.get(n),insertSheet:n=>{const s=sheet([]);s.rows.length=0;tables.set(n,s);return s;}};
const backend={Date,Math,JSON,console,Number,Object,Array,Map,Set,Utilities:{formatDate:()=> '2026-11-06',getUuid:()=>String(++id)},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},SpreadsheetApp:{openById:()=>book,flush(){}}};
vm.createContext(backend);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),backend);backend.ss=()=>book;backend.finSesion=t=>{if(t!=='test')throw Error('Sesión inválida');return 'admin';};
const seed=(name,headers,rows)=>{const s=sheet(headers);for(const r of rows)s.appendRow(headers.map(k=>r[k]??''));tables.set(name,s);};
seed('FIN_CUENTAS',['Cuenta','Banco','Titularidad','Moneda','SaldoInicial','FechaSaldoInicial'],accounts);
seed('FIN_CONTROL',['Parametro','Valor'],Object.entries(old.control).map(([Parametro,Valor])=>({Parametro,Valor})));
seed('FIN_CATEGORIAS',['Codigo','Nombre','Tipo'],data.categorias);
seed('FIN_MOVIMIENTOS',Object.keys(move('x','legacy-0','SALIDA',10)),[move('x','legacy-0','SALIDA',10)]);
// El contrato de columnas debe coincidir con el orden canónico del backend.
const headers=vm.runInContext('FIN_HEADERS',backend);seed('FIN_MOVIMIENTOS',headers,[move('x','legacy-0','SALIDA',10)]);
backend.finPrepare2026('admin');assert.equal(backend.finList().control.Base2026Version,1);assert.equal(backend.finList().cuentas[0].SaldoInicial,3496.42);assert.equal(backend.finList().movimientos.length,1);
const editCount=backend.finList().ajustes.length;backend.finPrepare2026('admin');assert.equal(backend.finList().ajustes.length,editCount);
const saved=backend.finSave('test',{...backend.finList().movimientos[0],Monto:25,Concepto:'Editado en sistema',Codigo:'0002'});assert(saved.ok);assert.equal(backend.finList().movimientos[0].Monto,25);assert.equal(backend.finList().movimientos[0].Codigo,'0002');assert.equal(backend.finTabla('FIN_SALDOS').rows.find(r=>r.Cuenta==='legacy-0'&&r.Periodo==='2026-01').Egresos,0);
assert.throws(()=>backend.finSave('test',{...backend.finList().movimientos[0],Codigo:'0001'}));assert.throws(()=>backend.finCuentaSave('bad',custom));
assert(backend.finCuentaSave('test',{...custom,Cuenta:''}).ok);assert.equal(backend.finList().cuentas.length,9);
const count=backend.finList().movimientos.length;backend.finCuentaSave('test',{...backend.finList().cuentas[0],SaldoInicial:55});assert.equal(backend.accountBalance(backend.finList(),'legacy-0','2026-11-06'),30);assert.equal(backend.finList().movimientos.length,count);

backend.ok=value=>value;
const dispatch=(action,extra={})=>backend.doPost({postData:{contents:JSON.stringify({action,token:'test',...extra})}});
const routeCount=backend.finList().cuentas.length;
assert(dispatch('fin_cuenta',{operacion:'editar',data:{Cuenta:'legacy-0',SaldoInicial:55}}).ok);assert.equal(backend.finList().cuentas.length,routeCount);assert.equal(backend.finList().bancosVersion,2);assert.equal(dispatch('accion_inexistente').msg,'Acción no válida');
// Edición explícita: mismo ID, mismo número de bancos y logo conservado en una actualización parcial.
const bankCount=backend.finList().cuentas.length,originalId=backend.finList().cuentas[1].Cuenta;
const png='data:image/png;base64,iVBORw0KGgo=';
backend.finCuentaSave('test',{...backend.finList().cuentas[1],Logo:png},'editar');
backend.finCuentaSave('test',{Cuenta:originalId,SaldoInicial:77},'editar');
assert.equal(backend.finList().cuentas.length,bankCount);assert.equal(backend.finList().cuentas.find(c=>c.Cuenta===originalId).Logo,png);assert.equal(backend.finList().cuentas.find(c=>c.Cuenta===originalId).SaldoInicial,77);
assert.throws(()=>backend.finCuentaSave('test',{...custom,Cuenta:''},'editar'),/identificador/);assert.throws(()=>backend.finCuentaSave('test',{...custom,Cuenta:'stale-id'},'editar'),/ya no existe/);assert.throws(()=>backend.finCuentaSave('test',{...backend.finList().cuentas[0]},'crear'),/Editar/);assert.equal(backend.finList().cuentas.length,bankCount);
// Filas vacías en la hoja no pueden convertir una edición en otra cuenta o duplicarla.
const bankSheet=tables.get('FIN_CUENTAS');bankSheet.rows.splice(2,0,Array(bankSheet.rows[0].length).fill(''));
backend.finCuentaSave('test',{Cuenta:originalId,SaldoInicial:88},'editar');assert.equal(backend.finList().cuentas.length,bankCount);assert.equal(backend.finList().cuentas.find(c=>c.Cuenta===originalId).SaldoInicial,88);
// Borrado real solo sin movimientos; protege todas las fechas y mantiene el resto del control financiero.
assert.throws(()=>backend.finCuentaDelete('bad',originalId),/Sesión/);assert.throws(()=>backend.finCuentaDelete('test','legacy-0'),/movimiento/);
const movementBefore=JSON.stringify(backend.finList().movimientos),otherBalance=backend.accountBalance(backend.finList(),'legacy-0','2026-11-06'),adjustmentsBefore=backend.finList().ajustes.length;
assert(dispatch('fin_cuenta_eliminar',{cuenta:originalId}).ok);assert.equal(backend.finList().cuentas.length,bankCount-1);assert(!backend.finList().cuentas.some(c=>c.Cuenta===originalId));assert.equal(JSON.stringify(backend.finList().movimientos),movementBefore);assert.equal(backend.accountBalance(backend.finList(),'legacy-0','2026-11-06'),otherBalance);assert.equal(backend.finList().ajustes.length,adjustmentsBefore);assert(!backend.finTabla('FIN_SALDOS').rows.some(r=>r.Cuenta===originalId));assert(backend.finTabla('FIN_CUENTAS_BITACORA').rows.some(r=>r.Accion==='ELIMINAR'&&r.Cuenta===originalId));
const helpers=load('bank-accounts'),offlineData={...data,cuentas:[...data.cuentas,custom]};const editedOffline=helpers.saveBankLocally(offlineData,{...custom,SaldoInicial:12},'editar','should-not-be-used','test');assert.equal(editedOffline.cuentas.length,offlineData.cuentas.length);assert.equal(editedOffline.cuentas.at(-1).Cuenta,custom.Cuenta);assert.equal(editedOffline.cuentas.at(-1).SaldoInicial,12);assert.equal(helpers.deleteBankLocally(editedOffline,custom.Cuenta).cuentas.length,2);assert.throws(()=>helpers.deleteBankLocally(offlineData,'BDV JUR'),/movimiento/);assert(helpers.bankOperationMessage('Acción no válida').includes('conexión'));assert.equal(helpers.bankOperationMessage('Fecha inválida'),'Fecha inválida');
// Una instalación nueva no depende de cargas previas ni crea datos financieros de ejemplo.
tables.clear();backend.finPrepare2026('admin');assert.equal(backend.finList().cuentas.length,0);assert.equal(backend.finList().movimientos.length,0);assert(backend.finCuentaSave('test',{...custom,Cuenta:''}).ok);
console.log('PASS Finanzas: transferencias, saldos 2026, cascada, idempotencia, reportes sin procedencia, gastos, bancos, permisos y alta vacía.');

// Configuración prueba la URL escrita, sin enviar la sesión al destino anterior por error.
(async()=>{
 const local=new Map([['cs_api','https://old.example.test/exec']]),calls=[];
 const apiContext={exports:{},process:{env:{NEXT_PUBLIC_APPS_SCRIPT_URL:'https://main.example.test/exec'}},window:{},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},fetch:async(url,options)=>{calls.push({url,options});return {json:async()=>({ok:true})};},URL};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,apiContext);
 const api=apiContext.exports;assert(api.hasConnectionOverride());await api.ping('test-session','https://new.example.test/exec');assert.equal(calls[0].url,'https://new.example.test/exec');assert.equal(api.getUrl(),'https://old.example.test/exec');await api.apiPost({action:'fin_list'});assert.equal(calls[1].url,'https://old.example.test/exec');api.setUrl('');assert.equal(api.getUrl(),'https://main.example.test/exec');assert(!api.hasConnectionOverride());
 console.log('PASS Bancos: edición sin duplicar, filas vacías, borrado protegido, auditoría y prueba de conexión al destino correcto.');
})().catch(e=>{console.error(e);process.exitCode=1;});

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
const tables=new Map();function sheet(headers){const rows=[headers];return {rows,appendRow:r=>rows.push([...r]),setFrozenRows(){},getLastRow:()=>rows.length,getMaxRows:()=>1000,getMaxColumns:()=>26,getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),getRange:(row,col,n=1,width=1)=>{const range={getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),setValues:vs=>{vs.forEach((v,i)=>{rows[row-1+i]||=[];v.forEach((x,j)=>rows[row-1+i][col-1+j]=x);});return range;},clearContent:()=>{for(let i=0;i<n;i++)for(let j=0;j<width;j++)if(rows[row-1+i])rows[row-1+i][col-1+j]="";return range;},setNumberFormat:()=>range,setValue:v=>{rows[row-1]||=[];rows[row-1][col-1]=v;}};return range;}};}
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
// Una instalación nueva no depende de cargas previas ni crea datos financieros de ejemplo.
tables.clear();backend.finPrepare2026('admin');assert.equal(backend.finList().cuentas.length,0);assert.equal(backend.finList().movimientos.length,0);assert(backend.finCuentaSave('test',{...custom,Cuenta:''}).ok);
console.log('PASS Finanzas: transferencias, saldos 2026, cascada, idempotencia, reportes sin procedencia, gastos, bancos, permisos y alta vacía.');

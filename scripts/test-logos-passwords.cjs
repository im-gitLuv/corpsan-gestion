const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),sharp=require('sharp');
const modules={};
function load(file){
 if(modules[file])return modules[file].exports;
 const mod={exports:{}};modules[file]=mod;
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports:mod.exports,module:mod,require:n=>n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):n.startsWith('./')?load(path.join(path.dirname(file),n+'.ts')):require(n),Blob,URL,URLSearchParams,Uint8Array,DataView,atob,btoa,console,crypto:globalThis.crypto});return mod.exports;
}
const logos=load('src/lib/bank-logos.ts'),password=load('src/lib/password.ts'),PasswordField=load('src/components/PasswordField.tsx').default;
const crop=load('src/lib/logo-editor.ts');
const credit={title:'Logo Banco de Prueba.png',source:'https://commons.wikimedia.org/wiki/File:Logo_Banco_de_Prueba.png',author:'José Pérez · Diseño',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'};
async function run(){
 const url=new URL(logos.commonsSearchUrl('Banco de Venezuela'));assert.equal(url.origin,'https://commons.wikimedia.org');assert.equal(url.searchParams.get('origin'),'*');assert.equal(url.searchParams.get('gsrnamespace'),'6');assert.equal(url.searchParams.get('gsrsearch'),'Banco de Venezuela logo');assert.throws(()=>logos.commonsSearchUrl('  '));
 assert(logos.isCommonsImage('https://upload.wikimedia.org/wikipedia/commons/a/ab/logo.png'));for(const bad of ['http://upload.wikimedia.org/wikipedia/commons/logo.png','https://upload.wikimedia.org.evil.test/wikipedia/commons/logo.png','javascript:alert(1)','https://example.com/logo.png'])assert(!logos.isCommonsImage(bad));
 const original=await sharp({create:{width:2,height:2,channels:4,background:{r:12,g:34,b:56,alpha:.5}}}).png().toBuffer(),data='data:image/png;base64,'+original.toString('base64');
 const pngBlob=new Blob([original],{type:'image/png'});crop.validateLogoImage(pngBlob);
assert.throws(()=>crop.validateLogoImage(new Blob(['<svg/>'],{type:'image/svg+xml'})));assert.throws(()=>crop.validateLogoImage(new Blob([],{type:'image/png'})));assert.throws(()=>crop.validateLogoImage(new Blob([Buffer.alloc(crop.MAX_LOGO_BYTES+1)],{type:'image/png'})));
const copied={items:[{kind:'string',type:'text/html',getAsFile:()=>null},{kind:'file',type:'image/png',getAsFile:()=>pngBlob}],files:[]};assert.equal(crop.clipboardImage(copied),pngBlob);assert.equal(crop.clipboardImage({items:[],files:[pngBlob]}),pngBlob);assert.equal(crop.clipboardImage({items:[{kind:'string',type:'text/plain',getAsFile:()=>null}],files:[]}),null);
assert.equal((await crop.logoBlob(data).arrayBuffer()).byteLength,original.length);assert.throws(()=>crop.logoBlob('https://example.com/logo.png'));
const full=crop.cropGeometry(400,200,{zoom:1,x:0,y:0,background:'transparent'});assert.equal(full.width,256);assert.equal(full.height,128);assert.equal(full.y,64);
// Llenar el marco de una imagen 2:1 recorta exactamente los 100 píxeles de cada lado.
const filled=crop.cropGeometry(400,200,{zoom:2,x:0,y:0,background:'transparent'});assert.equal((0-filled.x)/filled.width*400,100);assert.equal((256-filled.x)/filled.width*400,300);
const moved=crop.cropGeometry(400,200,{zoom:2,x:.25,y:0,background:'transparent'});assert.equal((0-moved.x)/moved.width*400,50);assert.equal((256-moved.x)/moved.width*400,250);
const portrait=crop.cropGeometry(200,400,{zoom:2,x:0,y:0,background:'white'});assert.equal(portrait.width,256);assert.equal(portrait.height,512);assert.equal(portrait.y,-128);
for(const dimensions of [[400,200],[200,400],[1000,1],[1,1000]])for(const zoom of [.2,1,8]){const bounded=crop.boundedCrop(...dimensions,{zoom,x:100,y:-100,background:'transparent'}),g=crop.cropGeometry(...dimensions,bounded,1);assert(g.x<1&&g.y+g.height>0);assert(g.x+g.width>0&&g.y<1);}
assert.equal(crop.boundedCrop(400,200,{zoom:99,x:0,y:0,background:'transparent'}).zoom,8);assert.throws(()=>crop.cropGeometry(0,1,crop.DEFAULT_LOGO_CROP));
const annotated=logos.withLogoCredit(data,credit),decoded=Buffer.from(annotated.split(',')[1],'base64');assert(annotated.length<45000);assert.deepEqual(JSON.parse(JSON.stringify(logos.logoCredit(annotated))),credit);assert.equal(logos.logoCredit(data),null);assert.equal(logos.logoCredit('data:image/png;base64,!!!'),null);assert.throws(()=>logos.withLogoCredit(data,{...credit,source:'https://evil.test/'}));
 // Un decodificador independiente comprueba que el PNG conserve píxeles y transparencia.
 assert.deepEqual(await sharp(decoded).raw().toBuffer(),await sharp(original).raw().toBuffer());const meta=await sharp(decoded).metadata();assert.equal(meta.width,2);assert.equal(meta.hasAlpha,true);
 const unsafeCredit=logos.withLogoCredit(data,{...credit,licenseUrl:'javascript:alert(1)'});assert.equal(logos.logoCredit(unsafeCredit).licenseUrl,'');
 const render=props=>renderToStaticMarkup(React.createElement(PasswordField,{label:'Contraseña',value:'',onChange(){},...props}));
 assert(!password.validatePassword('123456789012'));assert(password.validatePassword('12345678901'));assert(password.validatePassword('x'.repeat(129)));
 const login=render({value:'admin123'});assert(login.includes('type="password"'));assert(login.includes('Mostrar contraseña'));assert(!login.includes('is-valid'));assert(!login.includes('minLength="12"'));
 const fresh=render({showRequirements:true,value:''});assert(fresh.includes('Al menos 12 caracteres'));assert(!fresh.includes('is-valid'));assert(fresh.includes('maxLength="128"'));
 assert(render({showRequirements:true,value:'123456789012'}).includes('is-valid'));
 assert(render({matchTo:'123456789012',value:'123456789012'}).includes('Las contraseñas coinciden'));
 const mismatch=render({matchTo:'123456789012',value:'123456789013'});assert(mismatch.includes('aria-invalid="true"'));assert(!mismatch.includes('is-valid'));
 const short=render({matchTo:'abc',value:'abc'});assert(!short.includes('is-valid'));assert(short.includes('Completa los requisitos'));
 const escaped=render({value:'<script>example</script>'});assert(!escaped.includes('<script>example</script>'));assert(escaped.includes('type="button"'));assert(escaped.includes('aria-controls='));
 console.log('PASS logos y contraseñas: portapapeles, recorte, desplazamiento, límites, Commons, PNG con créditos y transparencia, validación real, confirmación, accesibilidad y login heredado.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),ts=require('typescript'),path=require('node:path');
const root=path.join(__dirname,'..'),file=path.join(root,'apps-script/Code.gs');
function dominio(name){
  const src=fs.readFileSync(path.join(root,'src/lib/'+name+'.ts'),'utf8').replace(/^import type .*;\r?\n/gm,'').replace(/\bexport /g,'');
  return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
}
const marker='// BEGIN SHARED BUSINESS DOMAIN';
const admMarker='// BEGIN SHARED ADM DOMAIN';
const backend=fs.readFileSync(file,'utf8').split('// BEGIN RF FEATURES')[0].split(marker)[0].split(admMarker)[0].trimEnd();
const features=fs.readFileSync(path.join(root,'apps-script/features.js'),'utf8');
const expected=backend+'\n\n// BEGIN RF FEATURES\n'+features+'\n'
  +marker+'\n'+dominio('business')+'// END SHARED BUSINESS DOMAIN\n'
  +'\n'+admMarker+'\n'+dominio('adm')+'// END SHARED ADM DOMAIN\n';
if(process.argv.includes('--check')) { if(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==expected.replace(/\r\n/g,'\n')) throw Error('Ejecuta npm run sync:domain'); }
else fs.writeFileSync(file,expected);

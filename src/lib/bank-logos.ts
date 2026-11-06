export interface LogoCredit {title:string;source:string;author:string;license:string;licenseUrl:string}
export interface CommonsLogo extends LogoCredit {id:number;preview:string}
export function commonsSearchUrl(bank:string){
 const query=bank.trim().slice(0,120);
 if(!query)throw new Error('Escribe el nombre del banco para buscar su logo.');
 const params=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',generator:'search',gsrsearch:query+' logo',gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'320',iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl'});
 return 'https://commons.wikimedia.org/w/api.php?'+params;
}
export function isCommonsImage(url:string){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='upload.wikimedia.org'&&u.pathname.startsWith('/wikipedia/commons/');}catch{return false;}}
export function isCommonsSource(url:string){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='commons.wikimedia.org'&&u.pathname.startsWith('/wiki/File:');}catch{return false;}}
function safeLicenseUrl(url:string){try{const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch{return '';}}
// Los créditos viajan dentro del PNG guardado, por lo que no requieren nuevas columnas ni otro backend.
const keyword='CorpSanLogo';
function textBytes(value:string){return Uint8Array.from(value,c=>c.charCodeAt(0));}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function withLogoCredit(dataUrl:string,credit:LogoCredit){
 if(!dataUrl.startsWith('data:image/png;base64,')||!isCommonsSource(credit.source))throw new Error('No se pudo preparar el logo seleccionado.');
 const bytes=textBytes(atob(dataUrl.split(',')[1]));
 if(bytes.length<20)throw new Error('Imagen no válida.');
 const json=JSON.stringify({title:credit.title.slice(0,200),source:credit.source,author:credit.author.slice(0,300),license:credit.license.slice(0,100),licenseUrl:safeLicenseUrl(credit.licenseUrl)}).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 const payload=textBytes(keyword+'\0'+json),chunk=new Uint8Array(payload.length+12),view=new DataView(chunk.buffer);view.setUint32(0,payload.length);chunk.set(textBytes('tEXt'),4);chunk.set(payload,8);view.setUint32(chunk.length-4,crc32(chunk.subarray(4,chunk.length-4)));
 const output=new Uint8Array(bytes.length+chunk.length);output.set(bytes.subarray(0,bytes.length-12));output.set(chunk,bytes.length-12);output.set(bytes.subarray(bytes.length-12),bytes.length-12+chunk.length);
 return 'data:image/png;base64,'+btoa(Array.from(output,c=>String.fromCharCode(c)).join(''));
}
export function logoCredit(dataUrl?:string):LogoCredit|null{
 try{
  if(!dataUrl?.startsWith('data:image/png;base64,')||dataUrl.length>45000)return null;
  const bytes=textBytes(atob(dataUrl.split(',')[1])),view=new DataView(bytes.buffer);
  for(let offset=8;offset+12<=bytes.length;){const size=view.getUint32(offset);if(size>bytes.length-offset-12)return null;const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(type==='tEXt'){const text=Array.from(bytes.subarray(offset+8,offset+8+size),c=>String.fromCharCode(c)).join('');if(text.startsWith(keyword+'\0')){const c=JSON.parse(text.slice(keyword.length+1));if(typeof c.title!=='string'||typeof c.author!=='string'||typeof c.license!=='string'||!isCommonsSource(c.source))return null;return {...c,licenseUrl:safeLicenseUrl(c.licenseUrl)};}}offset+=size+12;}
 }catch{/* Los logos locales y los PNG sin créditos se muestran normalmente. */}
 return null;
}
export async function prepareCommonsLogo(logo:CommonsLogo,signal?:AbortSignal):Promise<string>{
 if(!isCommonsImage(logo.preview))throw new Error('La imagen no pertenece a Wikimedia Commons.');
 const response=await fetch(logo.preview,{signal,credentials:'omit'});if(!response.ok)throw new Error('No se pudo descargar el logo. Prueba otra imagen.');
 const blob=await response.blob();if(blob.size>4000000||!['image/png','image/jpeg','image/webp','image/gif'].includes(blob.type))throw new Error('Selecciona una imagen PNG, JPEG o WebP de menor tamaño.');
 const bitmap=await createImageBitmap(blob);
 try{for(const size of [256,192,128,96]){const scale=Math.min(1,size/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('El navegador no pudo preparar la imagen.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const result=withLogoCredit(canvas.toDataURL('image/png'),logo);if(result.length<=44000)return result;}
  throw new Error('Este logo pesa demasiado. Prueba otra imagen.');
 }finally{bitmap.close();}
}

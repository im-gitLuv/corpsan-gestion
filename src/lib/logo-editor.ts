import {withLogoCredit,type LogoCredit} from './bank-logos';

export type LogoCrop={zoom:number;x:number;y:number;background:'transparent'|'white'};
export const DEFAULT_LOGO_CROP:LogoCrop={zoom:1,x:0,y:0,background:'transparent'};
export const MAX_LOGO_BYTES=12*1024*1024;
export function validateLogoImage(image:Blob){
 if(!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(image.type))throw new Error('Utiliza una imagen PNG, JPEG, WebP o GIF.');
 if(!image.size)throw new Error('La imagen está vacía. Copia otra imagen e intenta de nuevo.');
 if(image.size>MAX_LOGO_BYTES)throw new Error('La imagen supera 12 MB. Utiliza una versión más pequeña.');
}
export function clipboardImage(data:Pick<DataTransfer,'items'|'files'>):File|null{
 for(const item of Array.from(data.items)){if(item.kind==='file'&&item.type.startsWith('image/')){const file=item.getAsFile();if(file)return file;}}
 return Array.from(data.files).find(file=>file.type.startsWith('image/'))||null;
}
export function logoBlob(dataUrl:string):Blob{
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
 if(!match||dataUrl.length>45000)throw new Error('No se pudo abrir el logo actual. Pega una nueva imagen.');
 const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
 return new Blob([bytes],{type:'image/'+match[1]});
}
export function cropGeometry(width:number,height:number,crop:LogoCrop,size=256){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isFinite(size)||size<=0||![crop.zoom,crop.x,crop.y].every(Number.isFinite)||crop.zoom<=0)throw new Error('No se pudo calcular el recorte.');
 const scale=size/Math.max(width,height)*crop.zoom,w=width*scale,h=height*scale;
 return {x:size/2+crop.x*size-w/2,y:size/2+crop.y*size-h/2,width:w,height:h};
}
export function boundedCrop(width:number,height:number,crop:LogoCrop):LogoCrop{
 const zoom=Math.max(.2,Math.min(8,crop.zoom)),g=cropGeometry(width,height,{...crop,zoom},1);
 // Siempre conserva una parte visible de la imagen dentro del marco.
 const maxX=.5+g.width/2-Math.min(.1,g.width),maxY=.5+g.height/2-Math.min(.1,g.height);
 return {...crop,zoom,x:Math.max(-maxX,Math.min(maxX,crop.x)),y:Math.max(-maxY,Math.min(maxY,crop.y))};
}
export function renderLogoCrop(image:HTMLImageElement,crop:LogoCrop,credit?:LogoCredit):string{
 for(const size of [256,192,128,96,64]){
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('El navegador no pudo preparar el recorte.');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(crop.background==='white'){ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);}
  const g=cropGeometry(image.naturalWidth,image.naturalHeight,crop,size);
  ctx.drawImage(image,g.x,g.y,g.width,g.height);
  const png=canvas.toDataURL('image/png'),result=credit?withLogoCredit(png,credit):png;
  if(result.length<=44000)return result;
 }
 throw new Error('No se pudo reducir el logo. Prueba un recorte más sencillo.');
}

"use client";
import {useEffect,useId,useRef,useState} from 'react';
import CommonsLogoPicker from '@/components/CommonsLogoPicker';
import LogoEditor from '@/components/LogoEditor';
import {logoCredit,type LogoCredit} from '@/lib/bank-logos';
import {clipboardImage,logoBlob,validateLogoImage} from '@/lib/logo-editor';

type Candidate={image:Blob;credit?:LogoCredit;id:number};
export default function BankLogoInput({bank,value,onChange,onBusyChange,disabled=false}:{bank:string;value:string;onChange:(logo:string)=>void;onBusyChange:(busy:boolean)=>void;disabled?:boolean}){
 const id=useId(),[candidate,setCandidate]=useState<Candidate|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[commonsBusy,setCommonsBusy]=useState(false);
 const busyCallback=useRef(onBusyChange),sequence=useRef(0);busyCallback.current=onBusyChange;
 useEffect(()=>{busyCallback.current(!!candidate||commonsBusy);},[candidate,commonsBusy]);
 useEffect(()=>()=>busyCallback.current(false),[]);
 function open(image:Blob,credit?:LogoCredit){setError('');setMessage('');try{validateLogoImage(image);busyCallback.current(true);setCandidate({image,credit,id:++sequence.current});}catch(e){setError((e as Error).message);}}
 function pasted(e:React.ClipboardEvent<HTMLTextAreaElement>){e.preventDefault();if(disabled||candidate||commonsBusy)return;const image=clipboardImage(e.clipboardData);if(!image){setMessage('');setError('No recibimos una imagen. En la página donde ves el logo, usa clic derecho → Copiar imagen y vuelve a pegar aquí.');return;}open(image);}
 function existing(data:string){try{open(logoBlob(data),logoCredit(data)||undefined);}catch(e){setError((e as Error).message);}}
 function apply(logo:string){onChange(logo);setCandidate(null);busyCallback.current(false);setMessage('Recorte aplicado. Pulsa «Guardar banco» para conservar el logo.');}
 function cancel(){setCandidate(null);busyCallback.current(false);setMessage('Edición descartada. El logo anterior se conserva.');}
 return <div className="bank-logo-input">{candidate?<LogoEditor key={candidate.id} image={candidate.image} credit={candidate.credit} onApply={apply} onCancel={cancel}/>:<>
  <label className="logo-paste-label" htmlFor={id}>Pega la imagen del logo</label><textarea id={id} className="logo-paste-area" rows={2} value="" onChange={()=>{}} onPaste={pasted} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}} disabled={disabled||commonsBusy} placeholder="Haz clic aquí y pega con Ctrl+V o ⌘+V" aria-describedby={`${id}-help`}/><p id={`${id}-help`} className="logo-paste-help">En internet, haz clic derecho sobre el logo → <b>Copiar imagen</b>. Pégalo aquí para moverlo, ajustar el zoom y recortarlo.</p>
  {value&&<button type="button" className="btn ghost" disabled={disabled||commonsBusy} onClick={()=>existing(value)}>Editar o recortar el logo actual</button>}
  <details className="bank-upload"><summary>Otras formas de elegir la imagen</summary><label>Elegir archivo (hasta 12 MB)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif" disabled={disabled||commonsBusy} onChange={e=>{const file=e.target.files?.[0];if(file)open(file);e.target.value='';}}/></label><CommonsLogoPicker bank={bank} onSelect={existing} onBusyChange={setCommonsBusy}/></details>
 </>}{error&&<p role="alert" className="fin-notice">{error}</p>}{message&&<p role="status" className="logo-input-message">{message}</p>}</div>;
}

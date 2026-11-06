"use client";
import {useEffect,useRef,useState} from 'react';
import {commonsSearchUrl,isCommonsImage,isCommonsSource,prepareCommonsLogo,type CommonsLogo} from '@/lib/bank-logos';

function plainText(html:string){return new DOMParser().parseFromString(html,'text/html').body.textContent?.trim()||'';}
type CommonsPage={pageid:number;title:string;index?:number;imageinfo?:{url:string;thumburl?:string;mime:string;descriptionurl:string;extmetadata?:Record<string,{value?:string}>}[]};
export default function CommonsLogoPicker({bank,onSelect,onBusyChange}:{bank:string;onSelect:(logo:string)=>void;onBusyChange:(busy:boolean)=>void}){
 const [query,setQuery]=useState(bank),[open,setOpen]=useState(false),[results,setResults]=useState<CommonsLogo[]>([]),[searching,setSearching]=useState(false),[selecting,setSelecting]=useState<number|null>(null),[searched,setSearched]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),request=useRef(0),busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
 useEffect(()=>()=>{request.current++;controller.current?.abort();busyCallback.current(false);},[]);
 async function search(term=query){
  controller.current?.abort();const c=new AbortController();controller.current=c;const id=++request.current;setSearching(true);setResults([]);setError('');setSearched(false);
  const timeout=setTimeout(()=>c.abort(),15000);
  try{
   const response=await fetch(commonsSearchUrl(term),{signal:c.signal,credentials:'omit'});if(!response.ok)throw new Error('Wikimedia Commons no está disponible ahora. Intenta de nuevo.');
   const body=await response.json();if(body.error)throw new Error('No se pudo completar la búsqueda. Prueba otro nombre.');
   const pages=(body.query?.pages||[]) as CommonsPage[];
   const logos=pages.sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(p=>{const info=p.imageinfo?.[0];if(!info)return [];const preview=info.thumburl||info.url;if(!isCommonsImage(preview)||!isCommonsSource(info.descriptionurl)||(!info.thumburl&&!/^image\/(png|jpeg|webp|gif)$/.test(info.mime)))return [];const m=info.extmetadata||{};return [{id:p.pageid,title:p.title.replace(/^File:/,''),preview,source:info.descriptionurl,author:plainText(m.Artist?.value||''),license:plainText(m.LicenseShortName?.value||'Ver licencia en Commons'),licenseUrl:m.LicenseUrl?.value||''}];});
   if(id===request.current){setResults(logos);setSearched(true);}
  }catch(e){if(id===request.current)setError(c.signal.aborted?'La búsqueda tardó demasiado. Intenta nuevamente.':e instanceof TypeError?'No se pudo conectar con Wikimedia Commons. Intenta nuevamente.':(e as Error).message);}
  finally{clearTimeout(timeout);if(id===request.current)setSearching(false);}
 }
 async function select(logo:CommonsLogo){
  if(selecting!==null)return;controller.current?.abort();const c=new AbortController();controller.current=c;setSelecting(logo.id);onBusyChange(true);setError('');const timeout=setTimeout(()=>c.abort(),20000);
  try{const image=await prepareCommonsLogo(logo,c.signal);if(!c.signal.aborted){onSelect(image);setOpen(false);}}
  catch(e){if(c.signal.aborted)setError('No se pudo descargar la imagen a tiempo. Intenta otra vez.');else setError(e instanceof Error&&e.name==='Error'?e.message:'No se pudo preparar ese logo. Prueba otra imagen.');}
  finally{clearTimeout(timeout);setSelecting(null);onBusyChange(false);}
 }
 return <div className="commons-picker"><button type="button" className="btn ghost" onClick={()=>{const term=bank.trim();setQuery(term);setOpen(v=>!v);if(!open&&term)void search(term);}} disabled={selecting!==null}>{open?'Cerrar búsqueda':'Buscar logo en Wikimedia Commons'}</button>
  {open&&<div className="commons-panel"><label>Nombre del banco<input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}} placeholder="Ej.: Banco de Venezuela" maxLength={120} disabled={selecting!==null}/></label><button type="button" disabled={searching||selecting!==null||!query.trim()} onClick={()=>void search()}>{searching?'Buscando…':'Buscar logos'}</button><p className="fin-note">Elige el logo que corresponde al banco. Se guardará al pulsar «Guardar banco».</p>
   {searching&&<p role="status">Buscando imágenes en Wikimedia Commons…</p>}{error&&<p role="alert" className="fin-notice">{error}</p>}{searched&&!results.length&&<p role="status">No encontramos imágenes para ese nombre. Prueba una versión más corta o utiliza un archivo.</p>}
   <div className="commons-results">{results.map(logo=><article key={logo.id}><button type="button" className="commons-choice" disabled={selecting!==null} onClick={()=>void select(logo)} aria-label={`Usar logo ${logo.title}`}><img src={logo.preview} alt={logo.title} loading="lazy" width="180" height="100"/><span>{selecting===logo.id?'Preparando logo…':logo.title}</span></button><small>{logo.license}</small><a href={logo.source} target="_blank" rel="noopener noreferrer">Ver archivo y autor</a></article>)}</div>
  </div>}
 </div>;
}

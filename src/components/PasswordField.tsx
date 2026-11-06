"use client";

import {useId,useState} from 'react';
import {validatePassword} from '@/lib/password';

type Props={label:string;value:string;onChange:(value:string)=>void;autoComplete?:string;showRequirements?:boolean;matchTo?:string;disabled?:boolean};

export default function PasswordField({label,value,onChange,autoComplete='current-password',showRequirements=false,matchTo,disabled=false}:Props){
 const id=useId(),[visible,setVisible]=useState(false),[caps,setCaps]=useState(false);
 const matching=matchTo!==undefined,valid=value.length>0&&(matching?value===matchTo&&!validatePassword(value):showRequirements&&!validatePassword(value));
 const mismatch=matching&&value.length>0&&value!==matchTo;
 function checkCaps(event:React.KeyboardEvent<HTMLInputElement>){setCaps(event.getModifierState('CapsLock'));}
 return <div className={`password-field${valid?' is-valid':''}${mismatch?' is-mismatch':''}`}>
  <label htmlFor={id}>{label}</label>
  <div className="password-control">
   <input id={id} type={visible?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete={autoComplete} minLength={showRequirements||matching?12:undefined} maxLength={128} required disabled={disabled} aria-describedby={showRequirements||matching?`${id}-help`:undefined} aria-invalid={mismatch||undefined} onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={()=>setCaps(false)}/>
   <button type="button" className="password-eye" aria-controls={id} aria-label={`${visible?'Ocultar':'Mostrar'} ${label.toLocaleLowerCase()}`} aria-pressed={visible} title={visible?'Ocultar contraseña':'Mostrar contraseña'} disabled={disabled} onClick={()=>setVisible(v=>!v)}>
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="m3 3 18 18"/>}</svg>
   </button>
  </div>
  {showRequirements&&<div id={`${id}-help`} className="password-help"><div className="password-help-heading"><span>{valid?'Contraseña lista':'Requisitos de contraseña'}</span><span aria-label={`${value.length} de 128 caracteres`}>{value.length}/128</span></div><ul aria-live="polite"><li className={value.length>=12?'met':''}><span aria-hidden="true">{value.length>=12?'✓':'○'}</span>Al menos 12 caracteres</li><li className={value.length>0&&value.length<=128?'met':''}><span aria-hidden="true">{value.length>0&&value.length<=128?'✓':'○'}</span>Hasta 128 caracteres</li></ul></div>}
  {matching&&<p id={`${id}-help`} className={`password-match${valid?' met':''}`} role="status">{!value?'Vuelve a escribir la contraseña.':valid?'✓ Las contraseñas coinciden.':value===matchTo?'Coinciden. Completa los requisitos de la contraseña.':'Las contraseñas todavía no coinciden.'}</p>}
  {caps&&<p className="password-caps" role="status">Bloq Mayús está activado.</p>}
 </div>;
}

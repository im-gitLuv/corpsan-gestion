"use client";
import {useMemo,useState} from 'react';
import {accountKind,bankName} from '@/lib/business';
import {logoCredit} from '@/lib/bank-logos';
import {useToast} from '@/components/Toaster';
import type {CuentaFin} from '@/lib/finanzas';

/** Últimos 4 dígitos del número de cuenta, para etiquetas cortas. */
export function numeroCorto(c?:CuentaFin):string{
 const n=String(c?.Numero||'').replace(/\D/g,'');
 return n.length>=4?'…'+n.slice(-4):'';
}
/** Copia el número de cuenta al portapapeles y confirma con un aviso. */
export function AccountNumberChip({account,compact}:{account?:CuentaFin;compact?:boolean}){
 const {toast}=useToast();
 const numero=String(account?.Numero||'').trim();
 if(!numero)return compact?null:<span className="acct-number empty">Sin número de cuenta</span>;
 async function copiar(){
  try{
   await navigator.clipboard.writeText(numero);
   toast('Número de cuenta copiado: '+numero);
  }catch{
   toast('No se pudo copiar. Selecciona el texto manualmente.',true);
  }
 }
 return <button type="button" className="acct-number" title="Copiar número de cuenta" onClick={copiar}>{numero}{compact&&<span className="acct-number-hint">copiar</span>}</button>;
}
export function AccountOptions({accounts}:{accounts:CuentaFin[]}) {
 return <>{(['Personal','Jurídico'] as const).map(kind=><optgroup key={kind} label={kind==='Personal'?'Cuentas personales':'Cuentas jurídicas'}>{accounts.filter(c=>accountKind(c)===kind).map(c=><option key={c.Cuenta} value={c.Cuenta}>{bankName(c)}{numeroCorto(c)?' · '+numeroCorto(c):''}</option>)}</optgroup>)}</>;
}
export function BankBadge({account}:{account?:CuentaFin}) {
 const [failedLogo,setFailedLogo]=useState<string>();
 const credit=useMemo(()=>logoCredit(account?.Logo),[account?.Logo]);
 return <span className="bank-badge">{account?.Logo&&failedLogo!==account.Logo?<img src={account.Logo} alt="" width={40} height={40} onError={()=>setFailedLogo(account.Logo)}/>:<span className="bank-monogram" aria-hidden="true">{bankName(account).split(' ').filter(w=>!['de','del'].includes(w)).map(w=>w[0]).slice(0,3).join('')}</span>}<span>{bankName(account)}<small>{accountKind(account)}{account?.Numero?' · N° '+account.Numero:''}</small>{credit&&<span className="bank-logo-credit"><a href={credit.source} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a><small>{credit.author?credit.author+" · ":""}{credit.licenseUrl?<a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">{credit.license}</a>:credit.license}</small></span>}</span></span>;
}

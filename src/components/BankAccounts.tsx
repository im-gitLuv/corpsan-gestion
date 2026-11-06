"use client";
import {useState} from 'react';
import {accountKind,bankName} from '@/lib/business';
import type {CuentaFin} from '@/lib/finanzas';
export function AccountOptions({accounts}:{accounts:CuentaFin[]}) {
 return <>{(['Personal','Jurídico'] as const).map(kind=><optgroup key={kind} label={kind==='Personal'?'Cuentas personales':'Cuentas jurídicas'}>{accounts.filter(c=>accountKind(c)===kind).map(c=><option key={c.Cuenta} value={c.Cuenta}>{bankName(c)}</option>)}</optgroup>)}</>;
}
export function BankBadge({account}:{account?:CuentaFin}) {
 const [failed,setFailed]=useState(false);
 return <span className="bank-badge">{account?.Logo&&!failed?<img src={account.Logo} alt="" width={40} height={40} onError={()=>setFailed(true)}/>:<span className="bank-monogram" aria-hidden="true">{bankName(account).split(' ').filter(w=>!['de','del'].includes(w)).map(w=>w[0]).slice(0,3).join('')}</span>}<span>{bankName(account)}<small>{accountKind(account)}</small></span></span>;
}

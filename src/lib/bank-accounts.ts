import {bankForDeletion,bankSavePlan,normalizedText,type BankOperation} from './business';
import type {CuentaFin,FinanzasData} from './finanzas';

export function saveBankLocally(data:FinanzasData,input:CuentaFin,operation:BankOperation,newId:string,usuario:string):FinanzasData{
 const plan=bankSavePlan(input,data.cuentas,operation),row={...plan.row,Cuenta:plan.prior?.Cuenta||newId};
 const changed=plan.prior&&(Number(plan.prior.SaldoInicial)!==row.SaldoInicial||plan.prior.FechaSaldoInicial!==row.FechaSaldoInicial);
 const ajustes=changed?[...(data.ajustes||[]),{ID:'SAL-'+newId,Cuenta:row.Cuenta,Periodo:row.FechaSaldoInicial.slice(0,7),Valor:Number(row.SaldoInicial),Oficial:'',Usuario:usuario,Fecha:new Date().toISOString(),Motivo:'Saldo base actualizado en Bancos'}]:data.ajustes;
 return {...data,cuentas:plan.prior?data.cuentas.map(c=>c.Cuenta===row.Cuenta?row:c):[...data.cuentas,row],ajustes,control:{...data.control,SaldoInicialGlobal:''}};
}
export function deleteBankLocally(data:FinanzasData,account:string):FinanzasData{
 bankForDeletion(data,account);
 return {...data,cuentas:data.cuentas.filter(c=>c.Cuenta!==account),control:{...data.control,SaldoInicialGlobal:''}};
}
export function bankOperationMessage(message:string){
 if(/ACCION (?:NO (?:ES )?VALIDA|INVALIDA)/.test(normalizedText(message)))return 'Esta conexión no reconoce la operación de bancos. Revisa Configuración o utiliza la conexión principal de la aplicación. Este rechazo no ha creado otro banco.';
 return message;
}

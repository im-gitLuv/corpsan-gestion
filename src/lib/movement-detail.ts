import {accountKind,bankName,normalizedText,paymentMethod} from './business';
import type {FinanzasData,Movimiento} from './finanzas';

export const EMPTY_MOVEMENT_FILTERS = {kind:'',account:'',category:'',type:'',method:'',party:'',status:'',query:''};
export type MovementFilters = typeof EMPTY_MOVEMENT_FILTERS;
export function filterMovementDetail(data:FinanzasData, rows:Movimiento[], filters:MovementFilters) {
 const accounts=new Map(data.cuentas.map(c=>[c.Cuenta,c]));
 const categories=new Map(data.categorias.map(c=>[c.Codigo,c.Nombre]));
 const terms=normalizedText(filters.query).split(' ').filter(Boolean);
 return rows.filter(r=>{
  const account=accounts.get(r.Cuenta);
  if(filters.kind&&accountKind(account)!==filters.kind)return false;
  if(filters.account&&r.Cuenta!==filters.account)return false;
  if(filters.category&&(filters.category==='unclassified'?!!r.Codigo:r.Codigo!==filters.category))return false;
  if(filters.type&&r.Tipo!==filters.type)return false;
  if(filters.method&&paymentMethod(r.Metodo)!==filters.method)return false;
  if(filters.party&&(r.Contraparte?.trim()||'Sin contraparte')!==filters.party)return false;
  if(filters.status&&normalizedText(r.Conciliado)!==filters.status)return false;
  const text=normalizedText([r.Fecha,r.Concepto,r.Contraparte,r.Referencia,r.Factura,r.Codigo,categories.get(r.Codigo),bankName(account),accountKind(account)].join(' '));
  return terms.every(term=>text.includes(term));
 });
}

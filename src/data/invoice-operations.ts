import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { invoiceSnapshot } from '../domain/invoices'
import type { SharedInvoice } from '../domain/invoices'
import type { Order, Settings } from '../domain/types'
export function createInvoiceOperations({db,storeId,uid}:{db:Firestore;storeId:string;uid:string}){
 const ref=(path:string)=>doc(db,`stores/${storeId}/${path}`)
 async function getLink(orderId:string):Promise<SharedInvoice|null>{
  const mapping=await getDocFromServer(ref(`invoiceLinks/${orderId}`))
  if(!mapping.exists())return null
  const result=await getDocFromServer(doc(db,`invoiceShares/${mapping.data().token}`))
  return result.exists()?{token:result.id,...result.data()} as SharedInvoice:null
 }
 async function publish(orderId:string):Promise<SharedInvoice>{
  const random=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')
  let token=random
  await runTransaction(db,async tx=>{
   const mapping=await tx.get(ref(`invoiceLinks/${orderId}`))
   token=mapping.exists()?mapping.data().token:random
   const [order,settings]=await Promise.all([tx.get(ref(`orders/${orderId}`)),tx.get(ref('settings/general'))])
   if(!order.exists()||!settings.exists())throw new Error('Order atau pengaturan toko tidak ditemukan.')
   const shareRef=doc(db,`invoiceShares/${token}`),old=mapping.exists()?await tx.get(shareRef):null
   const snapshot=invoiceSnapshot({id:order.id,...order.data()} as Order,settings.data() as Settings)
   const change={snapshot,enabled:true,updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+30*86400000)}
   if(old?.exists())tx.update(shareRef,change)
   else tx.set(shareRef,{...change,storeId,orderId,createdAt:serverTimestamp(),createdBy:uid})
   tx.set(ref(`invoiceLinks/${orderId}`),{token})
  })
  const result=await getDocFromServer(doc(db,`invoiceShares/${token}`))
  return {token,...result.data()} as SharedInvoice
 }
 async function revoke(orderId:string){
  await runTransaction(db,async tx=>{
   const mapping=await tx.get(ref(`invoiceLinks/${orderId}`));if(!mapping.exists())return
   const target=doc(db,`invoiceShares/${mapping.data().token}`),old=await tx.get(target);if(!old.exists())return
   tx.update(target,{enabled:false,updatedAt:serverTimestamp()})
  })
 }
 return {publish,getLink,revoke}
}
export async function readSharedInvoice(db:Firestore,token:string):Promise<SharedInvoice>{
 if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Tautan invoice tidak valid.')
 try{
  const result=await getDocFromServer(doc(db,`invoiceShares/${token}`))
  if(!result.exists()||!result.data().enabled||result.data().expiresAt.toMillis()<=Date.now())throw new Error('Unavailable')
  return {token,...result.data()} as SharedInvoice
 }catch{throw new Error('Tautan tidak ditemukan, telah dicabut, atau sudah kedaluwarsa.')}
}


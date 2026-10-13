import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc,setDoc,Timestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Customer,OrderInput } from '../src/domain/types'
import { defaultSettings } from '../src/domain/business'
import { createOperations } from '../src/data/transactions'
export async function environment(){return initializeTestEnvironment({projectId:'demo-solekasir',firestore:{host:'127.0.0.1',port:8181,rules:readFileSync('firestore.rules','utf8')}})}
export async function seed(env:RulesTestEnvironment){await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore() as unknown as Firestore;await setDoc(doc(db,'stores/main/members/owner'),{role:'owner',name:'Owner',active:true});await setDoc(doc(db,'stores/main/members/kasir'),{role:'kasir',name:'Kasir',active:true});await setDoc(doc(db,'stores/main/members/inactive'),{role:'owner',name:'Off',active:false});await setDoc(doc(db,'stores/main/settings/general'),defaultSettings);for(let n=0;n<6;n++)await setDoc(doc(db,`stores/main/services/deep${n}`),{name:'Deep Clean',price:60000,days:3,description:'',active:true})})}
export const database=(env:RulesTestEnvironment,uid='owner')=>env.authenticatedContext(uid).firestore() as unknown as Firestore
export const ops=(env:RulesTestEnvironment,uid='owner')=>createOperations({db:database(env,uid),storeId:'main',uid,role:uid==='owner'?'owner':'kasir'})
export async function input(env:RulesTestEnvironment,initialPayment=0,items=1):Promise<OrderInput>{const op=ops(env);const customerId=await op.saveCustomer({name:'Alya Putri',phone:'081234567890',notes:''},'alya');const customer={id:customerId,name:'Alya Putri',nameLower:'alya putri',phone:'6281234567890',notes:'',createdAt:Timestamp.now()} as Customer;return {customer,items:Array.from({length:items},(_,n)=>({id:'draft-'+n,description:'Nike Air Force 1',color:'Putih',material:'Kulit',size:'42',condition:'Sol kuning',accessories:'Tali',serviceId:'deep'+n,serviceName:'Deep Clean',price:60000,notes:'',dueAt:Timestamp.fromMillis(Date.now()+86400000*3),status:0,rack:''})),discount:0,notes:'',initialPayment,method:'tunai',tendered:initialPayment>0?100000:0}}

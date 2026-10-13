import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest'
import { assertFails,assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc,setDoc,getDoc,updateDoc,getDocs,collection,Timestamp,serverTimestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { environment,seed,ops,input,database } from './fixture'
import { createSubscriptionOperations } from '../src/data/subscriptions'
import { createInvoiceOperations,readSharedInvoice } from '../src/data/invoice-operations'
import { createOperations } from '../src/data/transactions'
import { dateKey } from '../src/domain/business'
import type { SignupRequest } from '../src/domain/subscriptions'
let env:RulesTestEnvironment
beforeAll(async()=>{env=await environment()});beforeEach(async()=>{await seed(env);await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore() as unknown as Firestore,'platformAdmins/owner'),{active:true})})});afterAll(async()=>env?.cleanup())
const expiry=()=>dateKey(Date.now()+30*86400000)
const profile=(uid='business1')=>({name:'Pemilik '+uid,email:uid+'@test.example',phone:'081234567890',businessName:'Usaha '+uid,address:''})
const businessDb=(uid='business1')=>env.authenticatedContext(uid,{email:uid+'@test.example'}).firestore() as unknown as Firestore
const subscription=(uid='business1')=>createSubscriptionOperations({db:businessDb(uid),uid,email:uid+'@test.example'})
const admin=()=>createSubscriptionOperations({db:database(env),uid:'owner',email:'owner@test.example'})
const anonymous=()=>env.unauthenticatedContext().firestore() as unknown as Firestore
const orderId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
async function approved(uid='business1'){await subscription(uid).submit(profile(uid));await admin().approve(uid,expiry());return {uid,...(await getDoc(doc(businessDb(uid),'applications/'+uid))).data()} as SignupRequest}
async function invoice(){await ops(env).createOrder(await input(env,30000),orderId);return createInvoiceOperations({db:database(env),storeId:'main',uid:'owner'})}
it('signup sendiri pending, tanpa akses toko maupun kemampuan menaikkan role',async()=>{
 await subscription().submit(profile());const db=businessDb()
 expect((await getDoc(doc(db,'applications/business1'))).data()?.status).toBe('pending')
 await assertFails(getDocs(collection(db,'applications')));await assertFails(getDoc(doc(db,'stores/main/settings/general')))
 await assertFails(updateDoc(doc(db,'applications/business1'),{status:'approved',reviewedAt:serverTimestamp(),reviewedBy:'business1',storeId:'business-business1'}))
 await assertFails(setDoc(doc(db,'platformAdmins/business1'),{active:true}))
 await assertFails(setDoc(doc(db,'accounts/business1'),{storeId:'main'}))
 await assertFails(setDoc(doc(db,'stores/business-business1/members/business1'),{role:'owner',active:true,name:'Pemilik'}))
 await assertFails(setDoc(doc(db,'applications/other'),{...profile(),status:'pending',storeId:'',reason:'',createdAt:serverTimestamp(),reviewedAt:null,reviewedBy:''}))
})
it('platform admin menyetujui atomik, idempotent dan toko terisolasi',async()=>{
 const a=await approved(),b=await approved('business2'),db=businessDb()
 expect(a.status).toBe('approved');await admin().approve('business1',expiry())
 await assertSucceeds(getDoc(doc(db,'stores/'+a.storeId+'/settings/general')))
 await assertFails(getDoc(doc(db,'stores/'+b.storeId+'/settings/general')))
 await assertFails(getDoc(doc(db,'stores/main/settings/general')))
 expect((await getDoc(doc(db,'accounts/business1'))).data()?.storeId).toBe(a.storeId)
 expect((await getDoc(doc(db,'stores/'+a.storeId+'/members/business1'))).data()?.role).toBe('owner')
 await assertFails(updateDoc(doc(db,'stores/'+a.storeId+'/subscription/access'),{expiresAt:Timestamp.fromMillis(Date.now()+300*86400000)}))
})
it('permohonan ditolak dan tetap tanpa membership',async()=>{
 await subscription().submit(profile());await admin().reject('business1','Konfirmasi belum selesai')
 const app=(await getDoc(doc(businessDb(),'applications/business1'))).data()!
 expect(app.status).toBe('rejected');expect(app.reason).toBe('Konfirmasi belum selesai')
 expect((await getDoc(doc(businessDb(),'accounts/business1'))).exists()).toBe(false)
 await expect(admin().approve('business1',expiry())).rejects.toThrow('ditinjau')
})
it('masa habis dan suspended menutup akses owner; hanya admin dapat aktifkan kembali',async()=>{
 const app=await approved(),target='stores/'+app.storeId
 await admin().set(app,expiry(),'suspended','Belum konfirmasi perpanjangan')
 await assertFails(getDoc(doc(businessDb(),target+'/settings/general')))
 await assertFails(setDoc(doc(businessDb(),target+'/services/sneaky'),{name:'Clean',price:1,days:1,description:'',active:true}))
 await admin().set(app,expiry(),'active','Sudah dikonfirmasi')
 await assertSucceeds(getDoc(doc(businessDb(),target+'/settings/general')))
 await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore() as unknown as Firestore,target+'/subscription/access'),{expiresAt:Timestamp.fromMillis(Date.now()-10000)})})
 await assertFails(getDoc(doc(businessDb(),target+'/settings/general')))
 await assertSucceeds(getDoc(doc(businessDb(),target+'/subscription/access')))
 await admin().set(app,expiry(),'active','Perpanjangan')
 await assertSucceeds(getDoc(doc(businessDb(),target+'/settings/general')))
})
it('toko berlangganan dapat order empat layanan plus DP dalam anggaran rules',async()=>{
 const app=await approved(),db=businessDb(),path='stores/'+app.storeId
 for(let n=0;n<4;n++)await setDoc(doc(db,path+'/services/deep'+n),{name:'Deep Clean',price:60000,days:3,description:'',active:true})
 const draft=await input(env,30000,4),op=createOperations({db,storeId:app.storeId,uid:'business1',role:'owner'})
 await op.saveCustomer({name:draft.customer.name,phone:draft.customer.phone,notes:''},'alya')
 await op.createOrder(draft,orderId)
 expect((await getDoc(doc(db,path+'/orders/'+orderId))).data()?.paid).toBe(30000)
 await assertFails(getDoc(doc(database(env,'kasir'),path+'/orders/'+orderId)))
})
it('invoice publik get tanpa login, list dan dokumen operasional tetap tertutup',async()=>{
 const api=await invoice(),share=await api.publish(orderId)
 expect(share.token).toMatch(/^[a-f0-9]{64}$/)
 const publicCopy=await readSharedInvoice(anonymous(),share.token)
 expect(publicCopy.snapshot.customerName).toBe('Alya Putri');expect(publicCopy.snapshot.balance).toBe(30000)
 expect(Object.keys(publicCopy.snapshot.items[0]!).sort()).toEqual(['description','color','serviceName','price','dueAt'].sort())
 expect(publicCopy.snapshot).not.toHaveProperty('customerPhone')
 expect(publicCopy.snapshot.items[0]).not.toHaveProperty('condition')
 await assertFails(getDocs(collection(anonymous(),'invoiceShares')))
 await assertFails(getDoc(doc(anonymous(),'stores/main/orders/'+orderId)))
 await expect(readSharedInvoice(anonymous(),'x'.repeat(64))).rejects.toThrow('tidak valid')
})
it('tautan snapshot stabil; pembayaran perlu publish ulang; cabut menutup publik',async()=>{
 const api=await invoice(),first=await api.publish(orderId)
 await ops(env).addPayment(orderId,{kind:'payment',amount:30000,method:'qris',tendered:30000,reason:'',refId:''},'final')
 expect((await readSharedInvoice(anonymous(),first.token)).snapshot.balance).toBe(30000)
 const refreshed=await api.publish(orderId);expect(refreshed.token).toBe(first.token);expect(refreshed.snapshot.balance).toBe(0)
 await api.revoke(orderId);await expect(readSharedInvoice(anonymous(),first.token)).rejects.toThrow('dicabut')
 expect((await api.getLink(orderId))?.enabled).toBe(false)
})
it('invoice tidak dapat diinjeksi PII, tagihan palsu, expiry panjang atau diubah usaha lain',async()=>{
 const api=await invoice(),share=await api.publish(orderId),ref=doc(database(env),'invoiceShares/'+share.token)
 await assertFails(updateDoc(ref,{snapshot:{...share.snapshot,customerPhone:'6281234567890'},updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{snapshot:{...share.snapshot,paid:60000,balance:0},updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{expiresAt:Timestamp.fromMillis(Date.now()+365*86400000),updatedAt:serverTimestamp()}))
 await approved()
 await assertFails(updateDoc(doc(businessDb(),'invoiceShares/'+share.token),{enabled:false,updatedAt:serverTimestamp()}))
 await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore() as unknown as Firestore,'invoiceShares/'+share.token),{expiresAt:Timestamp.fromMillis(Date.now()-1000)})})
 await expect(readSharedInvoice(anonymous(),share.token)).rejects.toThrow('kedaluwarsa')
})


it('akun Google tetap pending; email auth palsu dan phone identity tanpa bukti ditolak',async()=>{
 const google=env.authenticatedContext('google-new',{email:'google@test.example',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore() as unknown as Firestore
 const op=createSubscriptionOperations({db:google,uid:'google-new',email:'google@test.example'})
 await op.submit({...profile(),email:'google@test.example'});expect((await getDoc(doc(google,'applications/google-new'))).data()?.status).toBe('pending')
 await assertFails(getDoc(doc(google,'stores/main/settings/general')))
 await expect(op.submit({...profile(),email:'owner@test.example'})).rejects.toThrow('Email harus')
 const without=env.authenticatedContext('no-identity').firestore() as unknown as Firestore
 await assertFails(setDoc(doc(without,'applications/no-identity'),{...profile(),phone:'6281234567890',status:'pending',storeId:'',reason:'',createdAt:serverTimestamp(),reviewedAt:null,reviewedBy:''}))
})
it('phone-only menyimpan email kontak dan hanya nomor verified; contactemail admin tidak memberi akses',async()=>{
 const phone='+6281234567890',uid='phone-new',db=env.authenticatedContext(uid,{phone_number:phone,firebase:{sign_in_provider:'phone'}}).firestore() as unknown as Firestore
 const op=createSubscriptionOperations({db,uid,email:null,phoneNumber:phone})
 await op.submit({...profile(),email:'owner@test.example'});const app=(await getDoc(doc(db,'applications/'+uid))).data()!
 expect(app.email).toBe('owner@test.example');expect(app.status).toBe('pending')
 await assertFails(getDoc(doc(db,'platformAdmins/owner')));await assertFails(getDocs(collection(db,'applications')))
 await assertFails(updateDoc(doc(db,'applications/'+uid),{status:'approved'}))
 await expect(op.submit({...profile(),phone:'081234567891'})).rejects.toThrow('Nomor harus')
 const fake={...profile(),phone:'6281234567891',status:'pending',storeId:'',reason:'',createdAt:serverTimestamp(),reviewedAt:null,reviewedBy:''}
 const other=env.authenticatedContext('phone-fake',{phone_number:phone}).firestore() as unknown as Firestore
 await assertFails(setDoc(doc(other,'applications/phone-fake'),fake))
 await admin().approve(uid,expiry());await assertSucceeds(getDoc(doc(db,'stores/business-'+uid+'/settings/general')))
})


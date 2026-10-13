import { beforeAll,afterAll,it,expect } from 'vitest'
import { initializeApp,deleteApp } from 'firebase/app'
import { getAuth,connectAuthEmulator,signInWithCredential,GoogleAuthProvider,linkWithCredential,signOut,getIdTokenResult } from 'firebase/auth'
import { initializeFirestore,connectFirestoreEmulator,memoryLocalCache,doc,getDocFromServer } from 'firebase/firestore'
// Phone credentials are web-only; Node's Auth entry exposes an unsupported stub.
import { PhoneAuthProvider } from '../node_modules/@firebase/auth/dist/esm/index.js'
import { createSubscriptionOperations } from '../src/data/subscriptions'
const app=initializeApp({apiKey:'demo-key',projectId:'demo-solekasir',appId:'demo-auth-test'},'auth-integration-'+Date.now())
const auth=getAuth(app),db=initializeFirestore(app,{localCache:memoryLocalCache()})
beforeAll(()=>{connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8181)})
afterAll(async()=>{await signOut(auth);await deleteApp(app)})
const googleToken=(email:string)=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:'sole-qa-'+email,iss:'https://accounts.google.com',aud:'demo-solekasir',email,email_verified:true,name:'Pemilik Google QA',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),''].join('.')
async function phoneCredential(phone:string){
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phoneNumber:phone,recaptchaToken:'emulator-only'})})
 const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data))
 const codes=await (await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-solekasir/verificationCodes')).json()
 const code=codes.verificationCodes.find((v:{sessionInfo:string})=>v.sessionInfo===data.sessionInfo)
 if(!code)throw new Error('Emulator code unavailable')
 return {verificationId:data.sessionInfo,code:code.code,credential:PhoneAuthProvider.credential(data.sessionInfo,code.code)}
}
it('Google SDK emulator membuat identitas terverifikasi tetapi permohonan tetap pending',async()=>{
 const email='google-sdk-'+Date.now()+'@solekasir.test',result=await signInWithCredential(auth,GoogleAuthProvider.credential(googleToken(email)))
 expect(result.user.providerData.some(p=>p.providerId==='google.com')).toBe(true)
 await createSubscriptionOperations({db,uid:result.user.uid,email:result.user.email}).submit({name:'Google QA',email,phone:'081234567890',businessName:'Google QA',address:''})
 expect((await getDocFromServer(doc(db,'applications/'+result.user.uid))).data()?.status).toBe('pending')
 await expect(getDocFromServer(doc(db,'stores/main/settings/general'))).rejects.toThrow()
 await signOut(auth)
})
it('phone SDK emulator menolak kode salah, menerima kode benar, lalu phone-only dapat mendaftar',async()=>{
 const phone='+6281999900011',v=await phoneCredential(phone)
 await expect(signInWithCredential(auth,PhoneAuthProvider.credential(v.verificationId,v.code==='000000'?'111111':'000000'))).rejects.toThrow()
 const result=await signInWithCredential(auth,v.credential),token=await getIdTokenResult(result.user)
 expect(token.claims.phone_number).toBe(phone);expect(result.user.email).toBeNull()
 await createSubscriptionOperations({db,uid:result.user.uid,email:null,phoneNumber:result.user.phoneNumber}).submit({name:'Phone QA',email:'contact@solekasir.test',phone,businessName:'Phone QA',address:''})
 expect((await getDocFromServer(doc(db,'applications/'+result.user.uid))).data()?.status).toBe('pending')
 await signOut(auth)
})
it('link Google dan nomor menggunakan UID yang sama; login ulang lewat nomor mempertahankan UID',async()=>{
 const email='link-sdk-'+Date.now()+'@solekasir.test',google=GoogleAuthProvider.credential(googleToken(email)),user=(await signInWithCredential(auth,google)).user,uid=user.uid
 const phone=await phoneCredential('+6281999900012');expect((await linkWithCredential(user,phone.credential)).user.uid).toBe(uid)
 expect(auth.currentUser?.providerData.map(p=>p.providerId).sort()).toEqual(['google.com','phone'])
 await signOut(auth);const again=await phoneCredential('+6281999900012')
 expect((await signInWithCredential(auth,again.credential)).user.uid).toBe(uid)
 await signOut(auth)
})



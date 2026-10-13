import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDocFromServer } from 'firebase/firestore'
import { auth, db, defaultStoreId, setStoreId, configured } from '../lib/firebase'
import type { Membership } from '../domain/types'
import type { RegistrationInput, SignupRequest, Subscription } from '../domain/subscriptions'
import { submitApplication, validateRegistration } from '../data/subscriptions'
export const useSession = defineStore('session', () => {
 const user=ref<User|null>(null), member=ref<Membership|null>(null), loading=ref(true), error=ref(''), online=ref(navigator.onLine)
 const platformAdmin=ref(false), activeStoreId=ref(defaultStoreId), application=ref<SignupRequest|null>(null), subscription=ref<Subscription|null>(null)
 const accessState=ref<'active'|'pending'|'rejected'|'expired'|'unassigned'|'error'>('unassigned')
 const clock=ref(Date.now())
 const accessValid=computed(()=>!!member.value && (!subscription.value || (subscription.value.status==='active' && subscription.value.expiresAt.toMillis()>clock.value)))
 const owner=computed(()=>accessValid.value && member.value?.role==='owner')
 window.addEventListener('online',()=>{online.value=true})
 window.addEventListener('offline',()=>{online.value=false})
 setInterval(()=>{clock.value=Date.now();if(member.value&&!accessValid.value){member.value=null;accessState.value='expired'}},15000)
 let revision=0,resolveReady:()=>void
 const ready=new Promise<void>(r=>{resolveReady=r})
 async function refresh(){
  const version=++revision,u=auth.currentUser
  user.value=u;loading.value=true;member.value=null;error.value='';platformAdmin.value=false;application.value=null;subscription.value=null;accessState.value='unassigned'
  try{
   if(!u){activeStoreId.value=defaultStoreId;setStoreId(defaultStoreId);return}
   const [account,admin,app]=await Promise.all(['accounts','platformAdmins','applications'].map(p=>getDocFromServer(doc(db,`${p}/${u.uid}`))))
   if(version!==revision)return
   platformAdmin.value=admin!.exists()&&admin!.data().active===true
   application.value=app!.exists()?{uid:u.uid,...app!.data()} as SignupRequest:null
   const tenant=account!.exists()?account!.data().storeId as string:defaultStoreId
   activeStoreId.value=tenant;setStoreId(tenant)
   const membership=await getDocFromServer(doc(db,`stores/${tenant}/members/${u.uid}`))
   if(version!==revision)return
   if(membership.exists()&&membership.data().active&&['owner','kasir'].includes(membership.data().role)){
    const sub=await getDocFromServer(doc(db,`stores/${tenant}/subscription/access`))
    if(version!==revision)return
    subscription.value=sub.exists()?sub.data() as Subscription:null;clock.value=Date.now()
    if((!sub.exists()&&tenant==='main')||(sub.exists()&&subscription.value!.status==='active'&&subscription.value!.expiresAt.toMillis()>clock.value)){member.value=membership.data() as Membership;accessState.value='active'}else accessState.value='expired'
   }else if(application.value?.status==='pending')accessState.value='pending'
   else if(application.value?.status==='rejected')accessState.value='rejected'
  }catch{if(version===revision){error.value='Tidak dapat memeriksa akses. Periksa koneksi dan konfigurasi Firebase.';accessState.value='error'}}
  finally{if(version===revision)loading.value=false;resolveReady()}
 }
 onAuthStateChanged(auth,()=>{void refresh()})
 async function login(email:string,password:string){if(!configured)throw new Error('Isi konfigurasi Firebase terlebih dahulu.');await signInWithEmailAndPassword(auth,email.trim().toLowerCase(),password);await refresh()}
 async function signup(input:RegistrationInput,password:string){if(!configured)throw new Error('Isi konfigurasi Firebase terlebih dahulu.');const normalized=validateRegistration(input);if(password.length<8)throw new Error('Gunakan kata sandi minimal 8 karakter.');await createUserWithEmailAndPassword(auth,normalized.email,password);try{await submitApplication(normalized)}finally{await refresh()}}
 async function logout(){await signOut(auth);await refresh()}
 return {user,member,loading,error,online,owner,ready,platformAdmin,activeStoreId,application,subscription,accessState,accessValid,refresh,login,signup,logout}
})


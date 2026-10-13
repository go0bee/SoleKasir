import { beforeEach,afterEach,it,expect,vi } from 'vitest'
const sdk=vi.hoisted(()=>({popup:vi.fn(),linkPopup:vi.fn(),redirect:vi.fn(),linkRedirect:vi.fn(),redirectResult:vi.fn(),verify:vi.fn(),clear:vi.fn(),signin:vi.fn(),link:vi.fn(),credential:vi.fn()}))
vi.mock('firebase/auth',()=>({
 GoogleAuthProvider:class{setCustomParameters(){}},
 RecaptchaVerifier:class{clear(){sdk.clear()}},
 PhoneAuthProvider:class{verifyPhoneNumber(...args:unknown[]){return sdk.verify(...args)}static credential(...args:unknown[]){return sdk.credential(...args)}},
 signInWithPopup:sdk.popup,linkWithPopup:sdk.linkPopup,signInWithRedirect:sdk.redirect,linkWithRedirect:sdk.linkRedirect,getRedirectResult:sdk.redirectResult,signInWithCredential:sdk.signin,linkWithCredential:sdk.link
}))
import type { Auth } from 'firebase/auth'
import { createAuthMethods,authErrorText } from '../src/lib/auth-methods'
const container={isConnected:true} as HTMLElement
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('navigator',{onLine:true});sdk.verify.mockResolvedValue('verified-session');sdk.signin.mockResolvedValue({});sdk.link.mockResolvedValue({});sdk.credential.mockReturnValue({providerId:'phone'})})
afterEach(()=>vi.unstubAllGlobals())
function fixture(){const auth={currentUser:null,settings:{},emulatorConfig:null} as unknown as Auth,afterAuth=vi.fn().mockResolvedValue(undefined);return {auth,afterAuth,methods:createAuthMethods({auth,afterAuth})}}
it('OTP salah format tidak dikirim; kode Firebase salah tetap dapat dicoba, hanya sukses menyegarkan akses',async()=>{
 const {methods,afterAuth}=fixture(),challenge=await methods.startPhoneVerification('081234567890',container)
 expect(challenge.phone).toBe('+6281234567890');await expect(challenge.confirm('123')).rejects.toThrow('enam');expect(sdk.signin).not.toHaveBeenCalled()
 sdk.signin.mockRejectedValueOnce({code:'auth/invalid-verification-code'});await expect(challenge.confirm('111111')).rejects.toBeDefined();expect(afterAuth).not.toHaveBeenCalled()
 await challenge.confirm('222222');expect(afterAuth).toHaveBeenCalledOnce();expect(sdk.clear).toHaveBeenCalledOnce()
 await expect(challenge.confirm('222222')).rejects.toThrow('berakhir')
})
it('phone linking memakai akun yang sama dan tidak sign-in akun baru',async()=>{
 const {auth,methods}=fixture();auth.currentUser={uid:'existing'} as Auth['currentUser']
 const challenge=await methods.startPhoneVerification('081234567890',container,'link');await challenge.confirm('123456')
 expect(sdk.link).toHaveBeenCalledWith(auth.currentUser,{providerId:'phone'});expect(sdk.signin).not.toHaveBeenCalled()
})
it('perubahan akun dan pembatalan menutup challenge tanpa menghubungkan nomor',async()=>{
 const {auth,methods}=fixture();auth.currentUser={uid:'first'} as Auth['currentUser']
 const challenge=await methods.startPhoneVerification('081234567890',container,'link');auth.currentUser={uid:'second'} as Auth['currentUser']
 await expect(challenge.confirm('123456')).rejects.toThrow('Akun berubah');expect(sdk.link).not.toHaveBeenCalled()
 const next=await methods.startPhoneVerification('081234567890',container);next.dispose();next.dispose();await expect(next.confirm('123456')).rejects.toThrow('berakhir');expect(sdk.signin).not.toHaveBeenCalled()
})
it('kegagalan CAPTCHA membersihkan verifier; offline tidak memulai verifikasi',async()=>{
 const {methods}=fixture();sdk.verify.mockRejectedValueOnce(new Error('captcha'));await expect(methods.startPhoneVerification('081234567890',container)).rejects.toThrow('captcha');expect(sdk.clear).toHaveBeenCalledOnce()
 vi.stubGlobal('navigator',{onLine:false});await expect(methods.startPhoneVerification('081234567890',container)).rejects.toThrow('internet');expect(sdk.verify).toHaveBeenCalledOnce()
})
it('Google berhasil menyegarkan akses; popup diblokir memakai redirect dan link menjaga UID',async()=>{
 const {auth,methods,afterAuth}=fixture();sdk.popup.mockResolvedValueOnce({});await methods.google();expect(afterAuth).toHaveBeenCalledOnce()
 sdk.popup.mockRejectedValueOnce({code:'auth/popup-blocked'});await methods.google();expect(sdk.redirect).toHaveBeenCalledOnce()
 auth.currentUser={uid:'existing'} as Auth['currentUser'];sdk.linkPopup.mockResolvedValueOnce({});await methods.google('link');expect(sdk.linkPopup.mock.calls[0]![0]).toBe(auth.currentUser)
})
it('pesan collision, kode salah, dan batas layanan mudah dipahami',()=>{
 expect(authErrorText({code:'auth/credential-already-in-use'})).toContain('akun lain')
 expect(authErrorText({code:'auth/invalid-verification-code'})).toContain('Kode SMS')
 expect(authErrorText({code:'auth/quota-exceeded'})).toContain('email atau Google')
})


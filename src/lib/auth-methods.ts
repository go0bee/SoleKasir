import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  signInWithCredential,
  linkWithCredential,
} from "firebase/auth";
import type { Auth, UserCredential } from "firebase/auth";
import { normalizePhone } from "../domain/business";
export interface PhoneChallenge {
  phone: string;
  confirm(code: string): Promise<void>;
  dispose(): void;
}
export function authErrorText(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    "auth/popup-closed-by-user": "Jendela Google ditutup. Silakan coba lagi.",
    "auth/cancelled-popup-request":
      "Proses Google dibatalkan. Silakan coba lagi.",
    "auth/popup-blocked":
      "Izinkan jendela masuk Google di browser, lalu coba lagi.",
    "auth/unauthorized-domain":
      "Domain aplikasi belum diizinkan untuk login. Hubungi pengelola.",
    "auth/operation-not-allowed":
      "Metode masuk ini belum aktif. Hubungi pengelola.",
    "auth/operation-not-supported-in-this-environment":
      "Buka aplikasi di Safari atau Chrome untuk melanjutkan.",
    "auth/account-exists-with-different-credential":
      "Akun ini sudah memakai metode lain. Masuk dengan metode sebelumnya, lalu hubungkan Google melalui menu Lainnya.",
    "auth/credential-already-in-use":
      "Google atau nomor ini sudah digunakan akun lain. Masuk dengan akun tersebut atau hubungi pengelola.",
    "auth/email-already-in-use":
      "Email ini sudah terdaftar. Masuk dengan akun sebelumnya.",
    "auth/provider-already-linked": "Metode ini sudah terhubung ke akun Anda.",
    "auth/requires-recent-login":
      "Masuk ulang sebelum menghubungkan metode baru.",
    "auth/invalid-phone-number":
      "Nomor tidak valid. Gunakan nomor Indonesia, misalnya 081234567890.",
    "auth/missing-phone-number": "Isi nomor telepon terlebih dahulu.",
    "auth/invalid-verification-code":
      "Kode SMS tidak cocok. Periksa enam angka yang diterima.",
    "auth/code-expired": "Kode sudah kedaluwarsa. Minta kode baru.",
    "auth/session-expired": "Sesi verifikasi berakhir. Minta kode baru.",
    "auth/too-many-requests":
      "Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.",
    "auth/quota-exceeded":
      "Layanan SMS sementara mencapai batas. Gunakan email atau Google.",
    "auth/billing-not-enabled":
      "Layanan SMS belum tersedia pada project ini. Gunakan email atau Google, atau hubungi pengelola.",
    "auth/captcha-check-failed":
      "Pemeriksaan keamanan belum berhasil. Coba verifikasi kembali.",
    "auth/missing-app-credential":
      "Pemeriksaan keamanan belum selesai. Coba lagi.",
    "auth/invalid-app-credential":
      "Pemeriksaan keamanan tidak valid. Muat ulang lalu coba lagi.",
    "auth/network-request-failed":
      "Koneksi terputus. Periksa internet lalu coba lagi.",
  };
  return (
    messages[code] ||
    (code.startsWith("auth/")
      ? "Proses masuk belum berhasil. Periksa data atau coba metode lain."
      : error instanceof Error
        ? error.message
        : "Terjadi kesalahan. Silakan coba lagi.")
  );
}
export function createAuthMethods({
  auth,
  emulator = false,
  afterAuth,
}: {
  auth: Auth;
  emulator?: boolean;
  afterAuth: () => Promise<void>;
}) {
  function guard() {
    if (typeof navigator !== "undefined" && !navigator.onLine)
      throw new Error("Sambungkan internet terlebih dahulu.");
  }
  function signedIn() {
    const user = auth.currentUser;
    if (!user)
      throw new Error("Masuk terlebih dahulu untuk menghubungkan metode.");
    return user;
  }
  const provider = () => {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  };
  async function google(mode: "login" | "link" = "login") {
    guard();
    const user = mode === "link" ? signedIn() : null,
      p = provider();
    try {
      if (user) await linkWithPopup(user, p);
      else await signInWithPopup(auth, p);
      await afterAuth();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (
        [
          "auth/popup-blocked",
          "auth/operation-not-supported-in-this-environment",
        ].includes(code)
      ) {
        if (user) await linkWithRedirect(user, p);
        else await signInWithRedirect(auth, p);
      } else throw error;
    }
  }
  async function finishRedirect(): Promise<UserCredential | null> {
    return getRedirectResult(auth);
  }
  async function startPhoneVerification(
    raw: string,
    container: HTMLElement,
    mode: "login" | "link" = "login",
  ): Promise<PhoneChallenge> {
    guard();
    const phone = "+" + normalizePhone(raw),
      target = mode === "link" ? signedIn() : null;
    if (!container.isConnected)
      throw new Error(
        "Form verifikasi belum siap. Buka ulang form nomor telepon.",
      );
    // Testing bypass is deliberately restricted to the actual Auth emulator.
    if (emulator && auth.emulatorConfig)
      auth.settings.appVerificationDisabledForTesting = true;
    const verifier = new RecaptchaVerifier(auth, container, {
      size:
        container.clientWidth > 0 && container.clientWidth < 304
          ? "compact"
          : "normal",
    });
    let disposed = false,
      used = false,
      confirming = false;
    const dispose = () => {
      if (!disposed) {
        disposed = true;
        verifier.clear();
      }
    };
    try {
      const verificationId = await new PhoneAuthProvider(
        auth,
      ).verifyPhoneNumber(phone, verifier);
      return {
        phone,
        dispose,
        async confirm(code: string) {
          guard();
          if (disposed || used)
            throw new Error("Sesi verifikasi berakhir. Minta kode baru.");
          if (confirming) throw new Error("Verifikasi masih diproses.");
          if (!/^\d{6}$/.test(code))
            throw new Error("Isi enam angka kode SMS.");
          if (target && auth.currentUser?.uid !== target.uid) {
            dispose();
            throw new Error(
              "Akun berubah. Masuk ulang sebelum menghubungkan nomor.",
            );
          }
          confirming = true;
          try {
            const credential = PhoneAuthProvider.credential(
              verificationId,
              code,
            );
            if (target) await linkWithCredential(target, credential);
            else await signInWithCredential(auth, credential);
            used = true;
            dispose();
            await afterAuth();
          } finally {
            confirming = false;
          }
        },
      };
    } catch (error) {
      dispose();
      throw error;
    }
  }
  return { google, finishRedirect, startPhoneVerification };
}

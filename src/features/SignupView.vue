<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Footprints, ArrowRight, ShieldCheck } from "lucide-vue-next";
import { useSession } from "../stores/session";
import { configured } from "../lib/firebase";
import { authErrorText } from "../lib/auth-methods";
import AuthMethods from "../components/AuthMethods.vue";
const session = useSession(),
  router = useRouter();
const form = reactive({
  name: "",
  businessName: "",
  address: "",
  phone: "",
  email: "",
});
const password = ref(""),
  confirmation = ref(""),
  busy = ref(false),
  socialBusy = ref(false),
  error = ref("");
async function authenticated() {
  await router.replace(
    session.member && session.accessState === "active"
      ? "/"
      : session.platformAdmin
        ? "/admin/subscriptions"
        : "/pending",
  );
}
async function submit() {
  if (busy.value || socialBusy.value) return;
  error.value = "";
  if (password.value !== confirmation.value) {
    error.value = "Konfirmasi kata sandi belum cocok.";
    return;
  }
  busy.value = true;
  try {
    await session.signup({ ...form }, password.value);
    await router.replace("/pending");
  } catch (e) {
    error.value = authErrorText(e);
    if (session.user)
      await router.replace({
        path: "/pending",
        state: {
          registrationDraft: { ...form },
          registrationError: error.value,
        },
      });
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="login-page signup-page">
    <section class="login-story">
      <RouterLink to="/login" class="brand"
        ><span class="brand-mark"><Footprints :size="28" /></span
        ><span
          >SoleKasir<small>Rapi sepatu, rapi usaha.</small></span
        ></RouterLink
      >
      <div>
        <span class="eyebrow">UNTUK PEMILIK USAHA CUCI SEPATU</span>
        <h1>Ruang kerja<br />untuk langkah<br /><em>usaha Anda.</em></h1>
        <p>
          Daftarkan usaha Anda. Pengelola SoleKasir akan memeriksa permohonan
          dan mengonfirmasi langganan sebelum akses toko dibuka.
        </p>
      </div>
      <span class="login-foot"
        ><ShieldCheck :size="18" /> Setiap usaha memiliki ruang kerjanya
        sendiri</span
      >
    </section>
    <section class="login-form signup-form">
      <div class="mobile-login-brand">
        <Footprints :size="28" /><strong>SoleKasir</strong>
      </div>
      <span class="eyebrow">MULAI DARI USAHA ANDA</span>
      <h2>Daftarkan usaha</h2>
      <p class="muted">
        Akses kasir dibuka setelah langganan Anda disetujui pengelola.
      </p>
      <p v-if="!session.online" class="notice" role="alert">
        Anda sedang offline. Sambungkan internet untuk mendaftar.
      </p>
      <AuthMethods
        :disabled="busy"
        @authenticated="authenticated"
        @busy-change="socialBusy = $event"
      />
      <p class="field-help social-signup-help">
        Dengan Google atau nomor telepon, Anda akan melengkapi data usaha
        setelah verifikasi akun.
      </p>
      <div class="auth-divider"><span>atau daftar dengan email</span></div>
      <form @submit.prevent="submit">
        <div class="form-grid">
          <label class="span-2"
            >Nama pemilik<input
              v-model="form.name"
              autocomplete="name"
              required
              maxlength="100"
              placeholder="Nama lengkap Anda"
          /></label>
          <label class="span-2"
            >Nama usaha<input
              v-model="form.businessName"
              autocomplete="organization"
              required
              maxlength="100"
              placeholder="Contoh: Langkah Shoe Care"
          /></label>
          <label class="span-2"
            >Nomor WhatsApp<input
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              required
              maxlength="20"
              placeholder="08xxxxxxxxxx"
          /></label>
          <label class="span-2"
            >Email<input
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              maxlength="160"
              placeholder="nama@tokomu.com"
          /></label>
          <label class="span-2"
            >Alamat usaha <small class="muted">Opsional</small
            ><textarea
              v-model="form.address"
              autocomplete="street-address"
              maxlength="300"
              placeholder="Alamat toko atau tempat usaha"
            />
          </label>
          <label
            >Kata sandi<input
              v-model="password"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
              placeholder="Minimal 8 karakter"
          /></label>
          <label
            >Ulangi kata sandi<input
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
              placeholder="Konfirmasi kata sandi"
          /></label>
        </div>
        <p class="signup-privacy field-help">
          Data pemilik dan kontak disimpan untuk pemeriksaan permohonan serta
          konfirmasi langganan secara manual. Mengirim permohonan belum
          mengaktifkan akses toko.
        </p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button
          class="button full"
          :disabled="
            busy ||
            socialBusy ||
            session.loading ||
            !session.online ||
            !configured
          "
        >
          {{ busy ? "Mengirim permohonan…" : "Kirim permohonan langganan"
          }}<ArrowRight :size="18" />
        </button>
      </form>
      <p class="login-help">
        Sudah punya akun?
        <RouterLink to="/login" class="text-link"
          >Masuk ke SoleKasir</RouterLink
        >
      </p>
    </section>
  </main>
</template>

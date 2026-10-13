<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Footprints, ArrowRight, ShieldCheck } from "lucide-vue-next";
import { useSession } from "../stores/session";
import { configured, emulator } from "../lib/firebase";
import { errorText } from "../components/state";
const session = useSession(),
  router = useRouter(),
  email = ref(""),
  password = ref(""),
  busy = ref(false),
  error = ref("");
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await session.login(email.value.trim(), password.value);
    await session.refresh();
    await router.push(session.member && session.accessState === 'active' ? '/' : session.platformAdmin ? '/admin/subscriptions' : '/pending');
  } catch (e) {
    error.value = errorText(e).includes("auth/")
      ? "Email atau kata sandi tidak cocok, atau layanan masuk belum tersedia."
      : errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="login-page">
    <section class="login-story">
      <div class="brand">
        <span class="brand-mark"><Footprints :size="28" /></span
        ><span>SoleKasir<small>Rapi sepatu, rapi usaha.</small></span>
      </div>
      <div>
        <span class="eyebrow">RUANG KERJA USAHA ANDA</span>
        <h1>Setiap pasang,<br />dikelola dengan<br /><em>lebih tenang.</em></h1>
        <p>
          Dari sepatu diterima sampai kembali ke pemiliknya. Satu tempat untuk
          mengurus semuanya.
        </p>
      </div>
      <span class="login-foot"
        ><ShieldCheck :size="18" /> Akses khusus tim toko</span
      >
    </section>
    <section class="login-form">
      <div class="mobile-login-brand">
        <Footprints :size="28" /><strong>SoleKasir</strong>
      </div>
      <span class="eyebrow">SELAMAT DATANG KEMBALI</span>
      <h2>Masuk ke toko</h2>
      <p class="muted">Masuk dengan akun usaha Anda atau akun tim toko.</p>
      <div v-if="!configured" class="notice">
        Konfigurasi Firebase belum tersedia. Isi file .env.local mengikuti
        README untuk menghubungkan toko, atau jalankan emulator.
      </div>
      <div v-if="emulator" class="notice">
        Mode pengembangan Firebase Emulator. Setelah seed: owner@solekasir.test
        atau kasir@solekasir.test, kata sandi SoleDemo123! Transaksi tersimpan
        di emulator.
      </div>
      <form @submit.prevent="submit">
        <label
          >Email<input
            v-model="email"
            type="email"
            autocomplete="username"
            placeholder="nama@tokomu.com"
            required /></label
        ><label
          >Kata sandi<input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Masukkan kata sandi"
            required
        /></label>
        <p v-if="error || session.error" class="form-error" role="alert">
          {{ error || session.error }}
        </p>
        <button
          class="button full"
          type="submit"
          :disabled="busy || session.loading || !session.online || !configured"
        >
          {{ busy ? "Memeriksa akun…" : "Masuk ke ruang kerja"
          }}<ArrowRight :size="18" />
        </button>
      </form>
      <p class="login-help">Pemilik usaha baru? <RouterLink to="/signup" class="text-link">Daftarkan usaha</RouterLink><br />Lupa kata sandi? Hubungi pengelola SoleKasir atau pemilik toko.</p>
      <button
        v-if="session.user && !session.member"
        class="button secondary full"
        @click="session.logout()"
      >
        Keluar dari akun ini
      </button>
    </section>
  </main>
</template>

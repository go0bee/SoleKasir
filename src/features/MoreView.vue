<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  ChartNoAxesCombined,
  Layers,
  SlidersHorizontal,
  ChevronRight,
  LogOut,
  Share,
  PlusSquare,
  Smartphone,
  ShieldCheck,
  Store,
} from "lucide-vue-next";
import { useSession } from "../stores/session";
import { useSettings, useTask } from "../components/state";
import { emulator } from "../lib/firebase";
const session = useSession(),
  settings = useSettings(),
  router = useRouter(),
  confirm = ref(false),
  task = useTask();
async function logout() {
  await task.run(async () => {
    await session.logout();
    await router.replace("/login");
  });
}
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">SEMUA YANG ANDA BUTUHKAN</span>
      <h1>Lainnya</h1>
      <p>Kelola toko dan ruang kerja Anda.</p>
    </div>
  </section>
  <div class="more-layout">
    <div>
      <section class="panel store-profile">
        <span class="brand-mark"><Store :size="25" /></span>
        <div>
          <h2>{{ settings.name }}</h2>
          <p>{{ settings.address || "Alamat toko belum diatur." }}</p>
          <small>{{ settings.hours }}</small>
        </div>
        <span class="badge green">{{
          emulator ? "Emulator" : "Satu outlet"
        }}</span>
      </section>
      <section v-if="session.owner" class="panel more-links">
        <RouterLink to="/reports"
          ><span class="menu-icon"><ChartNoAxesCombined :size="22" /></span
          ><span
            ><strong>Laporan toko</strong
            ><small>Arus uang, order, dan pengeluaran</small></span
          ><ChevronRight :size="20" /></RouterLink
        ><RouterLink to="/services"
          ><span class="menu-icon"><Layers :size="22" /></span
          ><span
            ><strong>Layanan & harga</strong
            ><small>Perawatan sepatu dan estimasi</small></span
          ><ChevronRight :size="20" /></RouterLink
        ><RouterLink to="/settings"
          ><span class="menu-icon"><SlidersHorizontal :size="22" /></span
          ><span
            ><strong>Pengaturan toko</strong
            ><small>Identitas, ketentuan, dan template pesan</small></span
          ><ChevronRight :size="20"
        /></RouterLink>
      </section>
      <section class="panel form-panel">
        <div class="step-heading">
          <ShieldCheck :size="24" />
          <div>
            <h2>Akun Anda</h2>
            <p>
              {{ session.member?.name }} ·
              {{ session.owner ? "Pemilik toko" : "Kasir" }}
            </p>
          </div>
        </div>
        <p>{{ session.user?.email }}</p>
        <p class="field-help">
          Akun pemilik usaha memerlukan persetujuan pengelola SoleKasir. Akses tim dikelola pemilik toko.
        </p>
        <p v-if="session.subscription" class="notice compact">Langganan aktif hingga {{ new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long' }).format(session.subscription.expiresAt.toMillis()) }}. Hubungi pengelola SoleKasir untuk perpanjangan.</p>
        <RouterLink v-if="session.platformAdmin" to="/admin/subscriptions" class="text-link"><ShieldCheck :size="18" />Persetujuan langganan</RouterLink>
        <p v-if="task.error.value" class="form-error">{{ task.error.value }}</p>
        <div v-if="confirm" class="confirmation">
          <strong>Keluar dari ruang kerja?</strong>
          <p>Pastikan seluruh perubahan telah tersimpan sebelum keluar.</p>
          <div class="form-actions">
            <button
              class="button secondary"
              :disabled="task.busy.value"
              @click="confirm = false"
            >
              Batal</button
            ><button
              class="button danger"
              :disabled="task.busy.value"
              @click="logout"
            >
              {{ task.busy.value ? "Keluar…" : "Ya, keluar" }}
            </button>
          </div>
        </div>
        <button
          v-else
          class="button secondary danger-text"
          @click="confirm = true"
        >
          <LogOut :size="18" />Keluar dari akun
        </button>
      </section>
    </div>
    <section class="panel form-panel install-panel">
      <span class="install-icon"><Smartphone :size="34" /></span
      ><span class="eyebrow">SELALU DEKAT, SATU SENTUHAN</span>
      <h2>Pasang di Home Screen iPhone</h2>
      <p>Buka SoleKasir melalui Safari, lalu ikuti langkah berikut.</p>
      <ol class="install-steps">
        <li>
          <span>1</span>
          <div>
            Ketuk tombol <strong>Bagikan</strong> <Share :size="16" /> di
            Safari.
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            Pilih <strong>Tambah ke Layar Utama</strong>
            <PlusSquare :size="16" />.
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            Ketuk <strong>Tambah</strong>. Buka aplikasi melalui ikon SoleKasir.
          </div>
        </li>
      </ol>
      <p class="notice compact">
        Android: buka menu browser lalu pilih Instal aplikasi atau Tambahkan ke
        layar utama. Transaksi tetap memerlukan koneksi internet.
      </p>
    </section>
  </div>
</template>

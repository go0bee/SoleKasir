<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import {
  Footprints,
  Clock3,
  RefreshCw,
  LogOut,
  ShieldCheck,
  CircleAlert,
} from "lucide-vue-next";
import { useSession } from "../stores/session";
import { useTask } from "../components/state";
import { submitApplication } from "../data/subscriptions";
import { dateTime } from "../domain/business";
const session = useSession(),
  router = useRouter(),
  task = useTask();
const draft = window.history.state?.registrationDraft;
const form = reactive({
  name:
    typeof draft?.name === "string"
      ? draft.name
      : session.user?.displayName || "",
  businessName:
    typeof draft?.businessName === "string" ? draft.businessName : "",
  address: typeof draft?.address === "string" ? draft.address : "",
  phone:
    session.user?.phoneNumber ||
    (typeof draft?.phone === "string" ? draft.phone : ""),
  email:
    session.user?.email ||
    (typeof draft?.email === "string" ? draft.email : ""),
});
const registrationError =
  typeof window.history.state?.registrationError === "string"
    ? window.history.state.registrationError
    : "";
const missing = computed(
  () =>
    !session.application &&
    !session.member &&
    !session.platformAdmin &&
    session.accessState !== "error" &&
    session.accessState !== "expired",
);
const suspended = computed(() => session.subscription?.status === "suspended");
const title = computed(() =>
  session.accessState === "error"
    ? "Akses belum dapat diperiksa"
    : suspended.value
      ? "Akses toko ditangguhkan"
      : session.accessState === "expired"
        ? "Langganan perlu diperpanjang"
        : session.application?.status === "rejected"
          ? "Permohonan belum disetujui"
          : session.member && session.accessState === "active"
            ? "Toko Anda siap digunakan"
            : missing.value
              ? "Lengkapi permohonan usaha"
              : "Menunggu persetujuan",
);
async function refresh() {
  await task.run(async () => {
    await session.refresh();
    if (session.member && session.accessState === "active")
      await router.replace("/");
    else if (session.platformAdmin)
      await router.replace("/admin/subscriptions");
  }, "Status langganan telah diperiksa.");
}
async function save() {
  await task.run(async () => {
    await submitApplication({
      ...form,
      email: session.user?.email || form.email,
      phone: session.user?.phoneNumber || form.phone,
    });
    await session.refresh();
  }, "Permohonan berhasil dikirim. Tunggu konfirmasi pengelola.");
}
async function logout() {
  await task.run(async () => {
    await session.logout();
    await router.replace("/login");
  });
}
</script>
<template>
  <main class="account-page">
    <RouterLink to="/pending" class="brand"
      ><span class="brand-mark"><Footprints :size="25" /></span
      ><span>SoleKasir<small>Rapi sepatu, rapi usaha.</small></span></RouterLink
    >
    <section class="panel approval-status">
      <span class="status-illustration"
        ><CircleAlert
          v-if="
            suspended ||
            session.accessState === 'expired' ||
            session.accessState === 'error' ||
            session.application?.status === 'rejected'
          "
          :size="34" /><ShieldCheck
          v-else-if="session.accessState === 'active'"
          :size="34" /><Clock3 v-else :size="34"
      /></span>
      <span class="eyebrow">LANGGANAN SOLEKASIR</span>
      <h1>{{ title }}</h1>
      <p v-if="session.accessState === 'error'" class="muted">
        {{
          session.error ||
          "Periksa koneksi lalu coba periksa persetujuan kembali."
        }}
      </p>
      <p
        v-else-if="suspended || session.accessState === 'expired'"
        class="muted"
      >
        Hubungi pengelola SoleKasir untuk konfirmasi dan perpanjangan akses.
        Perpanjangan membutuhkan persetujuan pengelola.
      </p>
      <p v-else-if="session.application?.status === 'rejected'" class="muted">
        Hubungi pengelola SoleKasir untuk meninjau permohonan Anda kembali.
      </p>
      <p v-else-if="missing" class="muted">
        Akun Anda sudah dibuat. Lengkapi data usaha berikut agar pengelola dapat
        memeriksa langganan Anda.
      </p>
      <p v-else class="muted">
        Pengelola SoleKasir akan memeriksa data usaha dan mengonfirmasi
        langganan Anda. Akses kasir dibuka setelah persetujuan.
      </p>
      <p
        v-if="session.application?.reason || session.subscription?.reason"
        class="notice"
      >
        Catatan pengelola:
        {{ session.subscription?.reason || session.application?.reason }}
      </p>
      <dl v-if="session.application" class="application-facts">
        <div>
          <dt>Usaha</dt>
          <dd>{{ session.application.businessName }}</dd>
        </div>
        <div>
          <dt>Pemilik</dt>
          <dd>{{ session.application.name }}</dd>
        </div>
        <div>
          <dt>Kontak</dt>
          <dd>
            {{ session.application.email }}<br />{{ session.application.phone }}
          </dd>
        </div>
        <div>
          <dt>Dikirim</dt>
          <dd>{{ dateTime(session.application.createdAt) }}</dd>
        </div>
      </dl>
      <p v-if="session.subscription" class="field-help">
        Masa langganan hingga
        {{ dateTime(session.subscription.expiresAt) }} (Asia/Jakarta).
      </p>
      <form v-if="missing" class="inline-form" @submit.prevent="save">
        <div class="form-grid">
          <label
            >Nama pemilik<input
              v-model="form.name"
              required
              maxlength="100"
              autocomplete="name" /></label
          ><label
            >Nama usaha<input
              v-model="form.businessName"
              required
              maxlength="100"
              autocomplete="organization" /></label
          ><label
            >{{ session.user?.phoneNumber ? "Nomor terverifikasi" : "WhatsApp"
            }}<input
              v-model="form.phone"
              type="tel"
              required
              maxlength="20"
              autocomplete="tel"
              :readonly="!!session.user?.phoneNumber" /></label
          ><label
            >{{ session.user?.email ? "Email akun" : "Email kontak"
            }}<input
              v-model="form.email"
              type="email"
              required
              maxlength="160"
              autocomplete="email"
              :readonly="!!session.user?.email" /></label
          ><label class="span-2"
            >Alamat usaha (opsional)<textarea
              v-model="form.address"
              maxlength="300"
              autocomplete="street-address"
            />
          </label>
        </div>
        <p
          v-if="!session.user?.email && session.user?.phoneNumber"
          class="field-help"
        >
          Akun Anda diverifikasi melalui nomor telepon. Email kontak digunakan
          untuk konfirmasi langganan.
        </p>
        <p class="field-help">
          Data ini disimpan untuk pemeriksaan dan konfirmasi langganan secara
          manual.
        </p>
        <button
          class="button full"
          :disabled="task.busy.value || !session.online"
        >
          {{ task.busy.value ? "Menyimpan…" : "Kirim data usaha" }}
        </button>
      </form>
      <p v-if="missing && registrationError" class="form-error" role="alert">
        {{ registrationError }}
      </p>
      <p v-if="!session.online" class="notice" role="alert">
        Anda offline. Sambungkan internet untuk memeriksa status.
      </p>
      <p v-if="task.error.value" class="form-error" role="alert">
        {{ task.error.value }}
      </p>
      <p v-if="task.success.value" class="success-message" role="status">
        {{ task.success.value }}
      </p>
      <div class="account-actions">
        <button
          class="button"
          :disabled="task.busy.value || session.loading || !session.online"
          @click="refresh"
        >
          <RefreshCw :size="18" />{{
            task.busy.value ? "Memeriksa…" : "Periksa persetujuan"
          }}</button
        ><button
          class="button secondary"
          :disabled="task.busy.value"
          @click="logout"
        >
          <LogOut :size="18" />Keluar dari akun
        </button>
      </div>
    </section>
  </main>
</template>

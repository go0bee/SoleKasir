<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ShieldCheck,
  RefreshCw,
  Check,
  ChevronRight,
  LogOut,
  Footprints,
} from "lucide-vue-next";
import type { SignupRequest, Subscription } from "../domain/subscriptions";
import {
  listApplications,
  approveApplication,
  rejectApplication,
  getApplicationSubscription,
  setSubscription,
} from "../data/subscriptions";
import { useSession } from "../stores/session";
import { useTask } from "../components/state";
import { dateKey, dateTime } from "../domain/business";
const session = useSession(),
  router = useRouter(),
  task = useTask(),
  action = useTask(),
  details = useTask();
const status = ref<SignupRequest["status"]>("pending"),
  rows = ref<SignupRequest[]>([]),
  cursor = ref<unknown>(),
  hasMore = ref(false),
  selected = ref<SignupRequest>(),
  subscription = ref<Subscription | null>(null);
const expiry = ref(dateKey(Date.now() + 30 * 86400000)),
  reason = ref(""),
  mode = ref<"approve" | "reject" | "extend" | "suspend">(),
  confirmation = ref(false);
const standalone = computed(
  () => !session.member || session.accessState !== "active",
);
const labels = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};
async function load(more = false) {
  await task.run(async () => {
    const page = await listApplications(
      status.value,
      more ? cursor.value : undefined,
    );
    rows.value = more ? [...rows.value, ...page.rows] : page.rows;
    cursor.value = page.cursor;
    hasMore.value = page.hasMore;
  });
}
async function select(request: SignupRequest) {
  selected.value = request;
  subscription.value = null;
  mode.value = undefined;
  confirmation.value = false;
  reason.value = "";
  expiry.value = dateKey(Date.now() + 30 * 86400000);
  action.error.value = "";
  action.success.value = "";
  if (request.status === "approved")
    await details.run(async () => {
      const value = await getApplicationSubscription(request);
      if (selected.value?.uid === request.uid) {
        subscription.value = value;
        if (value && value.expiresAt.toMillis() > Date.now())
          expiry.value = dateKey(value.expiresAt.toMillis() + 30 * 86400000);
      }
    });
}
function open(next: NonNullable<typeof mode.value>) {
  mode.value = next;
  confirmation.value = false;
  reason.value = "";
  action.error.value = "";
  action.success.value = "";
}
async function commit() {
  const request = selected.value,
    operation = mode.value;
  if (!request || !operation) return;
  if (
    (operation === "reject" || operation === "suspend") &&
    !reason.value.trim()
  ) {
    action.error.value =
      "Isi alasan agar pemilik usaha memahami keputusan ini.";
    return;
  }
  const result = await action.run(
    async () => {
      if (operation === "approve")
        await approveApplication(request.uid, expiry.value);
      else if (operation === "reject")
        await rejectApplication(request.uid, reason.value);
      else
        await setSubscription(
          request,
          operation === "suspend" && subscription.value
            ? dateKey(subscription.value.expiresAt.toMillis())
            : expiry.value,
          operation === "suspend" ? "suspended" : "active",
          reason.value,
        );
      return true;
    },
    operation === "approve"
      ? "Usaha disetujui. Ruang kerja toko terpisah telah dibuka."
      : operation === "reject"
        ? "Permohonan ditolak."
        : operation === "suspend"
          ? "Akses toko ditangguhkan."
          : "Masa langganan diperbarui.",
  );
  if (result) {
    selected.value = undefined;
    mode.value = undefined;
    confirmation.value = false;
    await load();
  }
}
async function logout() {
  await action.run(async () => {
    await session.logout();
    await router.replace("/login");
  });
}
watch(
  status,
  () => {
    rows.value = [];
    selected.value = undefined;
    cursor.value = undefined;
    hasMore.value = false;
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <component
    :is="standalone ? 'main' : 'section'"
    :class="{ 'admin-standalone': standalone }"
  >
    <header v-if="standalone" class="admin-account-header">
      <div class="brand">
        <span class="brand-mark"><Footprints :size="25" /></span
        ><span>SoleKasir<small>Administrasi langganan</small></span>
      </div>
      <button
        class="button secondary"
        :disabled="action.busy.value"
        @click="logout"
      >
        <LogOut :size="17" />Keluar
      </button>
    </header>
    <section class="page-heading">
      <div>
        <span class="eyebrow">KHUSUS PENGELOLA SOLEKASIR</span>
        <h1>Persetujuan langganan</h1>
        <p>
          Tinjau usaha, buka akses, dan kelola masa langganan secara manual.
        </p>
      </div>
      <button
        class="button secondary"
        :disabled="task.busy.value"
        @click="load()"
      >
        <RefreshCw :size="18" />Perbarui daftar
      </button>
    </section>
    <div class="notice compact">
      <ShieldCheck :size="17" /> Persetujuan membuka ruang kerja terpisah untuk
      pemilik usaha. Konfirmasi langganan dilakukan di luar aplikasi; keputusan
      ini tidak mencatat pembayaran otomatis.
    </div>
    <p v-if="action.success.value" class="success-message" role="status">
      <Check :size="18" />{{ action.success.value }}
    </p>
    <p v-if="action.error.value" class="form-error" role="alert">
      {{ action.error.value }}
    </p>
    <div class="subscription-layout">
      <section class="panel applications-panel">
        <nav class="application-tabs" aria-label="Status permohonan">
          <button
            v-for="(label, value) in labels"
            :key="value"
            :class="{ active: status === value }"
            :aria-pressed="status === value"
            :disabled="task.busy.value || action.busy.value"
            @click="status = value"
          >
            {{ label }}
          </button>
        </nav>
        <div
          v-if="task.busy.value && !rows.length"
          class="state-block"
          role="status"
        >
          <strong>Memuat permohonan…</strong>
        </div>
        <div
          v-else-if="task.error.value"
          class="state-block error-state"
          role="alert"
        >
          <strong>Daftar belum dapat dimuat</strong
          ><span>{{ task.error.value }}</span
          ><button class="button secondary" @click="load()">Coba lagi</button>
        </div>
        <div v-else-if="!rows.length" class="state-block">
          <ShieldCheck :size="29" /><strong
            >Belum ada permohonan {{ labels[status].toLowerCase() }}</strong
          ><span>Permohonan usaha dengan status ini akan muncul di sini.</span>
        </div>
        <template v-else
          ><button
            v-for="request in rows"
            :key="request.uid"
            class="application-row"
            :class="{ selected: selected?.uid === request.uid }"
            :disabled="action.busy.value || details.busy.value"
            @click="select(request)"
          >
            <span
              ><strong>{{ request.businessName }}</strong
              ><small>{{ request.name }} · {{ request.email }}</small
              ><small>{{ dateTime(request.createdAt) }}</small></span
            ><ChevronRight :size="19" />
          </button>
          <div v-if="hasMore" class="pagination">
            <button
              class="button secondary"
              :disabled="task.busy.value"
              @click="load(true)"
            >
              {{ task.busy.value ? "Memuat…" : "Muat berikutnya" }}
            </button>
          </div></template
        >
      </section>
      <section class="panel form-panel application-review">
        <div v-if="!selected" class="review-placeholder">
          <ShieldCheck :size="34" />
          <h2>Pilih usaha untuk ditinjau</h2>
          <p>Periksa data pemilik dan kontak sebelum memberikan akses.</p>
        </div>
        <template v-else
          ><span
            class="badge"
            :class="{
              green: selected.status === 'approved',
              neutral: selected.status === 'rejected',
            }"
            >{{ labels[selected.status] }}</span
          >
          <h2>{{ selected.businessName }}</h2>
          <dl class="application-facts">
            <div>
              <dt>Pemilik</dt>
              <dd>{{ selected.name }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{{ selected.email }}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>{{ selected.phone }}</dd>
            </div>
            <div>
              <dt>Alamat</dt>
              <dd>{{ selected.address || "Belum diisi" }}</dd>
            </div>
            <div>
              <dt>Dikirim</dt>
              <dd>{{ dateTime(selected.createdAt) }}</dd>
            </div>
            <div v-if="selected.reviewedAt">
              <dt>Ditinjau</dt>
              <dd>{{ dateTime(selected.reviewedAt) }}</dd>
            </div>
          </dl>
          <p v-if="selected.reason" class="notice compact">
            Catatan: {{ selected.reason }}
          </p>
          <p v-if="details.busy.value" class="field-help" role="status">
            Memeriksa masa langganan…
          </p>
          <p v-if="details.error.value" class="form-error" role="alert">
            {{ details.error.value }}
          </p>
          <div v-if="subscription" class="subscription-period">
            <span class="eyebrow">MASA LANGGANAN</span
            ><strong>{{ dateTime(subscription.expiresAt) }}</strong
            ><span
              class="badge"
              :class="{
                green:
                  subscription.status === 'active' &&
                  subscription.expiresAt.toMillis() > Date.now(),
              }"
              >{{
                subscription.status === "suspended"
                  ? "Ditangguhkan"
                  : subscription.expiresAt.toMillis() <= Date.now()
                    ? "Kedaluwarsa"
                    : "Aktif"
              }}</span
            >
            <p v-if="subscription.reason" class="field-help">
              {{ subscription.reason }}
            </p>
          </div>
          <div v-if="!mode && !details.busy.value" class="inline-actions">
            <template v-if="selected.status === 'pending'"
              ><button
                class="button"
                :disabled="!session.online"
                @click="open('approve')"
              >
                <Check :size="17" />Setujui usaha</button
              ><button
                class="button secondary danger-text"
                :disabled="!session.online"
                @click="open('reject')"
              >
                Tolak permohonan
              </button></template
            ><template v-else-if="selected.status === 'approved'"
              ><button
                class="button"
                :disabled="!session.online || !!details.error.value"
                @click="open('extend')"
              >
                {{
                  subscription?.status === "suspended"
                    ? "Aktifkan kembali"
                    : "Perpanjang langganan"
                }}</button
              ><button
                v-if="subscription?.status !== 'suspended'"
                class="button secondary danger-text"
                :disabled="
                  !session.online || !!details.error.value || !subscription
                "
                @click="open('suspend')"
              >
                Tangguhkan akses
              </button></template
            >
            <p v-else class="field-help">
              Permohonan ini telah ditolak. Pemilik dapat menghubungi pengelola
              untuk membahas pendaftaran kembali.
            </p>
          </div>
          <form
            v-if="mode"
            class="inline-form"
            @submit.prevent="confirmation = true"
          >
            <h3>
              {{
                mode === "approve"
                  ? "Setujui langganan usaha"
                  : mode === "reject"
                    ? "Tolak permohonan"
                    : mode === "suspend"
                      ? "Tangguhkan akses toko"
                      : "Perbarui langganan"
              }}
            </h3>
            <label v-if="mode === 'approve' || mode === 'extend'"
              >Akses berlaku hingga<input
                v-model="expiry"
                type="date"
                :min="dateKey()"
                required
                :disabled="action.busy.value || confirmation"
              /><span class="field-help"
                >Berakhir pukul 23.59.59 Asia/Jakarta pada tanggal pilihan.
                Tanggal awal disarankan 30 hari dari hari ini atau masa aktif
                terakhir.</span
              ></label
            >
            <label v-if="mode !== 'approve'"
              >{{
                mode === "reject" || mode === "suspend"
                  ? "Alasan (wajib)"
                  : "Catatan (opsional)"
              }}<textarea
                v-model="reason"
                :required="mode === 'reject' || mode === 'suspend'"
                maxlength="500"
                :disabled="action.busy.value || confirmation"
              />
            </label>
            <div v-if="confirmation" class="confirmation">
              <strong
                >Konfirmasi keputusan untuk {{ selected.businessName }}?</strong
              >
              <p>
                {{
                  mode === "approve"
                    ? "Pemilik dapat mulai memakai kasir dengan ruang kerja toko sendiri hingga tanggal pilihan."
                    : mode === "reject"
                      ? "Pemilik tetap tidak dapat memakai kasir. Alasan akan terlihat di akun mereka."
                      : mode === "suspend"
                        ? "Pemilik dan tim tidak dapat mengakses data toko sampai Anda mengaktifkan langganan kembali."
                        : "Akses pemilik dan tim akan berlaku hingga tanggal pilihan."
                }}
              </p>
              <div class="form-actions">
                <button
                  type="button"
                  class="button secondary"
                  :disabled="action.busy.value"
                  @click="confirmation = false"
                >
                  Kembali</button
                ><button
                  type="button"
                  class="button"
                  :class="{ danger: mode === 'reject' || mode === 'suspend' }"
                  :disabled="action.busy.value || !session.online"
                  @click="commit"
                >
                  {{ action.busy.value ? "Menyimpan…" : "Ya, konfirmasi" }}
                </button>
              </div>
            </div>
            <div v-else class="form-actions">
              <button
                type="button"
                class="button secondary"
                @click="mode = undefined"
              >
                Batal</button
              ><button class="button" :disabled="!session.online">
                Tinjau keputusan
              </button>
            </div>
          </form></template
        >
      </section>
    </div>
  </component>
</template>

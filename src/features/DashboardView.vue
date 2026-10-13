<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  Plus,
  ArrowUpRight,
  RefreshCw,
  ClipboardList,
  Footprints,
  CircleCheck,
  Clock3,
  Wallet,
  ReceiptText,
  ArrowRight,
  ShieldCheck,
} from "lucide-vue-next";
import { getDashboard } from "../data/repository";
import type { Dashboard } from "../domain/types";
import { rupiah } from "../domain/business";
import { useSession } from "../stores/session";
import { useTask } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
import OrderCard from "../components/OrderCard.vue";
const session = useSession(),
  data = ref<Dashboard>(),
  { busy, error, run } = useTask();
async function load() {
  await run(async () => {
    data.value = await getDashboard();
  });
}
onMounted(load);
const metrics = [
  {
    key: "todayOrders",
    label: "Order masuk hari ini",
    icon: ClipboardList,
    caption: "Sepatu baru, langkah baru",
    format: false,
  },
  {
    key: "workingPairs",
    label: "Pasang dalam pengerjaan",
    icon: Footprints,
    caption: "Sedang dirawat oleh tim",
    format: false,
  },
  {
    key: "readyOrders",
    label: "Order siap diambil",
    icon: CircleCheck,
    caption: "Menunggu pemiliknya",
    format: false,
  },
  {
    key: "overdueOrders",
    label: "Order lewat estimasi",
    icon: Clock3,
    caption: "Perlu perhatian hari ini",
    format: false,
  },
  {
    key: "todayPayments",
    label: "Pembayaran hari ini",
    icon: Wallet,
    caption: "Penerimaan bruto; refund/koreksi di laporan",
    format: true,
  },
  {
    key: "activeBalance",
    label: "Sisa tagihan aktif",
    icon: ReceiptText,
    caption: "Tagihan yang belum terbayar",
    format: true,
  },
] as const;
</script>
<template>
  <section class="page-heading dashboard-heading">
    <div>
      <div class="greeting-meta">
        <span class="eyebrow">SELAMAT DATANG DI RUANG KERJA</span
        ><span class="badge green"><i class="status-dot" /> Toko aktif</span>
      </div>
      <h1>
        Halo, {{ session.member?.name.split(" ")[0] || "tim" }}
        <span class="greeting-dot">.</span>
      </h1>
      <p>Mari buat hari ini berjalan selangkah lebih rapi.</p>
    </div>
    <RouterLink to="/orders/new" class="button"
      ><Plus :size="19" />Buat order baru</RouterLink
    >
  </section>
  <AsyncState :loading="busy" :error="error" @retry="load">
    <div v-if="data" class="dashboard-grid">
      <article
        v-for="m in metrics"
        :key="m.key"
        class="metric-card"
        :class="{
          'metric-highlight': m.key === 'todayPayments',
          'metric-warning': m.key === 'overdueOrders' && data[m.key] > 0,
        }"
      >
        <div class="metric-label">
          <span>{{ m.label }}</span
          ><component :is="m.icon" :size="20" />
        </div>
        <strong class="metric-value">{{
          m.format ? rupiah(data[m.key]) : data[m.key]
        }}</strong
        ><small>{{ m.caption }}</small>
      </article>
    </div>
    <section v-if="data" class="attention-panel">
      <div class="attention-copy">
        <span class="attention-icon"><Clock3 :size="23" /></span>
        <div>
          <h2>Yang perlu perhatian</h2>
          <p>
            {{
              data.overdueOrders || data.readyOrders
                ? "Bantu pelanggan melangkah lagi. Selesaikan dan kabari mereka."
                : "Antrean Anda sudah rapi. Siap untuk order berikutnya."
            }}
          </p>
        </div>
      </div>
      <div class="attention-actions">
        <RouterLink to="/orders?overdue=1"
          ><strong>{{ data.overdueOrders }}</strong> lewat estimasi
          <ArrowUpRight :size="17" /></RouterLink
        ><RouterLink to="/orders?status=ready"
          ><strong>{{ data.readyOrders }}</strong> siap diambil
          <ArrowUpRight :size="17"
        /></RouterLink>
      </div>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Order terbaru</h2>
          <p>Aktivitas terakhir di toko Anda.</p>
        </div>
        <div class="inline-actions">
          <button
            class="icon-button"
            aria-label="Perbarui dashboard"
            @click="load"
          >
            <RefreshCw :size="18" /></button
          ><RouterLink to="/orders" class="text-link"
            >Lihat semua <ArrowRight :size="16"
          /></RouterLink>
        </div>
      </div>
      <div class="table-labels">
        <span>Pelanggan & order</span><span>Tanggal masuk</span
        ><span>Pengerjaan</span><span>Tagihan</span>
      </div>
      <AsyncState
        :empty="!data?.recent.length"
        empty-title="Langkah pertama dimulai di sini"
        empty-text="Buat order pertama Anda. Setelah disimpan, aktivitas toko akan tampil di beranda."
        ><template #action
          ><RouterLink to="/orders/new" class="button secondary"
            ><Plus :size="18" />Buat order pertama</RouterLink
          ></template
        ><OrderCard
          v-for="order in data?.recent"
          :key="order.id"
          :order="order"
      /></AsyncState>
    </section>
  </AsyncState>
  <div class="dashboard-note">
    <ShieldCheck :size="16" /><span
      >Ringkasan menggunakan waktu Asia/Jakarta. Pembayaran dicatat pada tanggal
      uang diterima.</span
    >
  </div>
</template>

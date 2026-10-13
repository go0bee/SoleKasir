<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { Download, Plus, ChartNoAxesCombined, Wallet } from "lucide-vue-next";
import { getReport, addExpense } from "../data/repository";
import type { Report } from "../domain/types";
import { dateKey, dateTime, rupiah, csv } from "../domain/business";
import { useSession } from "../stores/session";
import { useTask, downloadCsv } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
const session = useSession(),
  from = ref(dateKey().slice(0, 7) + "-01"),
  to = ref(dateKey()),
  report = ref<Report>(),
  loadedPeriod = ref({ from: "", to: "" }),
  expenseOpen = ref(false),
  confirmExpense = ref(false),
  expense = reactive({ description: "", amount: 0 }),
  expenseId = ref(crypto.randomUUID()),
  task = useTask(),
  expenseTask = useTask();
async function load() {
  await task.run(async () => {
    report.value = await getReport(from.value, to.value);
    loadedPeriod.value = { from: from.value, to: to.value };
  });
}
function openExpense() {
  expenseOpen.value = true;
  confirmExpense.value = false;
  expense.description = "";
  expense.amount = 0;
  expenseId.value = crypto.randomUUID();
  expenseTask.error.value = "";
  expenseTask.success.value = "";
}
async function saveExpense() {
  const result = await expenseTask.run(async () => {
    await addExpense(
      expense.description.trim(),
      expense.amount,
      expenseId.value,
    );
    return true;
  }, "Pengeluaran berhasil dicatat.");
  if (result) {
    expenseOpen.value = false;
    confirmExpense.value = false;
    await load();
  }
}
function exportCsv() {
  if (!report.value) return;
  const r = report.value;
  const rows: (string | number)[][] = [
    [
      "Laporan toko",
      loadedPeriod.value.from,
      loadedPeriod.value.to,
      "Asia/Jakarta",
    ],
    ["Metrik", "Nilai"],
    ["Jumlah order", r.count],
    ["Pasang sepatu", r.pairs],
    ["Nilai order setelah diskon (tanpa batal)", r.value],
    ["Nilai order batal", r.cancelledValue],
    ["Penerimaan pembayaran", r.receipts],
    ["Refund", r.refunds],
    ["Koreksi pembayaran", r.corrections],
    ["Penerimaan bersih", r.net],
    ["Sisa tagihan order periode", r.balance],
    ["Pengeluaran", r.expenseTotal],
    ["Surplus kas (bukan laba akuntansi)", r.cashSurplus],
    [],
    [
      "Order",
      "Tanggal masuk (WIB)",
      "Pelanggan",
      "Pasang",
      "Nilai",
      "Pembayaran bersih",
      "Sisa",
      "Batal",
    ],
  ];
  r.orders.forEach((o) =>
    rows.push([
      o.number,
      dateTime(o.createdAt),
      o.customerName,
      o.itemCount,
      o.total,
      o.paid,
      o.balance,
      o.cancelled ? "Ya" : "Tidak",
    ]),
  );
  rows.push(
    [],
    [
      "Pembayaran ID",
      "Order ID",
      "Tanggal (WIB)",
      "Jenis",
      "Metode",
      "Nominal",
      "Uang diserahkan",
      "Kembalian",
      "Petugas",
      "Alasan",
      "Referensi",
    ],
  );
  r.payments.forEach((p) =>
    rows.push([
      p.id,
      p.orderId,
      dateTime(p.createdAt),
      p.kind,
      p.method,
      p.amount,
      p.tendered,
      p.change,
      p.createdBy,
      p.reason,
      p.refId,
    ]),
  );
  rows.push(
    [],
    ["Pengeluaran ID", "Tanggal (WIB)", "Deskripsi", "Nominal", "Petugas"],
  );
  r.expenses.forEach((e) =>
    rows.push([
      e.id,
      dateTime(e.createdAt),
      e.description,
      e.amount,
      e.createdBy,
    ]),
  );
  rows.push([], ["Layanan", "Jumlah pasang"]);
  r.popular.forEach((p) => rows.push([p.name, p.count]));
  downloadCsv(
    csv(rows),
    "laporan-" + loadedPeriod.value.from + "-" + loadedPeriod.value.to + ".csv",
  );
}
onMounted(load);
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">ANGKA JELAS, LANGKAH TERARAH</span>
      <h1>Laporan toko</h1>
      <p>Nilai order, arus uang, dan biaya dalam satu pandangan.</p>
    </div>
    <div class="inline-actions">
      <button
        class="button secondary"
        :disabled="!report || task.busy.value"
        @click="exportCsv"
      >
        <Download :size="18" />Ekspor CSV</button
      ><button class="button" :disabled="!session.online" @click="openExpense">
        <Plus :size="18" />Pengeluaran
      </button>
    </div>
  </section>
  <section class="panel filters-panel">
    <form class="report-period" @submit.prevent="load">
      <label>Dari tanggal<input v-model="from" type="date" required /></label
      ><label>Sampai tanggal<input v-model="to" type="date" required /></label
      ><button class="button secondary" :disabled="task.busy.value">
        Tampilkan laporan</button
      ><span class="field-help">Tanggal toko · Asia/Jakarta</span>
    </form>
  </section>
  <p v-if="expenseTask.success.value" class="success-message">
    {{ expenseTask.success.value }}
  </p>
  <section v-if="expenseOpen" class="panel form-panel">
    <div class="panel-heading">
      <h2>Catat pengeluaran</h2>
      <button
        class="button quiet"
        :disabled="expenseTask.busy.value"
        @click="expenseOpen = false"
      >
        Tutup
      </button>
    </div>
    <form @submit.prevent="confirmExpense = true">
      <div class="form-grid">
        <label
          >Deskripsi pengeluaran<input
            v-model="expense.description"
            maxlength="300"
            required
            placeholder="Contoh: pembelian cairan pembersih" /></label
        ><label
          >Nominal (Rp)<input
            v-model.number="expense.amount"
            type="number"
            min="1"
            max="100000000"
            step="1"
            required
            inputmode="numeric"
        /></label>
      </div>
      <p class="field-help">
        Dicatat pada tanggal sekarang. Transaksi pengeluaran tidak dapat diedit
        langsung.
      </p>
      <p v-if="expenseTask.error.value" class="form-error">
        {{ expenseTask.error.value }}
      </p>
      <div v-if="confirmExpense" class="confirmation">
        <strong
          >Catat {{ expense.description }} ·
          {{ rupiah(expense.amount) }}?</strong
        >
        <div class="form-actions">
          <button
            type="button"
            class="button secondary"
            :disabled="expenseTask.busy.value"
            @click="confirmExpense = false"
          >
            Periksa lagi</button
          ><button
            type="button"
            class="button"
            :disabled="expenseTask.busy.value || !session.online"
            @click="saveExpense"
          >
            {{
              expenseTask.busy.value ? "Menyimpan…" : "Ya, catat pengeluaran"
            }}
          </button>
        </div>
      </div>
      <div v-else class="form-actions">
        <button class="button" :disabled="!session.online">
          Periksa pengeluaran
        </button>
      </div>
    </form>
  </section>
  <AsyncState :loading="task.busy.value" :error="task.error.value" @retry="load"
    ><template v-if="report"
      ><p class="report-caption">
        Periode {{ loadedPeriod.from }} sampai {{ loadedPeriod.to }} · Tanggal
        masuk untuk order; tanggal transaksi untuk pembayaran dan pengeluaran.
      </p>
      <div class="report-stats">
        <article class="metric-card">
          <span class="metric-label"
            >Jumlah order<ChartNoAxesCombined :size="20" /></span
          ><strong class="metric-value">{{ report.count }}</strong
          ><small
            >{{ report.pairs }} pasang sepatu · termasuk order batal</small
          >
        </article>
        <article class="metric-card">
          <span class="metric-label">Nilai order setelah diskon</span
          ><strong class="metric-value">{{ rupiah(report.value) }}</strong
          ><small
            >Order batal dipisahkan: {{ rupiah(report.cancelledValue) }}</small
          >
        </article>
        <article class="metric-card">
          <span class="metric-label">Sisa tagihan periode</span
          ><strong class="metric-value">{{ rupiah(report.balance) }}</strong
          ><small>Tagihan order pada periode ini</small>
        </article>
      </div>
      <div class="report-columns">
        <section class="panel form-panel">
          <div class="panel-heading compact-heading">
            <div>
              <h2>Arus uang</h2>
              <p>DP dan pelunasan mengikuti tanggal pembayaran.</p>
            </div>
            <Wallet :size="22" />
          </div>
          <div class="finance-lines">
            <div>
              <span>Penerimaan pembayaran</span
              ><strong>{{ rupiah(report.receipts) }}</strong>
            </div>
            <div>
              <span>Refund</span
              ><strong class="text-orange"
                >− {{ rupiah(report.refunds) }}</strong
              >
            </div>
            <div>
              <span>Koreksi pembayaran</span
              ><strong class="text-orange"
                >− {{ rupiah(report.corrections) }}</strong
              >
            </div>
            <div class="finance-subtotal">
              <strong>Penerimaan bersih</strong
              ><strong>{{ rupiah(report.net) }}</strong>
            </div>
            <div>
              <span>Pengeluaran operasional</span
              ><strong>− {{ rupiah(report.expenseTotal) }}</strong>
            </div>
            <div class="finance-total">
              <span>Surplus kas</span
              ><strong>{{ rupiah(report.cashSurplus) }}</strong>
            </div>
          </div>
          <p class="notice compact">
            Surplus kas adalah penerimaan bersih dikurangi pengeluaran periode.
            Ini bukan laba akuntansi dan tidak mencakup seluruh biaya usaha.
          </p>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>Layanan terlaris</h2>
              <p>Berdasarkan item order pada periode.</p>
            </div>
          </div>
          <AsyncState
            :empty="!report.popular.length"
            empty-title="Belum ada layanan pada periode ini"
            ><ol class="popular-list">
              <li
                v-for="(service, index) in report.popular"
                :key="service.name"
              >
                <span class="popular-number">{{ index + 1 }}</span
                ><strong>{{ service.name }}</strong
                ><span>{{ service.count }} pasang</span>
              </li>
            </ol></AsyncState
          >
        </section>
      </div>
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Pengeluaran operasional</h2>
            <p>Biaya yang dicatat selama periode terpilih.</p>
          </div>
          <strong>{{ rupiah(report.expenseTotal) }}</strong>
        </div>
        <AsyncState
          :empty="!report.expenses.length"
          empty-title="Belum ada pengeluaran"
          empty-text="Pengeluaran yang dicatat dalam periode ini akan tampil di sini."
          ><article
            v-for="e in report.expenses"
            :key="e.id"
            class="expense-row"
          >
            <div>
              <strong>{{ e.description }}</strong
              ><small>{{ dateTime(e.createdAt) }} · {{ e.createdBy }}</small>
            </div>
            <strong>{{ rupiah(e.amount) }}</strong>
          </article></AsyncState
        >
      </section></template
    ></AsyncState
  >
</template>

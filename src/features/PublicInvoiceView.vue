<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Download, Printer, Share2, Footprints } from "lucide-vue-next";
import type { SharedInvoice } from "../domain/invoices";
import { getSharedInvoice } from "../data/invoices";
import {
  downloadInvoicePNG,
  downloadInvoicePDF,
  shareInvoiceFile,
} from "../lib/invoice-export";
import { useTask } from "../components/state";
import { dateTime } from "../domain/business";
import InvoicePaper from "../components/InvoicePaper.vue";
const route = useRoute(),
  invoice = ref<SharedInvoice>(),
  task = useTask(),
  exporting = useTask();
async function load() {
  invoice.value = undefined;
  await task.run(async () => {
    invoice.value = await getSharedInvoice(String(route.params.token));
  });
}
async function exportFile(format: "png" | "pdf", share = false) {
  if (!invoice.value) return;
  await exporting.run(() =>
    share
      ? shareInvoiceFile(invoice.value!.snapshot, format)
      : format === "png"
        ? downloadInvoicePNG(invoice.value!.snapshot)
        : downloadInvoicePDF(invoice.value!.snapshot),
  );
}
function print() {
  window.print();
}
watch(() => route.params.token, load, { immediate: true });
</script>
<template>
  <main class="public-invoice-page">
    <header class="public-invoice-brand no-print">
      <span class="brand-mark"><Footprints :size="23" /></span
      ><span>Invoice pelanggan<small>Dibagikan melalui SoleKasir</small></span>
    </header>
    <section v-if="task.busy.value" class="panel state-block" role="status">
      <strong>Memuat invoice…</strong
      ><span>Sebentar, kami mengambil invoice yang dibagikan toko.</span>
    </section>
    <section
      v-else-if="task.error.value || !invoice"
      class="panel state-block error-state"
      role="alert"
    >
      <strong>Invoice tidak tersedia</strong
      ><span>{{
        task.error.value ||
        "Tautan tidak ditemukan, telah dicabut, atau sudah kedaluwarsa."
      }}</span
      ><button class="button secondary" @click="load">Coba lagi</button>
      <p class="field-help">
        Minta toko membagikan atau memperbarui tautan invoice.
      </p>
    </section>
    <template v-else>
      <div class="invoice-toolbar no-print">
        <div>
          <span class="eyebrow">SIMPAN ATAU BAGIKAN</span>
          <p>Invoice siap disimpan untuk chat Anda.</p>
        </div>
        <div class="inline-actions">
          <button
            class="button secondary"
            :disabled="exporting.busy.value"
            @click="exportFile('png')"
          >
            <Download :size="17" />Unduh PNG</button
          ><button
            class="button secondary"
            :disabled="exporting.busy.value"
            @click="exportFile('pdf')"
          >
            <Download :size="17" />Unduh PDF</button
          ><button
            class="button secondary"
            :disabled="exporting.busy.value"
            @click="print"
          >
            <Printer :size="17" />Cetak</button
          ><button
            class="button"
            :disabled="exporting.busy.value"
            @click="exportFile('png', true)"
          >
            <Share2 :size="17" />Bagikan PNG
          </button>
        </div>
      </div>
      <p v-if="exporting.busy.value" class="field-help no-print" role="status">
        Menyiapkan file invoice…
      </p>
      <p v-if="exporting.error.value" class="form-error no-print" role="alert">
        {{ exporting.error.value }}
      </p>
      <InvoicePaper :snapshot="invoice.snapshot" />
      <div class="invoice-snapshot-note no-print">
        <p>
          Invoice ini mencatat kondisi tagihan saat tautan terakhir diperbarui.
        </p>
        <small
          >Diperbarui {{ dateTime(invoice.updatedAt) }} · Tautan berlaku hingga
          {{ dateTime(invoice.expiresAt) }} (Asia/Jakarta). Hubungi toko untuk
          tagihan terbaru.</small
        >
      </div>
    </template>
  </main>
</template>

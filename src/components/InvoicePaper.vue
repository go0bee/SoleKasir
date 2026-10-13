<script setup lang="ts">
import type { InvoiceSnapshot } from "../domain/invoices";
import { dateTime, rupiah } from "../domain/business";
defineProps<{ snapshot: InvoiceSnapshot }>();
</script>
<template>
  <article class="invoice-paper" aria-label="Invoice pelanggan">
    <header class="invoice-header">
      <div>
        <span class="eyebrow">INVOICE</span>
        <h1>{{ snapshot.store.name }}</h1>
        <p>
          {{ snapshot.store.address }}<br v-if="snapshot.store.address" />{{
            snapshot.store.phone ? "+" + snapshot.store.phone : ""
          }}<span v-if="snapshot.store.phone && snapshot.store.hours"> · </span
          >{{ snapshot.store.hours }}
        </p>
      </div>
      <div class="invoice-number">
        <strong>{{ snapshot.number }}</strong
        ><span>{{ dateTime(snapshot.date) }}</span>
      </div>
    </header>
    <div class="invoice-recipient">
      <div>
        <span class="eyebrow">DITAGIHKAN KEPADA</span
        ><strong>{{ snapshot.customerName }}</strong>
      </div>
      <span
        class="badge"
        :class="{
          green: snapshot.balance === 0 && !snapshot.cancelled,
          neutral: snapshot.cancelled,
        }"
        >{{
          snapshot.cancelled
            ? "Order dibatalkan"
            : snapshot.balance === 0
              ? "Lunas"
              : "Belum lunas"
        }}</span
      >
    </div>
    <section class="invoice-items" aria-label="Rincian layanan">
      <div class="invoice-table-labels">
        <span>SEPATU & LAYANAN</span><span>JUMLAH</span>
      </div>
      <div v-for="(item, i) in snapshot.items" :key="i" class="invoice-line">
        <div>
          <strong
            >{{ String(i + 1).padStart(2, "0") }}. {{ item.description
            }}<span v-if="item.color"> · {{ item.color }}</span></strong
          >
          <p>{{ item.serviceName }}</p>
          <small>Estimasi {{ dateTime(item.dueAt) }}</small>
        </div>
        <strong>{{ rupiah(item.price) }}</strong>
      </div>
    </section>
    <div class="invoice-totals">
      <div>
        <span>Subtotal</span><strong>{{ rupiah(snapshot.subtotal) }}</strong>
      </div>
      <div>
        <span>Diskon</span><strong>{{ rupiah(snapshot.discount) }}</strong>
      </div>
      <div class="invoice-total">
        <span>Total invoice</span><strong>{{ rupiah(snapshot.total) }}</strong>
      </div>
      <div>
        <span>Pembayaran bersih</span
        ><strong>{{ rupiah(snapshot.paid) }}</strong>
      </div>
      <div class="invoice-balance">
        <strong>Sisa tagihan</strong
        ><strong>{{ rupiah(snapshot.balance) }}</strong>
      </div>
    </div>
    <p v-if="snapshot.cancelled" class="notice compact">
      Order dibatalkan. Angka pembayaran dan sisa tagihan mencatat kondisi saat
      invoice diperbarui.
    </p>
    <p v-else-if="snapshot.collected" class="invoice-collected">
      Sepatu telah diambil.
    </p>
    <footer class="invoice-footer">
      <p>{{ snapshot.store.terms }}</p>
      <strong>Terima kasih telah mempercayakan langkah Anda.</strong>
    </footer>
  </article>
</template>

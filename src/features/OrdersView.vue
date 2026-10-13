<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRoute } from "vue-router";
import { Plus, Filter, RefreshCw } from "lucide-vue-next";
import { listOrders } from "../data/repository";
import type { Order, OrderFilters } from "../domain/types";
import { useTask } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
import OrderCard from "../components/OrderCard.vue";
const route = useRoute(),
  rows = ref<Order[]>([]),
  cursor = ref<unknown>(),
  hasMore = ref(false),
  { busy, error, run } = useTask();
const filters = reactive<OrderFilters>({
  status: route.query.status === "ready" ? "ready" : undefined,
  overdue: route.query.overdue === "1" ? true : undefined,
});
async function load(more = false) {
  await run(async () => {
    const p = await listOrders(
      { ...filters },
      more && hasMore.value ? cursor.value : undefined,
    );
    rows.value = more ? [...rows.value, ...p.rows] : p.rows;
    cursor.value = p.cursor;
    hasMore.value = p.hasMore;
  });
}
onMounted(() => load());
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">SEMUA LANGKAH TERCATAT</span>
      <h1>Order</h1>
      <p>Pantau pengerjaan, pembayaran, dan pengambilan.</p>
    </div>
    <RouterLink to="/orders/new" class="button"
      ><Plus :size="19" />Buat order</RouterLink
    >
  </section>
  <section class="panel filters-panel">
    <div class="filter-title">
      <Filter :size="18" /><strong>Temukan order</strong>
    </div>
    <form class="filters" @submit.prevent="load()">
      <label
        >Status<select v-model="filters.status">
          <option :value="undefined">Semua status</option>
          <option value="active">Dalam pengerjaan</option>
          <option value="ready">Siap diambil</option>
          <option value="collected">Sudah diambil</option>
          <option value="cancelled">Dibatalkan</option>
        </select></label
      ><label>Dari tanggal<input type="date" v-model="filters.from" /></label
      ><label>Sampai tanggal<input type="date" v-model="filters.to" /></label>
      <div class="filter-checks">
        <label class="check-label"
          ><input type="checkbox" v-model="filters.unpaid" />Belum lunas</label
        ><label class="check-label"
          ><input type="checkbox" v-model="filters.overdue" />Lewat
          estimasi</label
        >
      </div>
      <button class="button secondary" :disabled="busy" type="submit">
        Terapkan
      </button>
    </form>
  </section>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <h2>Daftar order</h2>
        <p>{{ rows.length }} order ditampilkan</p>
      </div>
      <button
        class="icon-button"
        aria-label="Perbarui daftar order"
        :disabled="busy"
        @click="load()"
      >
        <RefreshCw :size="18" />
      </button>
    </div>
    <AsyncState
      :loading="busy && !rows.length"
      :error="error"
      :empty="!rows.length"
      empty-title="Belum ada order yang cocok"
      empty-text="Ubah filter untuk melihat order lain, atau buat order baru."
      @retry="load()"
      ><div class="table-labels">
        <span>Pelanggan & order</span><span>Tanggal masuk</span
        ><span>Pengerjaan</span><span>Tagihan</span>
      </div>
      <OrderCard v-for="order in rows" :key="order.id" :order="order"
    /></AsyncState>
    <div v-if="hasMore" class="pagination">
      <button class="button secondary" :disabled="busy" @click="load(true)">
        {{ busy ? "Memuat…" : "Muat order berikutnya" }}
      </button>
    </div>
  </section>
</template>

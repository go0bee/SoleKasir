<script setup lang="ts">
import { ref, reactive, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Plus,
  Search,
  ArrowLeft,
  Phone,
  Pencil,
  ChevronRight,
} from "lucide-vue-next";
import {
  listCustomers,
  saveCustomer,
  getCustomer,
  listOrders,
} from "../data/repository";
import type { Customer, Order } from "../domain/types";
import { dateTime, normalizePhone } from "../domain/business";
import { useSession } from "../stores/session";
import { useTask, errorText } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
import OrderCard from "../components/OrderCard.vue";
const route = useRoute(),
  router = useRouter(),
  session = useSession(),
  rows = ref<Customer[]>([]),
  orders = ref<Order[]>([]),
  detail = ref<Customer>(),
  search = ref(""),
  cursor = ref<unknown>(),
  hasMore = ref(false),
  orderCursor = ref<unknown>(),
  orderMore = ref(false),
  editing = ref(false),
  form = reactive({ name: "", phone: "", notes: "" }),
  editId = ref<string>(),
  saving = ref(false),
  formError = ref("");
const { busy, error, run } = useTask();
async function load(more = false) {
  await run(async () => {
    if (route.params.id) {
      detail.value = await getCustomer(String(route.params.id));
      await loadOrders(false);
    } else {
      const page = await listCustomers(
        search.value,
        more && hasMore.value ? cursor.value : undefined,
      );
      rows.value = more ? [...rows.value, ...page.rows] : page.rows;
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
    }
  });
}
async function loadOrders(more = false) {
  const page = await listOrders(
    { customerId: String(route.params.id) },
    more && orderMore.value ? orderCursor.value : undefined,
  );
  orders.value = more ? [...orders.value, ...page.rows] : page.rows;
  orderCursor.value = page.cursor;
  orderMore.value = page.hasMore;
}
function openForm(customer?: Customer) {
  editId.value = customer?.id;
  Object.assign(form, {
    name: customer?.name || "",
    phone: customer?.phone || "",
    notes: customer?.notes || "",
  });
  formError.value = "";
  editing.value = true;
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  formError.value = "";
  try {
    const id = await saveCustomer(
      {
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        notes: form.notes.trim(),
      },
      editId.value,
    );
    editing.value = false;
    await router.push("/customers/" + id);
    await load();
  } catch (e) {
    formError.value = errorText(e);
  } finally {
    saving.value = false;
  }
}
watch(
  () => route.params.id,
  () => {
    detail.value = undefined;
    void load();
  },
);
onMounted(() => load());
</script>
<template>
  <RouterLink v-if="route.params.id" to="/customers" class="back-link"
    ><ArrowLeft :size="17" />Semua pelanggan</RouterLink
  >
  <section class="page-heading">
    <div>
      <span class="eyebrow">KENALI PEMILIK SETIAP PASANG</span>
      <h1>{{ detail ? detail.name : "Pelanggan" }}</h1>
      <p>
        {{
          detail
            ? "Informasi dan riwayat order pelanggan."
            : "Data pelanggan rapi, pelayanan lebih personal."
        }}
      </p>
    </div>
    <button
      class="button"
      :disabled="!session.online"
      @click="openForm(detail)"
    >
      <component :is="detail ? Pencil : Plus" :size="18" />{{
        detail ? "Edit pelanggan" : "Tambah pelanggan"
      }}
    </button>
  </section>
  <section v-if="editing" class="panel form-panel">
    <div class="panel-heading">
      <h2>{{ editId ? "Edit pelanggan" : "Pelanggan baru" }}</h2>
      <button class="button quiet" :disabled="saving" @click="editing = false">
        Tutup
      </button>
    </div>
    <form @submit.prevent="save">
      <div class="form-grid">
        <label
          >Nama pelanggan<input
            v-model="form.name"
            required
            maxlength="100"
            placeholder="Nama lengkap" /></label
        ><label
          >Nomor WhatsApp<input
            v-model="form.phone"
            required
            inputmode="tel"
            placeholder="081234567890" /></label
        ><label class="span-2"
          >Catatan<textarea
            v-model="form.notes"
            maxlength="1000"
            placeholder="Preferensi atau informasi yang perlu diketahui tim"
          />
        </label>
      </div>
      <p class="field-help">
        Nomor Indonesia dinormalisasi menjadi 62. Nomor yang sudah terdaftar
        akan ditolak.
      </p>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="form-actions">
        <button
          type="button"
          class="button secondary"
          :disabled="saving"
          @click="editing = false"
        >
          Batal</button
        ><button class="button" :disabled="saving || !session.online">
          {{ saving ? "Menyimpan…" : "Simpan pelanggan" }}
        </button>
      </div>
    </form>
  </section>
  <AsyncState :loading="busy" :error="error" @retry="load()"
    ><template v-if="detail"
      ><section class="customer-profile panel">
        <span class="avatar large">{{
          detail.name.slice(0, 1).toUpperCase()
        }}</span>
        <div>
          <h2>{{ detail.name }}</h2>
          <a
            :href="'https://wa.me/' + detail.phone"
            target="_blank"
            rel="noopener"
            class="text-link"
            ><Phone :size="16" />+{{ detail.phone }}</a
          >
          <p class="muted">Pelanggan sejak {{ dateTime(detail.createdAt) }}</p>
          <p v-if="detail.notes">{{ detail.notes }}</p>
        </div>
        <RouterLink
          :to="'/orders/new?customer=' + detail.id"
          class="button secondary"
          ><Plus :size="18" />Buat order</RouterLink
        >
      </section>
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Riwayat order</h2>
            <p>Semua order milik {{ detail.name }}.</p>
          </div>
        </div>
        <AsyncState
          :empty="!orders.length"
          empty-title="Belum ada riwayat order"
          ><OrderCard v-for="order in orders" :key="order.id" :order="order"
        /></AsyncState>
        <div v-if="orderMore" class="pagination">
          <button
            class="button secondary"
            :disabled="busy"
            @click="run(() => loadOrders(true))"
          >
            Muat riwayat berikutnya
          </button>
        </div>
      </section></template
    >
    <section v-else class="panel">
      <form class="search-bar" @submit.prevent="load()">
        <Search :size="20" /><input
          v-model="search"
          aria-label="Cari nama atau nomor pelanggan"
          placeholder="Cari awal nama atau nomor WhatsApp…"
        /><button class="button secondary" :disabled="busy">Cari</button>
      </form>
      <p class="search-hint">
        Pencarian menggunakan awal nama atau nomor, bukan kata di tengah.
      </p>
      <AsyncState
        :empty="!rows.length"
        empty-title="Belum ada pelanggan yang cocok"
        empty-text="Coba awal nama atau nomor yang lain, atau tambahkan pelanggan baru."
        ><RouterLink
          v-for="customer in rows"
          :key="customer.id"
          :to="'/customers/' + customer.id"
          class="customer-row"
          ><span class="avatar">{{
            customer.name.slice(0, 1).toUpperCase()
          }}</span
          ><span
            ><strong>{{ customer.name }}</strong
            ><small>+{{ customer.phone }}</small></span
          ><ChevronRight :size="18" /></RouterLink
      ></AsyncState>
      <div v-if="hasMore" class="pagination">
        <button class="button secondary" :disabled="busy" @click="load(true)">
          Muat pelanggan berikutnya
        </button>
      </div>
    </section></AsyncState
  >
</template>

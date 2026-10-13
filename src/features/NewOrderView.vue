<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Timestamp } from "firebase/firestore";
import {
  Search,
  Plus,
  Trash2,
  Check,
  ArrowRight,
  UserRound,
  Footprints,
  Wallet,
  RefreshCw,
} from "lucide-vue-next";
import {
  listServices,
  listCustomers,
  saveCustomer,
  getCustomer,
  createOrder,
} from "../data/repository";
import type { Customer, Service, ShoeItem, Method } from "../domain/types";
import {
  dateKey,
  rupiah,
  totals,
  cash,
  normalizePhone,
  MAX_ITEMS,
} from "../domain/business";
import { useSession } from "../stores/session";
import { useTask, errorText } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
const route = useRoute(),
  router = useRouter(),
  session = useSession(),
  services = ref<Service[]>([]),
  customer = ref<Customer>(),
  search = ref(""),
  matches = ref<Customer[]>([]),
  searching = ref(false),
  customerError = ref(""),
  customerForm = ref(false),
  customerDraft = reactive({ name: "", phone: "", notes: "" }),
  creatingCustomer = ref(false),
  items = ref<(ShoeItem & { dueDate: string })[]>([]),
  discount = ref(0),
  notes = ref(""),
  initialPayment = ref(0),
  method = ref<Method>("tunai"),
  tendered = ref(0),
  submitError = ref(""),
  saving = ref(false),
  confirm = ref(false);
const operationId = crypto.randomUUID(),
  { busy, error, run } = useTask();
const searchDone = ref(false),
  priceRefreshing = ref(false),
  priceNote = ref("");
async function load() {
  await run(async () => {
    services.value = (await listServices()).filter((s) => s.active);
    if (route.query.customer)
      customer.value = await getCustomer(String(route.query.customer));
    if (!items.value.length) addItem();
  });
}
function addItem() {
  if (items.value.length >= MAX_ITEMS) return;
  items.value.push({
    id: crypto.randomUUID(),
    description: "",
    color: "",
    material: "",
    size: "",
    condition: "",
    accessories: "Tali dan insole",
    serviceId: "",
    serviceName: "",
    price: 0,
    notes: "",
    dueAt: Timestamp.now(),
    dueDate: dateKey(),
    status: 0,
    rack: "",
  });
}
function setService(item: ShoeItem & { dueDate: string }) {
  const service = services.value.find((s) => s.id === item.serviceId);
  if (!service) return;
  item.serviceName = service.name;
  item.price = service.price;
  item.dueDate = dateKey(Date.now() + service.days * 86400000);
}
const calculation = computed(() => {
  try {
    return totals(items.value, discount.value, initialPayment.value);
  } catch {
    return {
      subtotal: items.value.reduce((sum, item) => sum + item.price, 0),
      discount: discount.value,
      total: Math.max(
        0,
        items.value.reduce((sum, item) => sum + item.price, 0) -
          (Number(discount.value) || 0),
      ),
      paid: Number(initialPayment.value) || 0,
      balance: Math.max(
        0,
        items.value.reduce((sum, item) => sum + item.price, 0) -
          (Number(discount.value) || 0) -
          (Number(initialPayment.value) || 0),
      ),
    };
  }
});
const change = computed(() =>
  method.value === "tunai"
    ? Math.max(
        0,
        (Number(tendered.value) || 0) - (Number(initialPayment.value) || 0),
      )
    : 0,
);
async function findCustomer() {
  searching.value = true;
  searchDone.value = false;
  customerError.value = "";
  try {
    matches.value = (await listCustomers(search.value)).rows;
    searchDone.value = true;
  } catch (e) {
    customerError.value = errorText(e);
  } finally {
    searching.value = false;
  }
}
async function refreshPrices() {
  priceRefreshing.value = true;
  priceNote.value = "";
  try {
    services.value = (await listServices()).filter((s) => s.active);
    for (const item of items.value) {
      const s = services.value.find((s) => s.id === item.serviceId);
      if (s) {
        item.serviceName = s.name;
        item.price = s.price;
      } else {
        item.serviceId = "";
        item.serviceName = "";
        item.price = 0;
      }
    }
    priceNote.value =
      "Daftar layanan dan harga pada form ini sudah diperbarui. Periksa total sebelum menyimpan.";
    confirm.value = false;
  } catch (e) {
    submitError.value = errorText(e);
  } finally {
    priceRefreshing.value = false;
  }
}
async function createCustomer() {
  if (creatingCustomer.value) return;
  creatingCustomer.value = true;
  customerError.value = "";
  try {
    const id = await saveCustomer({
      name: customerDraft.name.trim(),
      phone: normalizePhone(customerDraft.phone),
      notes: customerDraft.notes.trim(),
    });
    customer.value = await getCustomer(id);
    customerForm.value = false;
    matches.value = [];
  } catch (e) {
    customerError.value = errorText(e);
  } finally {
    creatingCustomer.value = false;
  }
}
function input() {
  if (!customer.value) throw new Error("Pilih pelanggan terlebih dahulu.");
  totals(items.value, discount.value, initialPayment.value);
  if (initialPayment.value > 0)
    cash(initialPayment.value, method.value, tendered.value);
  const shoeItems = items.value.map(({ dueDate, ...item }) => {
    if (
      !item.description.trim() ||
      !item.color.trim() ||
      !item.condition.trim() ||
      !item.serviceId
    )
      throw new Error(
        "Lengkapi deskripsi, warna, kondisi awal, dan layanan setiap sepatu.",
      );
    const millis = Date.parse(dueDate + "T18:00:00+07:00");
    if (!Number.isFinite(millis))
      throw new Error("Estimasi selesai belum valid.");
    return { ...item, dueAt: Timestamp.fromMillis(millis) };
  });
  return {
    customer: customer.value,
    items: shoeItems,
    discount: discount.value,
    notes: notes.value,
    initialPayment: initialPayment.value,
    method: method.value,
    tendered:
      initialPayment.value > 0
        ? method.value === "tunai"
          ? tendered.value
          : initialPayment.value
        : 0,
  };
}
function review() {
  submitError.value = "";
  try {
    input();
    confirm.value = true;
  } catch (e) {
    submitError.value = errorText(e);
  }
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  submitError.value = "";
  try {
    const id = await createOrder(input(), operationId);
    await router.push("/orders/" + id);
  } catch (e) {
    submitError.value = errorText(e);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">SEPATU BARU, CERITA BARU</span>
      <h1>Buat order</h1>
      <p>Catat detail dari awal. Sisanya lebih mudah diikuti.</p>
    </div>
    <span class="badge neutral">Maksimal {{ MAX_ITEMS }} pasang / order</span>
  </section>
  <AsyncState :loading="busy" :error="error" @retry="load"
    ><div v-if="!services.length" class="notice">
      Belum ada layanan aktif. Pemilik toko perlu menambahkan layanan sebelum
      order dapat dibuat.<RouterLink
        v-if="session.owner"
        to="/services"
        class="text-link"
        >Kelola layanan <ArrowRight :size="16"
      /></RouterLink>
    </div>
    <div class="new-order-layout">
      <div class="new-order-fields">
        <section class="panel form-panel">
          <div class="step-heading">
            <span class="step-number">01</span>
            <div>
              <h2>Pelanggan</h2>
              <p>Siapa pemilik sepatu ini?</p>
            </div>
          </div>
          <div v-if="customer" class="selected-customer">
            <span class="avatar"><UserRound :size="22" /></span
            ><span
              ><strong>{{ customer.name }}</strong
              ><small>+{{ customer.phone }}</small></span
            ><button
              class="button quiet"
              @click="
                customer = undefined;
                matches = [];
              "
            >
              Ganti</button
            ><Check :size="19" class="text-green" />
          </div>
          <template v-else
            ><form
              class="search-bar inset-search"
              @submit.prevent="findCustomer"
            >
              <Search :size="19" /><input
                v-model="search"
                aria-label="Cari pelanggan"
                placeholder="Awal nama atau nomor WhatsApp"
              /><button class="button secondary" :disabled="searching">
                {{ searching ? "Mencari…" : "Cari" }}
              </button>
            </form>
            <p class="field-help">
              Pencarian berdasarkan awal nama atau nomor.
            </p>
            <p v-if="searchDone && !matches.length" class="field-help">
              Tidak ada pelanggan yang cocok. Coba awal nama/nomor yang lain,
              atau tambahkan pelanggan baru.
            </p>
            <p v-if="matches.length >= 25" class="field-help">
              25 hasil pertama. Perjelas pencarian untuk menemukan pelanggan
              Anda.
            </p>
            <div class="customer-matches">
              <button
                v-for="match in matches"
                :key="match.id"
                class="customer-match"
                @click="
                  customer = match;
                  matches = [];
                "
              >
                <span
                  ><strong>{{ match.name }}</strong
                  ><small>+{{ match.phone }}</small></span
                ><Plus :size="18" />
              </button>
            </div>
            <button
              v-if="!customerForm"
              class="text-link button-link"
              @click="customerForm = true"
            >
              <Plus :size="17" />Tambah pelanggan baru
            </button>
            <form
              v-if="customerForm"
              class="inline-form"
              @submit.prevent="createCustomer"
            >
              <div class="form-grid">
                <label
                  >Nama<input
                    v-model="customerDraft.name"
                    required
                    maxlength="100" /></label
                ><label
                  >WhatsApp<input
                    v-model="customerDraft.phone"
                    required
                    inputmode="tel"
                    placeholder="081234567890" /></label
                ><label class="span-2"
                  >Catatan pelanggan<textarea
                    v-model="customerDraft.notes"
                    maxlength="1000"
                  />
                </label>
              </div>
              <div class="form-actions">
                <button
                  type="button"
                  class="button quiet"
                  @click="customerForm = false"
                >
                  Batal</button
                ><button
                  class="button secondary"
                  :disabled="creatingCustomer || !session.online"
                >
                  {{
                    creatingCustomer ? "Menyimpan…" : "Simpan & pilih pelanggan"
                  }}
                </button>
              </div>
            </form></template
          >
          <p v-if="customerError" class="form-error" role="alert">
            {{ customerError }}
          </p>
        </section>
        <section class="panel form-panel">
          <div class="step-heading">
            <span class="step-number">02</span>
            <div>
              <h2>Sepatu & layanan</h2>
              <p>Setiap pasang dicatat dan dirawat sendiri.</p>
            </div>
            <button
              class="icon-button"
              :disabled="priceRefreshing || !session.online"
              aria-label="Perbarui layanan dan harga"
              @click="refreshPrices"
            >
              <RefreshCw :size="18" :class="{ spin: priceRefreshing }" />
            </button>
          </div>
          <p v-if="priceNote" class="notice compact" role="status">
            {{ priceNote }}
          </p>
          <article
            v-for="(item, index) in items"
            :key="item.id"
            class="shoe-form"
          >
            <div class="shoe-form-heading">
              <h3>
                <span class="shoe-label">{{
                  String(index + 1).padStart(2, "0")
                }}</span
                >Pasang {{ index + 1 }}
              </h3>
              <button
                v-if="items.length > 1"
                type="button"
                class="icon-button danger-text"
                :aria-label="'Hapus pasang ' + (index + 1)"
                @click="items.splice(index, 1)"
              >
                <Trash2 :size="18" />
              </button>
            </div>
            <div class="form-grid">
              <label
                >Deskripsi / merek <span>*</span
                ><input
                  v-model="item.description"
                  maxlength="120"
                  placeholder="Contoh: Nike Air Force 1"
                  required /></label
              ><label
                >Warna <span>*</span
                ><input
                  v-model="item.color"
                  maxlength="60"
                  placeholder="Contoh: putih / hitam"
                  required /></label
              ><label
                >Bahan<input
                  v-model="item.material"
                  maxlength="60"
                  placeholder="Jika diketahui" /></label
              ><label
                >Ukuran<input
                  v-model="item.size"
                  maxlength="20"
                  placeholder="Contoh: 42" /></label
              ><label class="span-2"
                >Kondisi awal & kerusakan <span>*</span
                ><textarea
                  v-model="item.condition"
                  maxlength="1000"
                  placeholder="Catat noda, sobekan, lem lepas, atau kerusakan yang sudah ada"
                  required
                /></label
              ><label
                >Kelengkapan dititipkan<input
                  v-model="item.accessories"
                  maxlength="200"
                  placeholder="Tali, insole, kotak…" /></label
              ><label
                >Lokasi rak<input
                  v-model="item.rack"
                  maxlength="50"
                  placeholder="Contoh: A-03" /></label
              ><label
                >Layanan <span>*</span
                ><select
                  v-model="item.serviceId"
                  @change="setService(item)"
                  required
                >
                  <option value="" disabled>Pilih layanan</option>
                  <option
                    v-for="service in services"
                    :value="service.id"
                    :key="service.id"
                  >
                    {{ service.name }} — {{ rupiah(service.price) }}
                  </option>
                </select></label
              ><label
                >Estimasi selesai <span>*</span
                ><input v-model="item.dueDate" type="date" required /><small
                  class="field-help"
                  >Selesai pada 18.00 WIB.</small
                ></label
              ><label class="span-2"
                >Catatan pengerjaan<textarea
                  v-model="item.notes"
                  maxlength="1000"
                  placeholder="Perhatian khusus untuk tim"
                />
              </label>
            </div>
            <div class="item-price">
              <span>Harga layanan saat transaksi</span
              ><strong>{{ rupiah(item.price) }}</strong>
            </div>
          </article>
          <button
            v-if="items.length < MAX_ITEMS"
            class="button secondary full dashed"
            @click="addItem"
          >
            <Plus :size="18" />Tambah pasang sepatu
          </button>
        </section>
        <section class="panel form-panel">
          <div class="step-heading">
            <span class="step-number">03</span>
            <div>
              <h2>Pembayaran awal</h2>
              <p>Boleh DP, lunas, atau dicatat tanpa pembayaran.</p>
            </div>
            <Wallet :size="22" class="muted" />
          </div>
          <div class="form-grid">
            <label
              >Pembayaran diterapkan (Rp)<input
                v-model.number="initialPayment"
                type="number"
                min="0"
                :max="calculation.total"
                step="1"
                inputmode="numeric" /></label
            ><label
              >Metode<select v-model="method">
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer</option>
                <option value="qris">QRIS — verifikasi manual</option>
              </select></label
            ><label v-if="method === 'tunai' && initialPayment > 0"
              >Uang diserahkan (Rp)<input
                v-model.number="tendered"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
            /></label>
            <div
              v-if="method === 'tunai' && initialPayment > 0"
              class="change-box"
            >
              <span>Kembalian</span><strong>{{ rupiah(change) }}</strong>
            </div>
          </div>
          <p
            v-if="method !== 'tunai' && initialPayment > 0"
            class="notice compact"
          >
            Pastikan uang telah diterima. Transfer dan QRIS diverifikasi manual
            oleh petugas.
          </p>
        </section>
      </div>
      <aside class="order-summary panel">
        <span class="eyebrow">PERIKSA SEBELUM DISIMPAN</span>
        <h2>Ringkasan order</h2>
        <div class="summary-lines">
          <div>
            <span>Jumlah sepatu</span><strong>{{ items.length }} pasang</strong>
          </div>
          <div>
            <span>Subtotal</span
            ><strong>{{ rupiah(calculation.subtotal) }}</strong>
          </div>
        </div>
        <label
          >Diskon nominal (Rp)<input
            v-model.number="discount"
            type="number"
            min="0"
            :max="calculation.subtotal"
            step="1"
            inputmode="numeric"
        /></label>
        <div class="summary-total">
          <span>Total order</span
          ><strong>{{ rupiah(calculation.total) }}</strong>
        </div>
        <div class="summary-lines">
          <div>
            <span>Pembayaran awal</span
            ><strong>{{ rupiah(calculation.paid) }}</strong>
          </div>
          <div>
            <span>Sisa tagihan</span
            ><strong class="text-orange">{{
              rupiah(calculation.balance)
            }}</strong>
          </div>
        </div>
        <label
          >Catatan order<textarea
            v-model="notes"
            maxlength="1000"
            placeholder="Informasi tambahan untuk order ini"
          />
        </label>
        <p v-if="submitError" class="form-error" role="alert">
          {{ submitError }}
        </p>
        <template v-if="confirm"
          ><div class="confirmation">
            <strong>Simpan order ini?</strong>
            <p>
              {{ customer?.name }} · {{ items.length }} pasang ·
              {{ rupiah(calculation.total) }}. Pembayaran awal
              {{ rupiah(initialPayment) }} akan dicatat bersama order.
            </p>
            <button
              class="button full"
              :disabled="saving || !session.online"
              @click="save"
            >
              {{ saving ? "Menyimpan order…" : "Ya, simpan order"
              }}<Check :size="18" /></button
            ><button
              class="button quiet full"
              :disabled="saving"
              @click="confirm = false"
            >
              Periksa lagi
            </button>
          </div></template
        ><button
          v-else
          class="button full"
          :disabled="saving || !session.online || !services.length"
          @click="review"
        >
          Periksa & simpan order<ArrowRight :size="18" />
        </button>
        <p class="summary-note">
          Order berhasil hanya setelah penyimpanan dikonfirmasi. Harga layanan
          tersimpan untuk order ini.
        </p>
      </aside>
    </div></AsyncState
  >
</template>

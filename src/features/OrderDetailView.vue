<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useRoute } from "vue-router";
import {
  ArrowLeft,
  Printer,
  Copy,
  MessageCircle,
  ChevronDown,
  Check,
  ReceiptText,
  Wallet,
  Clock3,
  PackageCheck,
  Ban,
  RefreshCw,
  Footprints,
  Download,
  Link,
  Share2,
} from "lucide-vue-next";
import {
  getOrder,
  getSettings,
  listPayments,
  listEvents,
  addPayment,
  updateItem,
  collectOrder,
  cancelOrder,
} from "../data/repository";
import type {
  Order,
  Payment,
  OrderEvent,
  Method,
  PaymentKind,
  ShoeItem,
} from "../domain/types";
import {
  rupiah,
  dateTime,
  orderStatus,
  STATUSES,
  canCollect,
  receipt,
  message,
} from "../domain/business";
import { useSession } from "../stores/session";
import { useTask, useSettings, errorText } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
import {
  invoiceSnapshot,
  invoiceFingerprint,
  type SharedInvoice,
} from "../domain/invoices";
import {
  publishInvoice,
  getInvoiceLink,
  revokeInvoice,
} from "../data/invoices";
import {
  downloadInvoicePNG,
  downloadInvoicePDF,
  shareInvoiceFile,
} from "../lib/invoice-export";
const route = useRoute(),
  session = useSession(),
  settings = useSettings(),
  order = ref<Order>(),
  payments = ref<Payment[]>([]),
  events = ref<OrderEvent[]>([]),
  { busy, error, run } = useTask(),
  action = useTask(),
  showReceipt = ref(false),
  copyStatus = ref(""),
  showPayment = ref(false),
  confirmPayment = ref(false),
  paymentId = ref(crypto.randomUUID()),
  payment = reactive({
    kind: "payment" as PaymentKind,
    amount: 0,
    method: "tunai" as Method,
    tendered: 0,
    reason: "",
    refId: "",
  }),
  itemEditing = ref<string>(),
  itemForm = reactive({ status: 0, notes: "", rack: "", reason: "" }),
  itemId = ref(crypto.randomUUID()),
  confirmItem = ref(false),
  confirmation = ref<"collect" | "cancel">(),
  reason = ref(""),
  operationId = ref(crypto.randomUUID());
const invoiceLink = ref<SharedInvoice | null>(null),
  invoiceTask = useTask(),
  exportTask = useTask(),
  invoiceConfirm = ref<"publish" | "revoke">(),
  linkCopy = ref("");
const exportSnapshot = computed(() =>
  order.value ? invoiceSnapshot(order.value, settings.value) : undefined,
);
const linkUrl = computed(() =>
  invoiceLink.value
    ? new URL("/invoice/" + invoiceLink.value.token, window.location.origin)
        .href
    : "",
);
const linkActive = computed(
  () =>
    invoiceLink.value?.enabled &&
    invoiceLink.value.expiresAt.toMillis() > Date.now(),
);
const linkChanged = computed(
  () =>
    invoiceLink.value &&
    exportSnapshot.value &&
    invoiceFingerprint(invoiceLink.value.snapshot) !==
      invoiceFingerprint(exportSnapshot.value),
);
async function loadInvoiceLink() {
  await invoiceTask.run(async () => {
    invoiceLink.value = await getInvoiceLink(String(route.params.id));
  });
}
async function commitInvoice() {
  const result = await invoiceTask.run(
    async () => {
      if (invoiceConfirm.value === "revoke") {
        await revokeInvoice(String(route.params.id));
        invoiceLink.value = invoiceLink.value
          ? { ...invoiceLink.value, enabled: false }
          : null;
      } else invoiceLink.value = await publishInvoice(String(route.params.id));
      return true;
    },
    invoiceConfirm.value === "revoke"
      ? "Tautan invoice telah dicabut."
      : "Tautan invoice diperbarui dan berlaku 30 hari.",
  );
  if (result) {
    invoiceConfirm.value = undefined;
    linkCopy.value = "";
    await load();
  }
}
async function copyInvoiceLink() {
  try {
    await navigator.clipboard.writeText(linkUrl.value);
    linkCopy.value = "Link invoice berhasil disalin.";
  } catch {
    linkCopy.value = "Pilih dan salin link di kolom tautan secara manual.";
  }
}
async function exportInvoice(format: "png" | "pdf", share = false) {
  await exportTask.run(async () => {
    const [currentOrder, currentSettings] = await Promise.all([
      getOrder(String(route.params.id)),
      getSettings(),
    ]);
    const snapshot = invoiceSnapshot(currentOrder, currentSettings);
    if (share) await shareInvoiceFile(snapshot, format);
    else if (format === "png") await downloadInvoicePNG(snapshot);
    else await downloadInvoicePDF(snapshot);
  });
}
watch(showReceipt, (value) => {
  if (value) void loadInvoiceLink();
});
async function fetchDetails() {
  const result = await Promise.all([
    getOrder(String(route.params.id)),
    listPayments(String(route.params.id)),
    listEvents(String(route.params.id)),
  ]);
  order.value = result[0];
  payments.value = result[1];
  events.value = result[2];
}
async function load() {
  await run(fetchDetails);
}
const validPayments = computed(() =>
  payments.value.filter(
    (p) =>
      p.kind === "payment" &&
      p.amount <= (order.value?.paid || 0) &&
      !payments.value.some((v) => v.kind === "void" && v.refId === p.id),
  ),
);
function openPayment(kind: PaymentKind) {
  Object.assign(payment, {
    kind,
    amount: kind === "payment" ? order.value?.balance || 0 : 0,
    method: "tunai",
    tendered: 0,
    reason: "",
    refId: "",
  });
  showPayment.value = true;
  confirmPayment.value = false;
  paymentId.value = crypto.randomUUID();
  action.error.value = "";
  action.success.value = "";
}
function referencePayment() {
  const source = validPayments.value.find((p) => p.id === payment.refId);
  if (source) {
    payment.amount = source.amount;
    payment.method = source.method;
    payment.tendered = source.amount;
  }
}
async function savePayment() {
  const result = await action.run(
    async () => {
      await addPayment(
        String(route.params.id),
        {
          ...payment,
          tendered:
            payment.method === "tunai" && payment.kind === "payment"
              ? payment.tendered
              : payment.amount,
        },
        paymentId.value,
      );
      return true;
    },
    payment.kind === "payment"
      ? "Pembayaran berhasil dicatat."
      : payment.kind === "refund"
        ? "Refund berhasil dicatat."
        : "Koreksi berhasil dicatat.",
  );
  if (result) {
    showPayment.value = false;
    confirmPayment.value = false;
    await load();
  }
}
function editItem(item: ShoeItem) {
  itemEditing.value = item.id;
  Object.assign(itemForm, {
    status: item.status,
    notes: item.notes,
    rack: item.rack,
    reason: "",
  });
  confirmItem.value = false;
  itemId.value = crypto.randomUUID();
  action.error.value = "";
  action.success.value = "";
}
async function saveItem() {
  const result = await action.run(async () => {
    await updateItem(
      String(route.params.id),
      itemEditing.value!,
      itemForm.status,
      itemForm.notes,
      itemForm.rack,
      itemForm.reason,
      itemId.value,
    );
    return true;
  }, "Progres sepatu berhasil diperbarui.");
  if (result) {
    itemEditing.value = undefined;
    await load();
  }
}
function openConfirm(kind: "collect" | "cancel") {
  confirmation.value = kind;
  reason.value = "";
  operationId.value = crypto.randomUUID();
  action.error.value = "";
  action.success.value = "";
}
async function commitConfirm() {
  const result = await action.run(
    async () => {
      if (confirmation.value === "collect")
        await collectOrder(String(route.params.id), operationId.value);
      else
        await cancelOrder(
          String(route.params.id),
          reason.value,
          operationId.value,
        );
      return true;
    },
    confirmation.value === "collect"
      ? "Pengambilan berhasil dicatat."
      : "Order dibatalkan. Refund perlu dicatat terpisah.",
  );
  if (result) {
    confirmation.value = undefined;
    invoiceLink.value = null;
    invoiceConfirm.value = undefined;
    await load();
  }
}
async function copyReceipt() {
  try {
    await navigator.clipboard.writeText(receipt(order.value!, settings.value));
    copyStatus.value = "Nota berhasil disalin.";
  } catch {
    copyStatus.value =
      "Tidak dapat menyalin otomatis. Pilih dan salin teks nota secara manual.";
  }
}
function wa(ready = false) {
  if (!order.value) return "#";
  return (
    "https://wa.me/" +
    order.value.customerPhone +
    "?text=" +
    encodeURIComponent(message(order.value, settings.value, ready))
  );
}
function printReceipt() {
  showReceipt.value = true;
  setTimeout(() => window.print(), 100);
}
function reviewPayment() {
  action.error.value = "";
  if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    action.error.value = "Isi nominal rupiah bulat yang lebih dari nol.";
    return;
  }
  if (
    payment.kind === "payment" &&
    payment.amount > (order.value?.balance || 0)
  ) {
    action.error.value = "Pembayaran melebihi sisa tagihan.";
    return;
  }
  if (payment.kind !== "payment" && !payment.reason.trim()) {
    action.error.value = "Alasan wajib diisi.";
    return;
  }
  if (payment.kind === "void" && !payment.refId) {
    action.error.value = "Pilih pembayaran yang akan dikoreksi.";
    return;
  }
  if (
    payment.kind === "payment" &&
    payment.method === "tunai" &&
    payment.tendered < payment.amount
  ) {
    action.error.value = "Uang tunai yang diserahkan kurang.";
    return;
  }
  confirmPayment.value = true;
}
const eventLabels: Record<string, string> = {
  create: "Order dibuat",
  status: "Progres diperbarui",
  collect: "Sepatu diambil",
  cancel: "Order dibatalkan",
  payment: "Pembayaran diterima",
  refund: "Refund dicatat",
  void: "Pembayaran dikoreksi",
};
function staffName(uid: string) {
  return uid === session.user?.uid && session.member?.name
    ? session.member.name
    : "Petugas toko";
}
function statusLabel(status: number) {
  return STATUSES[status] || "Status belum tercatat";
}
function itemChanges(event: OrderEvent) {
  if (event.kind !== "status" && event.kind !== "collect") return [];
  const previous = new Map(
    (event.itemsBefore || []).map((item) => [item.id, item]),
  );
  return (event.itemsAfter || []).flatMap((item) => {
    const before = previous.get(item.id);
    if (!before) return [];
    const statusChanged = before.status !== item.status,
      notesChanged = before.notes !== item.notes,
      rackChanged = before.rack !== item.rack;
    if (!statusChanged && !notesChanged && !rackChanged) return [];
    return [
      {
        id: item.id,
        description: item.description,
        statusChanged,
        statusBefore: before.status,
        statusAfter: item.status,
        notesChanged,
        notesBefore: before.notes || "",
        notesAfter: item.notes || "",
        rackChanged,
        rackBefore: before.rack || "",
        rackAfter: item.rack || "",
      },
    ];
  });
}
watch(
  () => route.params.id,
  () => {
    order.value = undefined;
    payments.value = [];
    events.value = [];
    showPayment.value = false;
    itemEditing.value = undefined;
    confirmation.value = undefined;
    action.error.value = "";
    action.success.value = "";
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <div class="no-print">
    <RouterLink to="/orders" class="back-link"
      ><ArrowLeft :size="17" />Semua order</RouterLink
    >
  </div>
  <div v-if="action.error.value" class="form-error no-print" role="alert">
    {{ action.error.value }}
  </div>
  <div
    v-if="action.success.value"
    class="success-message no-print"
    role="status"
  >
    <Check :size="18" />{{ action.success.value }}
  </div>
  <AsyncState :loading="busy" :error="error" @retry="load"
    ><template v-if="order"
      ><section class="page-heading no-print">
        <div>
          <span class="eyebrow">DETAIL ORDER</span>
          <h1>{{ order.number }}</h1>
          <p>
            {{ order.customerName }} <span class="dot">·</span>
            {{ dateTime(order.createdAt) }}
          </p>
        </div>
        <div class="inline-actions">
          <button
            class="icon-button"
            aria-label="Perbarui detail"
            @click="load"
          >
            <RefreshCw :size="18" /></button
          ><button class="button secondary" @click="showReceipt = !showReceipt">
            <ReceiptText :size="18" />{{
              showReceipt ? "Tutup nota" : "Lihat nota"
            }}
          </button>
        </div>
      </section>

      <section v-if="showReceipt" class="panel receipt-panel">
        <div class="panel-heading no-print">
          <h2>Nota pelanggan</h2>
          <button class="button quiet" @click="showReceipt = false">
            Tutup
          </button>
        </div>
        <div class="receipt-paper">
          <span class="receipt-logo">{{ settings.name }}</span>
          <p>
            {{ settings.address }}<br />{{
              settings.phone ? "+" + settings.phone : ""
            }}
            <span v-if="settings.phone">·</span> {{ settings.hours }}
          </p>
          <div class="receipt-rule" />
          <h3>{{ order.number }}</h3>
          <p>
            {{ dateTime(order.createdAt) }}<br /><strong>{{
              order.customerName
            }}</strong
            ><br />+{{ order.customerPhone }}
          </p>
          <div class="receipt-rule" />
          <div
            v-for="(item, n) in order.items"
            :key="item.id"
            class="receipt-item"
          >
            <strong
              >{{ n + 1 }}. {{ item.description }} · {{ item.color }}</strong
            >
            <div>
              <span>{{ item.serviceName }}</span
              ><span>{{ rupiah(item.price) }}</span>
            </div>
            <small>Estimasi {{ dateTime(item.dueAt) }}</small>
          </div>
          <div class="receipt-rule" />
          <div class="summary-lines">
            <div>
              <span>Subtotal</span><strong>{{ rupiah(order.subtotal) }}</strong>
            </div>
            <div>
              <span>Diskon</span><strong>{{ rupiah(order.discount) }}</strong>
            </div>
            <div>
              <strong>Total order</strong
              ><strong>{{ rupiah(order.total) }}</strong>
            </div>
            <div>
              <span>Pembayaran sah bersih</span
              ><strong>{{ rupiah(order.paid) }}</strong>
            </div>
            <div>
              <strong>Sisa tagihan</strong
              ><strong>{{ rupiah(order.balance) }}</strong>
            </div>
          </div>
          <p class="receipt-status">{{ orderStatus(order) }}</p>
          <div class="receipt-rule" />
          <p class="receipt-terms">{{ settings.terms }}</p>
          <p class="receipt-thanks">
            Terima kasih telah mempercayakan langkah Anda.
          </p>
        </div>
        <div class="receipt-actions no-print">
          <button class="button secondary" @click="copyReceipt">
            <Copy :size="17" />Salin nota</button
          ><button class="button secondary" @click="printReceipt">
            <Printer :size="17" />Cetak</button
          ><a
            :href="
              'https://wa.me/' +
              order.customerPhone +
              '?text=' +
              encodeURIComponent(receipt(order, settings))
            "
            target="_blank"
            rel="noopener"
            class="button"
            ><MessageCircle :size="17" />Kirim nota</a
          >
        </div>
        <p v-if="copyStatus" class="field-help no-print" role="status">
          {{ copyStatus }}
        </p>
        <div class="invoice-sharing no-print">
          <div class="invoice-section-heading">
            <div>
              <span class="eyebrow">INVOICE UNTUK CHAT</span>
              <h2>Simpan file atau bagikan link</h2>
              <p>
                PNG dan PDF hanya memuat identitas toko, nama pelanggan,
                layanan, dan tagihan.
              </p>
            </div>
            <Share2 :size="24" />
          </div>
          <div class="inline-actions">
            <button
              class="button secondary"
              :disabled="exportTask.busy.value"
              @click="exportInvoice('png')"
            >
              <Download :size="17" />Unduh PNG</button
            ><button
              class="button secondary"
              :disabled="exportTask.busy.value"
              @click="exportInvoice('pdf')"
            >
              <Download :size="17" />Unduh PDF</button
            ><button
              class="button secondary"
              :disabled="exportTask.busy.value"
              @click="exportInvoice('png', true)"
            >
              <Share2 :size="17" />Bagikan PNG
            </button>
          </div>
          <p v-if="exportTask.busy.value" class="field-help" role="status">
            Menyiapkan file invoice…
          </p>
          <p v-if="exportTask.error.value" class="form-error" role="alert">
            {{ exportTask.error.value }}
          </p>
          <div class="invoice-link-box">
            <h3><Link :size="18" />Tautan invoice pelanggan</h3>
            <p class="field-help">
              Tautan berisi salinan tagihan saat terakhir diperbarui. Perbarui
              link setelah pembayaran atau perubahan order. URL tetap sama dan
              berlaku 30 hari sejak diperbarui.
            </p>
            <p v-if="invoiceTask.busy.value" class="field-help" role="status">
              Memproses tautan invoice…
            </p>
            <p v-if="invoiceTask.error.value" class="form-error" role="alert">
              {{ invoiceTask.error.value }}
            </p>
            <p
              v-if="invoiceTask.success.value"
              class="success-message"
              role="status"
            >
              {{ invoiceTask.success.value }}
            </p>
            <template v-if="invoiceLink"
              ><p class="invoice-link-status">
                <span
                  class="badge"
                  :class="{ green: linkActive, neutral: !linkActive }"
                  >{{
                    !invoiceLink.enabled
                      ? "Dicabut"
                      : linkActive
                        ? "Tautan aktif"
                        : "Kedaluwarsa"
                  }}</span
                ><span
                  >Berlaku hingga {{ dateTime(invoiceLink.expiresAt) }}</span
                >
              </p>
              <label v-if="linkActive"
                >Link invoice<input
                  :value="linkUrl"
                  readonly
                  @focus="($event.target as HTMLInputElement).select()"
              /></label>
              <p v-if="linkActive && linkChanged" class="notice compact">
                Tagihan atau detail order telah berubah. Perbarui tautan sebelum
                membagikannya agar pelanggan melihat invoice terbaru.
              </p>
              <p v-if="linkActive" class="field-help">
                Terakhir diperbarui {{ dateTime(invoiceLink.updatedAt) }}.
              </p></template
            >
            <div v-if="!invoiceConfirm" class="inline-actions">
              <button
                class="button"
                :disabled="invoiceTask.busy.value || !session.online"
                @click="invoiceConfirm = 'publish'"
              >
                {{
                  invoiceLink ? "Perbarui link invoice" : "Buat link invoice"
                }}</button
              ><template v-if="linkActive"
                ><button
                  class="button secondary"
                  :disabled="invoiceTask.busy.value"
                  @click="copyInvoiceLink"
                >
                  <Copy :size="17" />Salin link</button
                ><a
                  :href="
                    'https://wa.me/' +
                    order.customerPhone +
                    '?text=' +
                    encodeURIComponent(
                      'Invoice ' + order.number + ': ' + linkUrl,
                    )
                  "
                  class="button secondary"
                  target="_blank"
                  rel="noopener"
                  ><MessageCircle :size="17" />Bagikan link ke WhatsApp</a
                ><button
                  class="button quiet danger-text"
                  :disabled="invoiceTask.busy.value || !session.online"
                  @click="invoiceConfirm = 'revoke'"
                >
                  Cabut link
                </button></template
              >
            </div>
            <div v-else class="confirmation">
              <strong>{{
                invoiceConfirm === "publish"
                  ? "Siapa pun yang memiliki link bisa melihat nama dan tagihan invoice ini."
                  : "Cabut tautan invoice ini?"
              }}</strong>
              <p>
                {{
                  invoiceConfirm === "publish"
                    ? "Link tidak memuat nomor pelanggan, catatan pengerjaan, atau data petugas. Tautan aktif selama 30 hari dan dapat dicabut kapan saja."
                    : "Pelanggan tidak dapat membuka link ini sampai Anda memperbaruinya kembali."
                }}
              </p>
              <div class="form-actions">
                <button
                  class="button secondary"
                  :disabled="invoiceTask.busy.value"
                  @click="invoiceConfirm = undefined"
                >
                  Batal</button
                ><button
                  class="button"
                  :class="{ danger: invoiceConfirm === 'revoke' }"
                  :disabled="invoiceTask.busy.value || !session.online"
                  @click="commitInvoice"
                >
                  {{
                    invoiceTask.busy.value
                      ? "Menyimpan…"
                      : invoiceConfirm === "publish"
                        ? "Ya, terbitkan link"
                        : "Ya, cabut link"
                  }}
                </button>
              </div>
            </div>
            <p v-if="linkCopy" class="field-help" role="status">
              {{ linkCopy }}
            </p>
          </div>
        </div>
      </section>
      <div class="detail-layout no-print">
        <div>
          <section class="panel detail-customer">
            <div>
              <span class="eyebrow">PELANGGAN</span
              ><RouterLink
                :to="'/customers/' + order.customerId"
                class="customer-name"
                >{{ order.customerName }}</RouterLink
              ><a
                :href="'https://wa.me/' + order.customerPhone"
                target="_blank"
                rel="noopener"
                class="muted"
                >+{{ order.customerPhone }}</a
              >
            </div>
            <span
              class="badge"
              :class="{
                green: order.allReady,
                neutral: order.cancelled || order.collected,
              }"
              >{{ orderStatus(order) }}</span
            >
          </section>
          <section class="panel form-panel">
            <div class="panel-heading compact-heading">
              <div>
                <h2>Sepatu & progres</h2>
                <p>
                  {{ order.readyCount }} dari {{ order.itemCount }} pasang siap
                  diambil
                </p>
              </div>
              <Footprints :size="22" class="muted" />
            </div>
            <article
              v-for="(item, index) in order.items"
              :key="item.id"
              class="shoe-detail"
            >
              <div class="shoe-detail-heading">
                <span class="shoe-label">{{
                  String(index + 1).padStart(2, "0")
                }}</span>
                <div>
                  <h3>{{ item.description }}</h3>
                  <p>
                    {{ item.color
                    }}{{ item.material ? " · " + item.material : ""
                    }}{{ item.size ? " · Ukuran " + item.size : "" }}
                  </p>
                </div>
                <span class="badge" :class="{ green: item.status >= 4 }">{{
                  STATUSES[item.status]
                }}</span>
              </div>
              <div class="status-track" :aria-label="STATUSES[item.status]">
                <span
                  v-for="(_, step) in STATUSES"
                  :key="step"
                  :class="{ done: step <= item.status }"
                />
              </div>
              <dl class="shoe-facts">
                <div>
                  <dt>Layanan</dt>
                  <dd>{{ item.serviceName }} · {{ rupiah(item.price) }}</dd>
                </div>
                <div>
                  <dt>Estimasi selesai</dt>
                  <dd
                    :class="{
                      'text-orange':
                        item.status < 4 && item.dueAt.toMillis() < Date.now(),
                    }"
                  >
                    {{ dateTime(item.dueAt) }}
                  </dd>
                </div>
                <div>
                  <dt>Kondisi awal</dt>
                  <dd>{{ item.condition }}</dd>
                </div>
                <div>
                  <dt>Kelengkapan</dt>
                  <dd>{{ item.accessories || "Tidak ada catatan" }}</dd>
                </div>
                <div v-if="item.rack">
                  <dt>Rak</dt>
                  <dd>{{ item.rack }}</dd>
                </div>
                <div v-if="item.notes">
                  <dt>Catatan pengerjaan</dt>
                  <dd>{{ item.notes }}</dd>
                </div>
              </dl>
              <button
                v-if="
                  itemEditing !== item.id &&
                  !order.cancelled &&
                  !order.collected
                "
                class="button secondary"
                :disabled="!session.online"
                @click="editItem(item)"
              >
                Ubah progres<ChevronDown :size="16" />
              </button>
              <form
                v-if="itemEditing === item.id"
                class="inline-form"
                @submit.prevent="confirmItem = true"
              >
                <div class="form-grid">
                  <label
                    >Status<select v-model.number="itemForm.status">
                      <option
                        v-for="(status, step) in STATUSES.slice(0, 5)"
                        :key="step"
                        :value="step"
                        :disabled="
                          !session.owner &&
                          (step < item.status || step > item.status + 1)
                        "
                      >
                        {{ status }}
                      </option>
                    </select></label
                  ><label
                    >Lokasi rak<input
                      v-model="itemForm.rack"
                      maxlength="50" /></label
                  ><label class="span-2"
                    >Catatan pengerjaan<textarea
                      v-model="itemForm.notes"
                      maxlength="1000"
                    /></label
                  ><label v-if="itemForm.status < item.status" class="span-2"
                    >Alasan koreksi mundur <span>*</span
                    ><textarea
                      v-model="itemForm.reason"
                      required
                      maxlength="1000"
                    />
                  </label>
                </div>
                <div v-if="confirmItem" class="confirmation">
                  <strong>Konfirmasi perubahan?</strong>
                  <p>
                    Status menjadi {{ STATUSES[itemForm.status] }}. Perubahan
                    tercatat di riwayat.
                  </p>
                  <div class="form-actions">
                    <button
                      type="button"
                      class="button secondary"
                      :disabled="action.busy.value"
                      @click="confirmItem = false"
                    >
                      Periksa lagi</button
                    ><button
                      type="button"
                      class="button"
                      :disabled="action.busy.value || !session.online"
                      @click="saveItem"
                    >
                      {{
                        action.busy.value ? "Menyimpan…" : "Ya, simpan progres"
                      }}
                    </button>
                  </div>
                </div>
                <div v-else class="form-actions">
                  <button
                    type="button"
                    class="button quiet"
                    @click="itemEditing = undefined"
                  >
                    Batal</button
                  ><button
                    class="button"
                    :disabled="action.busy.value || !session.online"
                  >
                    Periksa perubahan
                  </button>
                </div>
              </form>
            </article>
            <div v-if="order.notes" class="order-note">
              <strong>Catatan order</strong>
              <p>{{ order.notes }}</p>
            </div>
          </section>
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>Riwayat pembayaran</h2>
                <p>Transaksi dicatat tanpa mengubah riwayat sebelumnya.</p>
              </div>
              <Wallet :size="20" class="muted" />
            </div>
            <AsyncState
              :empty="!payments.length"
              empty-title="Belum ada pembayaran"
              empty-text="Pembayaran yang diterima akan dicatat di sini."
              ><div v-for="p in payments" :key="p.id" class="payment-row">
                <span
                  class="payment-mark"
                  :class="{ refund: p.kind !== 'payment' }"
                  ><Wallet :size="18"
                /></span>
                <div>
                  <strong
                    >{{
                      p.kind === "payment"
                        ? "Pembayaran"
                        : p.kind === "refund"
                          ? "Refund"
                          : "Koreksi / pembatalan"
                    }}
                    ·
                    {{ p.method === "qris" ? "QRIS manual" : p.method }}</strong
                  ><small
                    >{{ dateTime(p.createdAt) }} ·
                    {{ staffName(p.createdBy) }}</small
                  ><small v-if="p.method === 'tunai' && p.kind === 'payment'"
                    >Diserahkan {{ rupiah(p.tendered) }} · Kembali
                    {{ rupiah(p.change) }}</small
                  >
                  <p v-if="p.reason">{{ p.reason }}</p>
                  <details v-if="session.owner" class="audit-details">
                    <summary>Detail pencatatan</summary>
                    <small>ID petugas: {{ p.createdBy }}</small
                    ><small>ID transaksi: {{ p.id }}</small
                    ><small v-if="p.refId">Referensi: {{ p.refId }}</small
                    ><small>Versi order: {{ p.orderVersion }}</small>
                  </details>
                </div>
                <strong :class="{ 'text-orange': p.kind !== 'payment' }"
                  >{{ p.kind === "payment" ? "+" : "−"
                  }}{{ rupiah(p.amount) }}</strong
                >
              </div></AsyncState
            >
          </section>
          <section class="panel">
            <div class="panel-heading">
              <h2>Riwayat order</h2>
              <Clock3 :size="20" class="muted" />
            </div>
            <ol class="event-list">
              <li v-for="event in events" :key="event.id">
                <i />
                <div>
                  <strong>{{
                    eventLabels[event.kind] || "Aktivitas order"
                  }}</strong>
                  <div
                    v-for="change in itemChanges(event)"
                    :key="change.id"
                    class="event-item-change"
                  >
                    <strong>{{ change.description }}</strong>
                    <p v-if="change.statusChanged">
                      Status: {{ statusLabel(change.statusBefore) }} →
                      {{ statusLabel(change.statusAfter) }}
                    </p>
                    <div v-if="change.notesChanged" class="event-field-change">
                      <span>Catatan pengerjaan</span>
                      <p>
                        <span>Sebelumnya:</span>
                        {{ change.notesBefore || "Belum ada catatan" }}
                      </p>
                      <p>
                        <span>Sesudahnya:</span>
                        {{ change.notesAfter || "Catatan dihapus" }}
                      </p>
                    </div>
                    <div v-if="change.rackChanged" class="event-field-change">
                      <span>Lokasi rak</span>
                      <p>
                        <span>Sebelumnya:</span>
                        {{ change.rackBefore || "Belum ditentukan" }}
                      </p>
                      <p>
                        <span>Sesudahnya:</span>
                        {{ change.rackAfter || "Lokasi dihapus" }}
                      </p>
                    </div>
                  </div>
                  <p v-if="event.reason">{{ event.reason }}</p>
                  <small
                    >{{ dateTime(event.createdAt) }} ·
                    {{ staffName(event.actor) }}</small
                  >
                  <details v-if="session.owner" class="audit-details">
                    <summary>Detail pencatatan</summary>
                    <small>ID petugas: {{ event.actor }}</small
                    ><small>ID aktivitas: {{ event.id }}</small
                    ><small
                      >Versi order: {{ event.beforeVersion }} →
                      {{ event.afterVersion }}</small
                    ><small v-if="event.paymentId"
                      >ID transaksi: {{ event.paymentId }}</small
                    >
                  </details>
                </div>
              </li>
            </ol>
          </section>
        </div>
        <aside>
          <section class="panel order-summary">
            <span class="eyebrow">RINGKASAN TAGIHAN</span>
            <h2>{{ order.balance === 0 ? "Sudah lunas" : "Sisa tagihan" }}</h2>
            <strong
              class="detail-balance"
              :class="{ 'text-orange': order.balance > 0 }"
              >{{ rupiah(order.balance) }}</strong
            >
            <div class="summary-lines">
              <div>
                <span>Subtotal</span
                ><strong>{{ rupiah(order.subtotal) }}</strong>
              </div>
              <div>
                <span>Diskon</span><strong>{{ rupiah(order.discount) }}</strong>
              </div>
              <div>
                <span>Total order</span
                ><strong>{{ rupiah(order.total) }}</strong>
              </div>
              <div>
                <span>Pembayaran sah bersih</span
                ><strong>{{ rupiah(order.paid) }}</strong>
              </div>
            </div>
            <button
              v-if="order.balance > 0 && !order.cancelled && !order.collected"
              class="button full"
              :disabled="!session.online || action.busy.value"
              @click="openPayment('payment')"
            >
              <Wallet :size="18" />Terima pembayaran
            </button>
            <div
              v-if="session.owner && order.paid > 0"
              class="owner-payment-actions"
            >
              <button
                class="button secondary"
                :disabled="!session.online || action.busy.value"
                @click="openPayment('refund')"
              >
                Catat refund</button
              ><button
                class="button secondary"
                :disabled="
                  !session.online ||
                  action.busy.value ||
                  !validPayments.length ||
                  order.collected
                "
                @click="openPayment('void')"
              >
                Koreksi
              </button>
            </div>
            <form
              v-if="showPayment"
              class="inline-form"
              @submit.prevent="reviewPayment"
            >
              <p v-if="action.error.value" class="form-error" role="alert">
                {{ action.error.value }}
              </p>
              <h3>
                {{
                  payment.kind === "payment"
                    ? "Terima pembayaran"
                    : payment.kind === "refund"
                      ? "Catat refund"
                      : "Koreksi pembayaran"
                }}
              </h3>
              <label v-if="payment.kind === 'void'"
                >Pembayaran asal<select
                  v-model="payment.refId"
                  required
                  @change="referencePayment"
                >
                  <option value="" disabled>Pilih pembayaran</option>
                  <option v-for="p in validPayments" :key="p.id" :value="p.id">
                    {{ dateTime(p.createdAt) }} · {{ rupiah(p.amount) }}
                  </option>
                </select></label
              ><label
                >Nominal (Rp)<input
                  v-model.number="payment.amount"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  required
                  :readonly="payment.kind === 'void'" /></label
              ><label
                >Metode<select
                  v-model="payment.method"
                  :disabled="payment.kind === 'void'"
                >
                  <option value="tunai">Tunai</option>
                  <option value="transfer">Transfer</option>
                  <option value="qris">QRIS — verifikasi manual</option>
                </select></label
              ><label
                v-if="payment.kind === 'payment' && payment.method === 'tunai'"
                >Uang diserahkan (Rp)<input
                  v-model.number="payment.tendered"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  required
              /></label>
              <p
                v-if="payment.kind === 'payment' && payment.method === 'tunai'"
                class="field-help"
              >
                Kembalian:
                {{ rupiah(Math.max(0, payment.tendered - payment.amount)) }}
              </p>
              <label v-if="payment.kind !== 'payment'"
                >Alasan <span>*</span
                ><textarea v-model="payment.reason" required maxlength="1000" />
              </label>
              <p v-if="payment.method === 'qris'" class="notice compact">
                QRIS diverifikasi manual. Pastikan dana telah diterima atau
                dikembalikan sebelum mencatat.
              </p>
              <p v-if="payment.kind === 'refund'" class="notice compact">
                Refund mengurangi penerimaan bersih. Maksimal pembayaran bersih
                {{ rupiah(order.paid) }}. Batalkan order secara terpisah bila
                diperlukan.
              </p>
              <p v-if="payment.kind === 'void'" class="notice compact">
                Koreksi membalik nilai pembayaran asal dan mempertahankan
                seluruh riwayat. Pengembalian uang sungguhan dicatat sebagai
                refund.
              </p>
              <div v-if="confirmPayment" class="confirmation">
                <strong
                  >Catat
                  {{
                    payment.kind === "payment"
                      ? "pembayaran"
                      : payment.kind === "refund"
                        ? "refund"
                        : "koreksi"
                  }}
                  {{ rupiah(payment.amount) }}?</strong
                >
                <p>Pastikan nominal dan metode sudah benar.</p>
                <button
                  type="button"
                  class="button full"
                  :disabled="action.busy.value || !session.online"
                  @click="savePayment"
                >
                  {{
                    action.busy.value ? "Menyimpan…" : "Ya, catat transaksi"
                  }}</button
                ><button
                  type="button"
                  class="button quiet full"
                  :disabled="action.busy.value"
                  @click="confirmPayment = false"
                >
                  Periksa lagi
                </button>
              </div>
              <div v-else class="form-actions">
                <button
                  type="button"
                  class="button quiet"
                  @click="showPayment = false"
                >
                  Batal</button
                ><button
                  class="button"
                  :disabled="action.busy.value || !session.online"
                >
                  Periksa
                </button>
              </div>
            </form>
          </section>
          <section class="panel form-panel fulfillment-panel">
            <h2>Langkah selanjutnya</h2>
            <p v-if="order.cancelled">
              Order dibatalkan. Pembatalan tidak otomatis mengembalikan uang.
            </p>
            <p v-else-if="order.collected">
              Semua sepatu telah diambil. Terima kasih untuk pelayanan yang
              rapi.
            </p>
            <template v-else
              ><p>
                {{
                  order.allReady
                    ? "Semua sepatu siap. Kabari pelanggan agar segera diambil."
                    : "Selesaikan progres setiap pasang, lalu kabari pelanggan."
                }}
              </p>
              <a
                :href="wa(false)"
                target="_blank"
                rel="noopener"
                class="button secondary full"
                ><MessageCircle :size="18" />Pesan order diterima</a
              ><a
                v-if="order.allReady"
                :href="wa(true)"
                target="_blank"
                rel="noopener"
                class="button secondary full"
                ><MessageCircle :size="18" />Pesan siap diambil</a
              ><button
                class="button full"
                :disabled="
                  !canCollect(order) || !session.online || action.busy.value
                "
                @click="openConfirm('collect')"
              >
                <PackageCheck :size="18" />Catat pengambilan
              </button>
              <p class="field-help">
                Pengambilan sekaligus: semua pasang siap dan tagihan lunas.
              </p>
              <button
                v-if="session.owner"
                class="button quiet full danger-text"
                :disabled="!session.online || action.busy.value"
                @click="openConfirm('cancel')"
              >
                <Ban :size="17" />Batalkan order
              </button></template
            >
            <p class="field-help">
              Pesan WhatsApp dibuka untuk Anda kirim secara manual.
            </p>
          </section>
        </aside>
      </div>
      <div v-if="confirmation" class="modal-backdrop no-print">
        <section
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="
            confirmation === 'collect'
              ? 'Konfirmasi pengambilan'
              : 'Konfirmasi pembatalan'
          "
        >
          <h2>
            {{
              confirmation === "collect"
                ? "Sepatu sudah diambil?"
                : "Batalkan order ini?"
            }}
          </h2>
          <p>
            {{
              confirmation === "collect"
                ? "Semua pasang akan ditandai sudah diambil. Pastikan sepatu diserahkan kepada pelanggan."
                : "Pembatalan tidak otomatis mengembalikan uang. Catat refund secara terpisah jika dana dikembalikan."
            }}
          </p>
          <label v-if="confirmation === 'cancel'"
            >Alasan pembatalan <span>*</span
            ><textarea v-model="reason" maxlength="1000" />
          </label>
          <p v-if="action.error.value" class="form-error">
            {{ action.error.value }}
          </p>
          <div class="form-actions">
            <button
              class="button secondary"
              :disabled="action.busy.value"
              @click="confirmation = undefined"
            >
              Batal</button
            ><button
              class="button"
              :class="{ danger: confirmation === 'cancel' }"
              :disabled="
                action.busy.value ||
                !session.online ||
                (confirmation === 'cancel' && !reason.trim())
              "
              @click="commitConfirm"
            >
              {{
                action.busy.value
                  ? "Menyimpan…"
                  : confirmation === "collect"
                    ? "Ya, catat pengambilan"
                    : "Ya, batalkan order"
              }}
            </button>
          </div>
        </section>
      </div>
    </template></AsyncState
  >
</template>

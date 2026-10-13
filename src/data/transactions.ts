import {
  doc,
  runTransaction,
  serverTimestamp,
  getDocFromServer,
} from "firebase/firestore";
import type { Firestore, Transaction } from "firebase/firestore";
import type {
  Membership,
  Order,
  OrderInput,
  OrderEvent,
  Payment,
  PaymentKind,
  Method,
  Settings,
  Customer,
} from "../domain/types";
import {
  totals,
  cash,
  progress,
  canCollect,
  money,
  normalizePhone,
  dateKey,
} from "../domain/business";
export interface Context {
  db: Firestore;
  storeId: string;
  uid: string;
  role: Membership["role"];
}
export function createOperations(ctx: Context) {
  const ref = (path: string) => doc(ctx.db, `stores/${ctx.storeId}/${path}`);
  const guard = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      throw new Error("Anda offline. Sambungkan internet sebelum menyimpan.");
    if (!ctx.uid) throw new Error("Silakan login kembali.");
  };
  async function idempotent<T>(
    path: string,
    actorField: string,
    operation: () => Promise<T>,
    confirmed: T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      try {
        const witness = await getDocFromServer(ref(path));
        if (witness.exists() && witness.data()[actorField] === ctx.uid)
          return confirmed;
      } catch {
        /* Preserve the original error if server confirmation is unavailable. */
      }
      throw error;
    }
  }
  const readOrder = async (tx: Transaction, id: string) => {
    const snap = await tx.get(ref(`orders/${id}`));
    if (!snap.exists()) throw new Error("Order tidak ditemukan.");
    return { id, ...snap.data() } as Order;
  };
  function writeEvent(
    tx: Transaction,
    o: Order,
    id: string,
    kind: OrderEvent["kind"],
    reason = "",
    paymentId = "",
    itemsAfter: Order["items"] = [],
  ) {
    tx.set(ref(`orders/${o.id}/events/${id}`), {
      kind,
      reason,
      actor: ctx.uid,
      createdAt: serverTimestamp(),
      beforeVersion: o.version,
      afterVersion: o.version + 1,
      paymentId,
      itemsBefore: itemsAfter.length ? o.items : [],
      itemsAfter,
    });
  }
  async function createOrder(input: OrderInput, id: string) {
    guard();
    return idempotent(
      `orders/${id}`,
      "createdBy",
      () =>
        runTransaction(ctx.db, async (tx) => {
          const existing = await tx.get(ref(`orders/${id}`));
          if (existing.exists()) return id;
          const customer = await tx.get(ref(`customers/${input.customer.id}`)),
            settings = await tx.get(ref("settings/general"));
          if (!customer.exists() || !settings.exists())
            throw new Error("Pelanggan atau pengaturan toko belum tersedia.");
          const s = settings.data() as Settings,
            c = { id: customer.id, ...customer.data() } as Customer;
          const serviceDocs = await Promise.all(
            input.items.map((i) => tx.get(ref(`services/${i.serviceId}`))),
          );
          const items = input.items.map((i, n) => {
            const service = serviceDocs[n]!;
            if (!service.exists() || !service.data().active)
              throw new Error("Layanan sudah tidak aktif.");
            if (
              service.data().price !== i.price ||
              service.data().name !== i.serviceName
            )
              throw new Error(
                "Harga layanan berubah. Pilih ulang layanan untuk memuat harga terbaru.",
              );
            if (!i.description.trim() || !i.color.trim() || !i.condition.trim())
              throw new Error(
                "Isi deskripsi, warna, dan kondisi awal setiap sepatu.",
              );
            if (i.dueAt.toMillis() < Date.now() - 60000)
              throw new Error("Estimasi selesai tidak boleh di masa lalu.");
            return { ...i, id: `${id}-${n + 1}`, status: 0 };
          });
          const bill = totals(items, input.discount, input.initialPayment);
          const number = `${s.prefix}-${dateKey().slice(2).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
          const reservation = await tx.get(ref(`orderNumbers/${number}`));
          if (reservation.exists())
            throw new Error(
              "Nomor order bertabrakan. Buka form order baru; data belum disimpan.",
            );
          const initial = input.initialPayment > 0,
            paymentId = initial ? id : "";
          tx.set(ref(`orders/${id}`), {
            number,
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            items,
            ...progress(items),
            ...bill,
            cancelled: false,
            collected: false,
            active: true,
            notes: input.notes,
            createdBy: ctx.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            version: 1,
            lastEventId: id,
          });
          items.forEach((item, n) =>
            tx.set(ref(`orders/${id}/items/${n + 1}`), item),
          );
          tx.set(ref(`orderNumbers/${number}`), {
            orderId: id,
            createdAt: serverTimestamp(),
          });
          tx.set(ref(`orders/${id}/events/${id}`), {
            kind: "create",
            reason: "",
            actor: ctx.uid,
            createdAt: serverTimestamp(),
            beforeVersion: 0,
            afterVersion: 1,
            paymentId,
            itemsBefore: [],
            itemsAfter: items,
          });
          if (initial) {
            const p = {
              orderId: id,
              kind: "payment",
              amount: input.initialPayment,
              method: input.method,
              ...cash(input.initialPayment, input.method, input.tendered),
              reason: "",
              refId: "",
              createdBy: ctx.uid,
              createdAt: serverTimestamp(),
              orderVersion: 1,
            };
            tx.set(ref(`payments/${id}`), p);
            tx.set(ref(`orders/${id}/payments/${id}`), p);
          }
          return id;
        }),
      id,
    );
  }
  async function addPayment(
    orderId: string,
    value: {
      kind: PaymentKind;
      amount: number;
      method: Method;
      tendered: number;
      reason: string;
      refId: string;
    },
    id: string,
  ) {
    guard();
    await idempotent(
      `orders/${orderId}/payments/${id}`,
      "createdBy",
      () =>
        runTransaction(ctx.db, async (tx) => {
          const existing = await tx.get(
            ref(`orders/${orderId}/payments/${id}`),
          );
          if (existing.exists()) return;
          const o = await readOrder(tx, orderId);
          let amount = money(value.amount),
            tendered = amount,
            change = 0;
          if (value.kind !== "payment") {
            if (ctx.role !== "owner")
              throw new Error("Koreksi dan refund hanya untuk owner.");
            if (!value.reason.trim()) throw new Error("Alasan wajib diisi.");
          }
          if (value.kind === "payment") {
            if (o.cancelled || o.collected)
              throw new Error("Order ini tidak menerima pembayaran.");
            if (amount > o.balance)
              throw new Error("Pembayaran melebihi sisa tagihan.");
            ({ tendered, change } = cash(amount, value.method, value.tendered));
          }
          if (value.kind === "void") {
            const original = await tx.get(ref(`payments/${value.refId}`)),
              marker = await tx.get(ref(`voids/${value.refId}`));
            if (
              !original.exists() ||
              original.data().orderId !== orderId ||
              original.data().kind !== "payment"
            )
              throw new Error("Pembayaran asal tidak valid.");
            if (marker.exists()) throw new Error("Pembayaran sudah dikoreksi.");
            if (o.collected)
              throw new Error(
                "Order sudah diambil; gunakan refund dengan alasan.",
              );
            amount = original.data().amount;
            tendered = amount;
            tx.set(ref(`voids/${value.refId}`), {
              orderId,
              reversalId: id,
              createdAt: serverTimestamp(),
            });
          }
          if (amount <= 0) throw new Error("Nominal harus lebih dari nol.");
          const paid = o.paid + (value.kind === "payment" ? amount : -amount);
          if (paid < 0)
            throw new Error("Refund/koreksi melebihi pembayaran sah bersih.");
          const payment = {
            orderId,
            kind: value.kind,
            amount,
            method: value.method,
            tendered,
            change,
            reason: value.reason,
            refId: value.kind === "void" ? value.refId : "",
            createdBy: ctx.uid,
            createdAt: serverTimestamp(),
            orderVersion: o.version + 1,
          };
          tx.set(ref(`payments/${id}`), payment);
          tx.set(ref(`orders/${orderId}/payments/${id}`), payment);
          tx.update(ref(`orders/${orderId}`), {
            paid,
            balance: o.total - paid,
            version: o.version + 1,
            lastEventId: id,
            updatedAt: serverTimestamp(),
          });
          writeEvent(tx, o, id, value.kind, value.reason, id);
        }),
      undefined,
    );
  }
  async function mutate(
    orderId: string,
    id: string,
    kind: OrderEvent["kind"],
    reason: string,
    patch: (o: Order) => Record<string, unknown>,
  ) {
    guard();
    await idempotent(
      `orders/${orderId}/events/${id}`,
      "actor",
      () =>
        runTransaction(ctx.db, async (tx) => {
          const event = await tx.get(ref(`orders/${orderId}/events/${id}`));
          if (event.exists()) return;
          const o = await readOrder(tx, orderId),
            changes = patch(o);
          if (changes.items) {
            const items = changes.items as Order["items"];
            items.forEach((item, n) => {
              if (
                item.status !== o.items[n]!.status ||
                item.notes !== o.items[n]!.notes ||
                item.rack !== o.items[n]!.rack
              )
                tx.set(ref(`orders/${orderId}/items/${n + 1}`), item);
            });
          }
          tx.update(ref(`orders/${orderId}`), {
            ...changes,
            version: o.version + 1,
            lastEventId: id,
            updatedAt: serverTimestamp(),
          });
          writeEvent(
            tx,
            o,
            id,
            kind,
            reason,
            "",
            (changes.items as Order["items"]) || [],
          );
        }),
      undefined,
    );
  }
  async function updateItem(
    orderId: string,
    itemId: string,
    status: number,
    notes: string,
    rack: string,
    reason: string,
    id: string,
  ) {
    await mutate(orderId, id, "status", reason, (o) => {
      if (!o.active) throw new Error("Order sudah ditutup.");
      const old = o.items.find((i) => i.id === itemId);
      if (!old) throw new Error("Item tidak ditemukan.");
      if (!Number.isInteger(status) || status < 0 || status > 4)
        throw new Error("Status item tidak valid.");
      if (status < old.status && (ctx.role !== "owner" || !reason.trim()))
        throw new Error("Koreksi mundur memerlukan owner dan alasan.");
      if (ctx.role !== "owner" && status > old.status + 1)
        throw new Error("Progres harus berurutan.");
      const items = o.items.map((i) =>
        i.id === itemId ? { ...i, status, notes, rack } : i,
      );
      return { items, ...progress(items) };
    });
  }
  async function collectOrder(orderId: string, id: string) {
    await mutate(orderId, id, "collect", "", (o) => {
      if (!canCollect(o))
        throw new Error("Semua sepatu harus siap dan tagihan harus lunas.");
      return {
        items: o.items.map((i) => ({ ...i, status: 5 })),
        collected: true,
        active: false,
      };
    });
  }
  async function cancelOrder(orderId: string, reason: string, id: string) {
    if (ctx.role !== "owner" || !reason.trim())
      throw new Error("Pembatalan memerlukan owner dan alasan.");
    await mutate(orderId, id, "cancel", reason, (o) => {
      if (!o.active) throw new Error("Order sudah ditutup.");
      return { cancelled: true, active: false };
    });
  }
  async function saveCustomer(
    value: { name: string; phone: string; notes: string },
    id: string = crypto.randomUUID(),
  ) {
    guard();
    const phone = normalizePhone(value.phone),
      name = value.name.trim();
    if (!name) throw new Error("Nama pelanggan wajib diisi.");
    await runTransaction(ctx.db, async (tx) => {
      const old = await tx.get(ref(`customers/${id}`)),
        lock = await tx.get(ref(`phones/${phone}`));
      if (lock.exists() && lock.data().customerId !== id)
        throw new Error(
          "Nomor WhatsApp sudah terdaftar. Cari dan pilih pelanggan tersebut.",
        );
      tx.set(ref(`customers/${id}`), {
        name,
        nameLower: name.toLowerCase(),
        phone,
        notes: value.notes,
        createdAt: old.exists() ? old.data().createdAt : serverTimestamp(),
      });
      if (!old.exists() || old.data().phone !== phone) {
        tx.set(ref(`phones/${phone}`), { customerId: id });
        if (old.exists()) tx.delete(ref(`phones/${old.data().phone}`));
      }
    });
    return id;
  }
  return {
    createOrder,
    addPayment,
    updateItem,
    collectOrder,
    cancelOrder,
    saveCustomer,
  };
}

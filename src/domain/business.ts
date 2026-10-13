import { Timestamp } from "firebase/firestore";
import type { Order, ShoeItem, Method, Payment, Settings } from "./types";
export const MAX_ITEMS = 4;
export const STATUSES = [
  "Diterima",
  "Dicuci",
  "Dikeringkan",
  "Quality Check",
  "Siap Diambil",
  "Sudah Diambil",
];
export const defaultSettings: Settings = {
  name: "SoleKasir",
  address: "",
  phone: "",
  hours: "09.00–18.00 WIB",
  terms:
    "Periksa kondisi sepatu saat pengambilan. Simpan nota sebagai bukti pengambilan.",
  receivedTemplate:
    "Halo {nama}, order {order} sudah kami terima. Estimasi selesai {estimasi}. Total {total}, sisa tagihan {sisa}. Terima kasih! — {toko}",
  readyTemplate:
    "Halo {nama}, sepatu untuk order {order} sudah siap diambil. Sisa tagihan {sisa}. Sampai jumpa di {toko}!",
  prefix: "SK",
};
export function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
export function dateTime(value: Timestamp | number | undefined) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(typeof value === "number" ? value : value.toMillis())
    : "—";
}
export function dateKey(value = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function dayRange(from: string, to = from) {
  const start = Date.parse(from + "T00:00:00+07:00"),
    end = Date.parse(to + "T00:00:00+07:00") + 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error("Periode tanggal tidak valid.");
  return { start: Timestamp.fromMillis(start), end: Timestamp.fromMillis(end) };
}
export function normalizePhone(raw: string) {
  let p = raw.replace(/[\s()+.-]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  if (!/^628\d{8,11}$/.test(p))
    throw new Error(
      "Nomor WhatsApp Indonesia tidak valid. Contoh: 081234567890.",
    );
  return p;
}
export function money(value: number, label = "Nominal") {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000000)
    throw new Error(label + " harus rupiah bulat antara 0 dan 100 juta.");
  return value;
}
export function totals(
  items: Pick<ShoeItem, "price">[],
  discount: number,
  paid = 0,
) {
  if (items.length < 1 || items.length > MAX_ITEMS)
    throw new Error("Isi 1–4 pasang per order.");
  const subtotal = money(
    items.reduce((s, i) => s + money(i.price, "Harga"), 0),
    "Subtotal",
  );
  money(discount, "Diskon");
  money(paid, "Pembayaran");
  if (discount > subtotal) throw new Error("Diskon melebihi subtotal.");
  const total = subtotal - discount;
  if (paid > total) throw new Error("Pembayaran melebihi sisa tagihan.");
  return { subtotal, discount, total, paid, balance: total - paid };
}
export function cash(amount: number, method: Method, tendered: number) {
  money(amount);
  if (amount <= 0) throw new Error("Pembayaran harus lebih dari nol.");
  money(tendered, "Uang diserahkan");
  if (method === "tunai" && tendered < amount)
    throw new Error("Uang tunai kurang.");
  return {
    tendered: method === "tunai" ? tendered : amount,
    change: method === "tunai" ? tendered - amount : 0,
  };
}
export function progress(items: ShoeItem[]) {
  const readyCount = items.filter((i) => i.status >= 4).length;
  return {
    itemCount: items.length,
    readyCount,
    allReady: readyCount === items.length,
    dueAt: Timestamp.fromMillis(
      Math.min(
        ...items.filter((i) => i.status < 4).map((i) => i.dueAt.toMillis()),
        ...items.filter((i) => i.status >= 4).map(() => Date.UTC(2099, 0, 1)),
      ),
    ),
  };
}
export function orderStatus(o: Order) {
  if (o.cancelled) return "Dibatalkan";
  if (o.collected) return "Sudah Diambil";
  if (o.allReady) return "Siap Diambil";
  return `${o.readyCount} dari ${o.itemCount} pasang siap`;
}
export function paymentDelta(p: Pick<Payment, "kind" | "amount">) {
  return p.kind === "payment" ? p.amount : -p.amount;
}
export function canCollect(
  o: Pick<Order, "allReady" | "balance" | "cancelled" | "collected">,
) {
  return o.allReady && o.balance === 0 && !o.cancelled && !o.collected;
}
export function receipt(o: Order, s: Settings) {
  return `${s.name}\n${s.address}\nWA ${s.phone} • ${s.hours}\n\nNOTA ${o.number}\n${dateTime(o.createdAt)}\n${o.customerName} • ${o.customerPhone}\n\n${o.items.map((i, n) => `${n + 1}. ${i.description} (${i.color})\n   ${i.serviceName} — ${rupiah(i.price)}\n   Estimasi: ${dateTime(i.dueAt)}`).join("\n")}\n\nSubtotal: ${rupiah(o.subtotal)}\nDiskon: ${rupiah(o.discount)}\nTotal: ${rupiah(o.total)}\nPembayaran sah bersih: ${rupiah(o.paid)}\nSisa tagihan: ${rupiah(o.balance)}\nStatus: ${orderStatus(o)}\n\n${s.terms}`;
}
export function message(o: Order, s: Settings, ready = false) {
  const vars: Record<string, string> = {
    nama: o.customerName,
    order: o.number,
    estimasi: dateTime(Math.max(...o.items.map((i) => i.dueAt.toMillis()))),
    total: rupiah(o.total),
    sisa: rupiah(o.balance),
    toko: s.name,
  };
  return (ready ? s.readyTemplate : s.receivedTemplate).replace(
    /\{(nama|order|estimasi|total|sisa|toko)\}/g,
    (_, k: string) => vars[k]!,
  );
}
export function csv(rows: (string | number)[][]) {
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}

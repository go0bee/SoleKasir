import type { Timestamp } from "firebase/firestore";
import type { Order, Settings } from "./types";
export interface InvoiceSnapshot {
  store: Pick<Settings, "name" | "address" | "phone" | "hours" | "terms">;
  number: string;
  date: Timestamp;
  customerName: string;
  items: {
    description: string;
    color: string;
    serviceName: string;
    price: number;
    dueAt: Timestamp;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  cancelled: boolean;
  collected: boolean;
}
export interface SharedInvoice {
  token: string;
  storeId: string;
  orderId: string;
  snapshot: InvoiceSnapshot;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  createdBy: string;
}
export function invoiceSnapshot(
  order: Order,
  settings: Settings,
): InvoiceSnapshot {
  const { name, address, phone, hours, terms } = settings;
  return {
    store: { name, address, phone, hours, terms },
    number: order.number,
    date: order.createdAt,
    customerName: order.customerName,
    items: order.items.map(
      ({ description, color, serviceName, price, dueAt }) => ({
        description,
        color,
        serviceName,
        price,
        dueAt,
      }),
    ),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    paid: order.paid,
    balance: order.balance,
    cancelled: order.cancelled,
    collected: order.collected,
  };
}
// Firestore map key ordering is not part of the invoice's meaning.
export function invoiceFingerprint(s: InvoiceSnapshot): string {
  return JSON.stringify([
    [
      s.store.name,
      s.store.address,
      s.store.phone,
      s.store.hours,
      s.store.terms,
    ],
    s.number,
    s.date.toMillis(),
    s.customerName,
    s.items.map((i) => [
      i.description,
      i.color,
      i.serviceName,
      i.price,
      i.dueAt.toMillis(),
    ]),
    s.subtotal,
    s.discount,
    s.total,
    s.paid,
    s.balance,
    s.cancelled,
    s.collected,
  ]);
}

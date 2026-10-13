import type { Timestamp } from "firebase/firestore";
export type Role = "owner" | "kasir";
export interface Membership {
  role: Role;
  name: string;
  active: boolean;
}
export interface Service {
  id: string;
  name: string;
  price: number;
  days: number;
  description: string;
  active: boolean;
}
export interface Customer {
  id: string;
  name: string;
  nameLower: string;
  phone: string;
  notes: string;
  createdAt: Timestamp;
}
export interface ShoeItem {
  id: string;
  description: string;
  color: string;
  material: string;
  size: string;
  condition: string;
  accessories: string;
  serviceId: string;
  serviceName: string;
  price: number;
  notes: string;
  dueAt: Timestamp;
  status: number;
  rack: string;
}
export interface Order {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: ShoeItem[];
  itemCount: number;
  readyCount: number;
  allReady: boolean;
  dueAt: Timestamp;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  cancelled: boolean;
  collected: boolean;
  active: boolean;
  notes: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
  lastEventId: string;
}
export type PaymentKind = "payment" | "refund" | "void";
export type Method = "tunai" | "transfer" | "qris";
export interface Payment {
  id: string;
  orderId: string;
  kind: PaymentKind;
  amount: number;
  method: Method;
  tendered: number;
  change: number;
  reason: string;
  refId: string;
  createdBy: string;
  createdAt: Timestamp;
  orderVersion: number;
}
export interface OrderEvent {
  id: string;
  kind: "create" | "status" | "collect" | "cancel" | PaymentKind;
  reason: string;
  actor: string;
  createdAt: Timestamp;
  beforeVersion: number;
  afterVersion: number;
  paymentId: string;
  itemsBefore: ShoeItem[];
  itemsAfter: ShoeItem[];
}
export interface Settings {
  name: string;
  address: string;
  phone: string;
  hours: string;
  terms: string;
  receivedTemplate: string;
  readyTemplate: string;
  prefix: string;
}
export interface Expense {
  id: string;
  description: string;
  amount: number;
  createdAt: Timestamp;
  createdBy: string;
}
export interface OrderInput {
  customer: Customer;
  items: ShoeItem[];
  discount: number;
  notes: string;
  initialPayment: number;
  method: Method;
  tendered: number;
}
export interface OrderFilters {
  status?: "active" | "ready" | "collected" | "cancelled";
  from?: string;
  to?: string;
  unpaid?: boolean;
  overdue?: boolean;
  customerId?: string;
}
export interface Dashboard {
  todayOrders: number;
  workingPairs: number;
  readyOrders: number;
  overdueOrders: number;
  todayPayments: number;
  activeBalance: number;
  recent: Order[];
}
export interface Report {
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  count: number;
  pairs: number;
  value: number;
  cancelledValue: number;
  receipts: number;
  refunds: number;
  corrections: number;
  net: number;
  balance: number;
  expenseTotal: number;
  cashSurplus: number;
  popular: { name: string; count: number }[];
}

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type {
  Firestore,
  QueryDocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { normalizePhone, defaultSettings, dayRange } from "../domain/business";
import type {
  RegistrationInput,
  SignupRequest,
  Subscription,
} from "../domain/subscriptions";
import type { Page } from "./repository";
export function validateRegistration(
  input: RegistrationInput,
): RegistrationInput {
  const value = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    businessName: input.businessName.trim(),
    address: input.address.trim(),
  };
  if (
    !value.name ||
    value.name.length > 160 ||
    !value.businessName ||
    value.businessName.length > 160 ||
    value.address.length > 500 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) ||
    value.email.length > 254
  )
    throw new Error("Isi nama, email, dan nama usaha dengan lengkap.");
  return value;
}
export function subscriptionEnd(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Tanggal masa aktif tidak valid.");
  const result = Timestamp.fromMillis(dayRange(date).end.toMillis() - 1);
  if (
    result.toMillis() <= Date.now() ||
    result.toMillis() > Date.now() + 366 * 86400000
  )
    throw new Error("Masa aktif harus setelah hari ini dan maksimal 366 hari.");
  return result;
}
export function createSubscriptionOperations(context: {
  db: Firestore;
  uid: string;
  email: string | null;
  phoneNumber?: string | null;
}) {
  const { db, uid, email, phoneNumber } = context,
    appRef = (id: string) => doc(db, `applications/${id}`);
  async function submit(input: RegistrationInput) {
    const value = validateRegistration(input);
    if (email) {
      if (value.email !== email.toLowerCase())
        throw new Error("Email harus sesuai akun yang masuk.");
    } else if (!phoneNumber || value.phone !== normalizePhone(phoneNumber))
      throw new Error("Nomor harus sesuai nomor akun yang telah diverifikasi.");
    await runTransaction(db, async (tx) => {
      const old = await tx.get(appRef(uid));
      if (old.exists()) return;
      tx.set(appRef(uid), {
        ...value,
        status: "pending",
        storeId: "",
        reason: "",
        createdAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: "",
      });
    });
  }
  async function approve(id: string, date: string) {
    const expiresAt = subscriptionEnd(date),
      storeId = `business-${id}`;
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(appRef(id));
      if (!snapshot.exists()) throw new Error("Pendaftaran tidak ditemukan.");
      const request = snapshot.data() as SignupRequest;
      if (request.status === "approved") return;
      if (request.status !== "pending")
        throw new Error("Pendaftaran ini sudah ditinjau.");
      const account = await tx.get(doc(db, `accounts/${id}`));
      if (account.exists())
        throw new Error("Akun sudah terhubung dengan toko.");
      tx.update(appRef(id), {
        status: "approved",
        storeId,
        reason: "",
        reviewedAt: serverTimestamp(),
        reviewedBy: uid,
      });
      tx.set(doc(db, `accounts/${id}`), { storeId });
      tx.set(doc(db, `stores/${storeId}/members/${id}`), {
        role: "owner",
        name: request.name,
        active: true,
      });
      tx.set(doc(db, `stores/${storeId}/settings/general`), {
        ...defaultSettings,
        name: request.businessName,
        address: request.address,
        phone: request.phone,
      });
      tx.set(doc(db, `stores/${storeId}/subscription/access`), {
        status: "active",
        ownerUid: id,
        expiresAt,
        approvedBy: uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reason: "",
      });
    });
  }
  async function reject(id: string, reason: string) {
    if (!reason.trim() || reason.length > 1000)
      throw new Error("Isi alasan penolakan maksimal 1.000 karakter.");
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(appRef(id));
      if (!snapshot.exists() || snapshot.data().status !== "pending")
        throw new Error("Pendaftaran sudah ditinjau atau tidak ditemukan.");
      tx.update(appRef(id), {
        status: "rejected",
        storeId: "",
        reason: reason.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: uid,
      });
    });
  }
  async function set(
    request: SignupRequest,
    date: string,
    status: "active" | "suspended",
    reason: string,
  ) {
    if (request.status !== "approved" || !request.storeId)
      throw new Error("Toko belum disetujui.");
    if (reason.length > 1000 || (status === "suspended" && !reason.trim()))
      throw new Error("Isi alasan penangguhan maksimal 1.000 karakter.");
    const expiresAt = status === "active" ? subscriptionEnd(date) : null,
      target = doc(db, `stores/${request.storeId}/subscription/access`);
    await runTransaction(db, async (tx) => {
      const old = await tx.get(target);
      if (!old.exists()) throw new Error("Langganan tidak ditemukan.");
      tx.update(target, {
        status,
        expiresAt: expiresAt || old.data().expiresAt,
        updatedAt: serverTimestamp(),
        reason: reason.trim(),
      });
    });
  }
  return { submit, approve, reject, set };
}
function operations() {
  if (!navigator.onLine)
    throw new Error("Sambungkan internet terlebih dahulu.");
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk terlebih dahulu.");
  return createSubscriptionOperations({
    db,
    uid: user.uid,
    email: user.email,
    phoneNumber: user.phoneNumber,
  });
}
export const submitApplication = (input: RegistrationInput) =>
  operations().submit(input);
export const approveApplication = (uid: string, date: string) =>
  operations().approve(uid, date);
export const rejectApplication = (uid: string, reason: string) =>
  operations().reject(uid, reason);
export const setSubscription = (
  request: SignupRequest,
  date: string,
  status: "active" | "suspended",
  reason: string,
) => operations().set(request, date, status, reason);
export async function listApplications(
  status?: SignupRequest["status"],
  cursor?: unknown,
): Promise<Page<SignupRequest>> {
  const constraints: QueryConstraint[] = status
    ? [where("status", "==", status)]
    : [];
  const result = await getDocsFromServer(
    query(
      collection(db, "applications"),
      ...constraints,
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor as QueryDocumentSnapshot)] : []),
      limit(25),
    ),
  );
  return {
    rows: result.docs.map((d) => ({ uid: d.id, ...d.data() }) as SignupRequest),
    cursor: result.docs.at(-1),
    hasMore: result.size === 25,
  };
}
export async function getApplicationSubscription(
  request: SignupRequest,
): Promise<Subscription | null> {
  if (!request.storeId) return null;
  const result = await getDocFromServer(
    doc(db, `stores/${request.storeId}/subscription/access`),
  );
  return result.exists() ? (result.data() as Subscription) : null;
}

import { auth, db, storeId } from "../lib/firebase";
import { useSession } from "../stores/session";
import {
  createInvoiceOperations,
  readSharedInvoice,
} from "./invoice-operations";
function operations() {
  const session = useSession();
  if (!navigator.onLine)
    throw new Error("Sambungkan internet terlebih dahulu.");
  if (!auth.currentUser || !session.accessValid)
    throw new Error("Akses toko belum aktif.");
  return createInvoiceOperations({ db, storeId, uid: auth.currentUser.uid });
}
export const publishInvoice = (orderId: string) =>
  operations().publish(orderId);
export const getInvoiceLink = (orderId: string) =>
  operations().getLink(orderId);
export const revokeInvoice = (orderId: string) => operations().revoke(orderId);
export const getSharedInvoice = (token: string) => readSharedInvoice(db, token);

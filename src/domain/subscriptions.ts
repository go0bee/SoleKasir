import type { Timestamp } from "firebase/firestore";
export interface RegistrationInput {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  address: string;
}
export interface SignupRequest extends RegistrationInput {
  uid: string;
  status: "pending" | "approved" | "rejected";
  storeId: string;
  reason: string;
  createdAt: Timestamp;
  reviewedAt: Timestamp | null;
  reviewedBy: string;
}
export interface Subscription {
  status: "active" | "suspended";
  ownerUid: string;
  expiresAt: Timestamp;
  approvedBy: string;
  approvedAt: Timestamp;
  updatedAt: Timestamp;
  reason: string;
}

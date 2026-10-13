import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  memoryLocalCache,
} from "firebase/firestore";
const env = import.meta.env;
export const emulator = env.VITE_USE_EMULATORS === "true";
export const configured =
  emulator ||
  !!(
    env.FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID
  );
export const defaultStoreId = env.VITE_STORE_ID || "main";
export let storeId = defaultStoreId;
export function setStoreId(value: string) {
  storeId = value;
}
const app = initializeApp({
  apiKey: env.FIREBASE_API_KEY || "demo-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "demo-solekasir.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "demo-solekasir",
  appId: env.VITE_FIREBASE_APP_ID || "demo-app",
});
export const auth = getAuth(app);
auth.languageCode = "id";
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
if (emulator) {
  const host = env.VITE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8181);
}

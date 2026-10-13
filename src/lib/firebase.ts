import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  memoryLocalCache,
} from "firebase/firestore";
import {
  missingFirebaseVariables,
  resolveFirebaseWebConfig,
  usesFirebaseEmulators,
} from "./firebase-config";
import type { FirebaseWebConfig } from "./firebase-config";

declare const __SOLEKASIR_FIREBASE_CONFIG__: FirebaseWebConfig;
const env = import.meta.env;
const config =
  typeof __SOLEKASIR_FIREBASE_CONFIG__ !== "undefined"
    ? __SOLEKASIR_FIREBASE_CONFIG__
    : resolveFirebaseWebConfig(env);
export const emulator = usesFirebaseEmulators(env);
export const configured =
  emulator || missingFirebaseVariables(config).length === 0;
export const defaultStoreId = env.VITE_STORE_ID || "main";
export let storeId = defaultStoreId;
export function setStoreId(value: string) {
  storeId = value;
}
const app = initializeApp({
  apiKey: config.apiKey || "demo-key",
  authDomain: config.authDomain || "demo-solekasir.firebaseapp.com",
  projectId: config.projectId || "demo-solekasir",
  appId: config.appId || "demo-app",
});
export const auth = getAuth(app);
auth.languageCode = "id";
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
if (emulator) {
  const host = env.VITE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8181);
}

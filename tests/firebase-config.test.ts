import { expect, it } from "vitest";
import {
  missingFirebaseVariables,
  resolveFirebaseWebConfig,
  usesFirebaseEmulators,
  validateFirebaseBuild,
} from "../src/lib/firebase-config";

const canonical = {
  VITE_FIREBASE_API_KEY: "public-web-key",
  VITE_FIREBASE_AUTH_DOMAIN: "store.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "store",
  VITE_FIREBASE_APP_ID: "web-app",
};

it("supports the existing unprefixed Vercel API key with VITE variables", () => {
  const { VITE_FIREBASE_API_KEY, ...others } = canonical;
  const env = { ...others, FIREBASE_API_KEY: VITE_FIREBASE_API_KEY };
  expect(resolveFirebaseWebConfig(env).apiKey).toBe("public-web-key");
  expect(() => validateFirebaseBuild(env)).not.toThrow();
});

it("supports all four public aliases and gives nonempty VITE values priority", () => {
  const aliases = Object.fromEntries(Object.entries(canonical).map(([key, value]) => [key.replace(/^VITE_/, ""), value]));
  expect(resolveFirebaseWebConfig(aliases)).toEqual(resolveFirebaseWebConfig(canonical));
  expect(resolveFirebaseWebConfig({ ...aliases, VITE_FIREBASE_API_KEY: " preferred " }).apiKey).toBe("preferred");
  expect(resolveFirebaseWebConfig({ ...aliases, VITE_FIREBASE_API_KEY: " " }).apiKey).toBe("public-web-key");
});

it("embeds only public web configuration, never unrelated server credentials", () => {
  const config = resolveFirebaseWebConfig({ ...canonical, FIREBASE_PRIVATE_KEY: "server-secret", ADMIN_TOKEN: "another-secret" });
  expect(Object.keys(config).sort()).toEqual(["apiKey", "appId", "authDomain", "projectId"]);
  expect(JSON.stringify(config)).not.toContain("secret");
});

it("rejects missing production configuration using variable names only", () => {
  const env = { ...canonical, VITE_FIREBASE_AUTH_DOMAIN: "  " };
  expect(missingFirebaseVariables(resolveFirebaseWebConfig(env))).toEqual(["VITE_FIREBASE_AUTH_DOMAIN"]);
  expect(() => validateFirebaseBuild(env)).toThrow("VITE_FIREBASE_AUTH_DOMAIN");
  try { validateFirebaseBuild(env); } catch (error) {
    expect(String(error)).not.toContain("public-web-key");
  }
});

it("false or missing emulator flag uses real Firebase; only true enables local emulators", () => {
  expect(usesFirebaseEmulators({})).toBe(false);
  expect(usesFirebaseEmulators({ VITE_USE_EMULATORS: "false" })).toBe(false);
  expect(usesFirebaseEmulators({ VITE_USE_EMULATORS: "true" })).toBe(true);
  expect(() => validateFirebaseBuild({})).toThrow("VITE_FIREBASE_API_KEY");
  expect(() => validateFirebaseBuild({ VITE_USE_EMULATORS: "true" })).not.toThrow();
});

it("rejects emulator deployments on Vercel", () => {
  expect(() => validateFirebaseBuild({ ...canonical, VERCEL: "1", VITE_USE_EMULATORS: "true" })).toThrow("VITE_USE_EMULATORS=false");
  expect(() => validateFirebaseBuild({ ...canonical, VERCEL: "1", VITE_USE_EMULATORS: "false" })).not.toThrow();
});

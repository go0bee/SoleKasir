type Environment = Readonly<Record<string, string | boolean | undefined>>;

// Only the public Firebase Web App configuration is embedded in the browser.
const publicFields = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  appId: "VITE_FIREBASE_APP_ID",
} as const;

export type FirebaseWebConfig = Record<keyof typeof publicFields, string>;

export function resolveFirebaseWebConfig(env: Environment): FirebaseWebConfig {
  const value = (name: string) =>
    typeof env[name] === "string" ? (env[name] as string).trim() : "";
  return Object.fromEntries(
    Object.entries(publicFields).map(([field, name]) => [
      field,
      value(name) || value(name.replace(/^VITE_/, "")),
    ]),
  ) as FirebaseWebConfig;
}

export function missingFirebaseVariables(config: FirebaseWebConfig): string[] {
  return (Object.keys(publicFields) as (keyof FirebaseWebConfig)[])
    .filter((field) => !config[field])
    .map((field) => publicFields[field]);
}

export function usesFirebaseEmulators(env: Environment): boolean {
  return env.VITE_USE_EMULATORS === "true";
}

export function validateFirebaseBuild(env: Environment): void {
  if (usesFirebaseEmulators(env)) {
    if (env.VERCEL === "1") {
      throw new Error(
        "Deployment Vercel harus memakai VITE_USE_EMULATORS=false.",
      );
    }
    return;
  }
  const missing = missingFirebaseVariables(resolveFirebaseWebConfig(env));
  if (missing.length) {
    throw new Error(
      `Konfigurasi Firebase belum lengkap: ${missing.join(", ")}. ` +
        "Isi environment untuk deployment tujuan (Production/Preview di Vercel), lalu build ulang. " +
        "Nama FIREBASE_* tanpa awalan VITE_ juga didukung untuk empat konfigurasi web ini.",
    );
  }
}

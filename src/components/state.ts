import { ref, inject, type InjectionKey, type Ref } from "vue";
import { defaultSettings } from "../domain/business";
import type { Settings } from "../domain/types";
export const settingsKey: InjectionKey<Ref<Settings>> = Symbol("settings");
export const reloadSettingsKey: InjectionKey<() => Promise<void>> =
  Symbol("reloadSettings");
export function useSettings() {
  return inject(settingsKey, ref({ ...defaultSettings }));
}
export function errorText(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Terjadi kesalahan. Silakan coba lagi.";
}
export function useTask() {
  const busy = ref(false),
    error = ref(""),
    success = ref("");
  async function run<T>(
    job: () => Promise<T>,
    done = "",
  ): Promise<T | undefined> {
    if (busy.value) return undefined;
    busy.value = true;
    error.value = "";
    success.value = "";
    try {
      const value = await job();
      success.value = done;
      return value;
    } catch (e) {
      error.value = errorText(e);
      return undefined;
    } finally {
      busy.value = false;
    }
  }
  return { busy, error, success, run };
}
export function downloadCsv(contents: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

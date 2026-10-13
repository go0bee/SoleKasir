<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from "vue";
import { Smartphone, ArrowRight, CheckCircle2 } from "lucide-vue-next";
import { useSession } from "../stores/session";
import { configured } from "../lib/firebase";
import { authErrorText, type PhoneChallenge } from "../lib/auth-methods";

const props = withDefaults(
  defineProps<{ mode?: "login" | "link"; disabled?: boolean }>(),
  { mode: "login", disabled: false },
);
const emit = defineEmits<{
  authenticated: [];
  "busy-change": [busy: boolean];
}>();
const session = useSession();
const phoneOpen = ref(false),
  phone = ref(""),
  code = ref(""),
  busy = ref(false);
const error = ref(""),
  success = ref(""),
  captchaContainer = ref<HTMLElement | null>(null),
  codeInput = ref<HTMLInputElement | null>(null);
const challenge = shallowRef<PhoneChallenge | null>(null),
  countdown = ref(0);
const linkedGoogle = computed(
  () =>
    props.mode === "link" &&
    session.user?.providerData.some(
      (provider) => provider.providerId === "google.com",
    ),
);
const linkedPhone = computed(
  () =>
    props.mode === "link" &&
    session.user?.providerData.some(
      (provider) => provider.providerId === "phone",
    ),
);
const unavailable = computed(
  () =>
    busy.value ||
    props.disabled ||
    session.loading ||
    !session.online ||
    !configured,
);
let timer: ReturnType<typeof setInterval> | undefined;
let mounted = true;
function setBusy(value: boolean) {
  busy.value = value;
  emit("busy-change", value);
}
function clearChallenge() {
  challenge.value?.dispose();
  challenge.value = null;
  code.value = "";
  if (timer) clearInterval(timer);
  timer = undefined;
  countdown.value = 0;
}
function resetPhone() {
  if (busy.value) return;
  clearChallenge();
  error.value = "";
  phoneOpen.value = false;
}
function editPhone() {
  if (busy.value) return;
  clearChallenge();
  error.value = "";
}
function startCountdown() {
  if (timer) clearInterval(timer);
  countdown.value = 30;
  timer = setInterval(() => {
    countdown.value = Math.max(0, countdown.value - 1);
    if (!countdown.value && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }, 1000);
}
async function google() {
  if (unavailable.value) return;
  error.value = "";
  success.value = "";
  setBusy(true);
  try {
    if (props.mode === "link") {
      await session.linkGoogle();
      success.value =
        "Google berhasil dihubungkan. Anda bisa memakai Google untuk masuk ke akun ini.";
    } else {
      await session.loginGoogle();
      emit("authenticated");
    }
  } catch (e) {
    error.value = authErrorText(e);
  } finally {
    setBusy(false);
  }
}
async function sendCode() {
  if (unavailable.value || countdown.value > 0) return;
  error.value = "";
  success.value = "";
  setBusy(true);
  try {
    challenge.value?.dispose();
    challenge.value = null;
    code.value = "";
    await nextTick();
    if (!captchaContainer.value)
      throw new Error(
        "Form verifikasi belum siap. Buka kembali nomor telepon.",
      );
    const result = await session.startPhoneVerification(
      phone.value.trim(),
      captchaContainer.value,
      props.mode,
    );
    if (!mounted) {
      result.dispose();
      return;
    }
    challenge.value = result;
    startCountdown();
  } catch (e) {
    error.value = authErrorText(e);
  } finally {
    setBusy(false);
    if (mounted && challenge.value) {
      await nextTick();
      codeInput.value?.focus();
    }
  }
}
async function confirmCode() {
  if (unavailable.value || !challenge.value) return;
  error.value = "";
  setBusy(true);
  try {
    await challenge.value.confirm(code.value.trim());
    clearChallenge();
    phoneOpen.value = false;
    if (props.mode === "link")
      success.value =
        "Nomor berhasil dihubungkan. Gunakan nomor ini untuk masuk ke akun Anda.";
    else emit("authenticated");
  } catch (e) {
    error.value = authErrorText(e);
  } finally {
    setBusy(false);
  }
}
onBeforeUnmount(() => {
  mounted = false;
  clearChallenge();
});
</script>
<template>
  <section
    class="auth-methods"
    :aria-label="
      mode === 'link' ? 'Hubungkan metode masuk' : 'Pilihan metode masuk'
    "
  >
    <div class="auth-provider-buttons">
      <button
        v-if="!linkedGoogle"
        type="button"
        class="button secondary full google-button"
        :disabled="unavailable"
        @click="google"
      >
        <span class="google-symbol" aria-hidden="true">G</span
        >{{ mode === "link" ? "Hubungkan Google" : "Lanjutkan dengan Google" }}
      </button>
      <button
        v-if="!linkedPhone && !phoneOpen"
        type="button"
        class="button secondary full"
        :disabled="unavailable"
        @click="
          phoneOpen = true;
          error = '';
          success = '';
        "
      >
        <Smartphone :size="19" />{{
          mode === "link"
            ? "Hubungkan nomor telepon"
            : "Masuk dengan nomor telepon"
        }}
      </button>
    </div>
    <div v-if="phoneOpen" class="phone-auth-panel">
      <div class="phone-auth-heading">
        <h3>
          {{
            mode === "link"
              ? "Hubungkan nomor ke akun ini"
              : "Masuk dengan nomor telepon"
          }}
        </h3>
        <button
          type="button"
          class="text-link"
          :disabled="busy"
          @click="resetPhone"
        >
          Batal
        </button>
      </div>
      <form
        v-if="!challenge"
        class="phone-auth-form"
        @submit.prevent="sendCode"
      >
        <label
          >Nomor telepon<input
            v-model="phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            required
            maxlength="20"
            placeholder="08xxxxxxxxxx"
            :disabled="busy"
        /></label>
        <p class="field-help">
          Kode verifikasi dikirim melalui SMS. Nomor dapat diproses oleh Google
          untuk mencegah penyalahgunaan.
        </p>
        <button type="submit" class="button full" :disabled="unavailable">
          {{ busy ? "Menyiapkan verifikasi…" : "Kirim kode SMS"
          }}<ArrowRight :size="17" />
        </button>
      </form>
      <form v-else class="phone-auth-form" @submit.prevent="confirmCode">
        <p class="phone-code-destination">
          Kode dikirim ke <strong>{{ challenge.phone }}</strong
          >.
        </p>
        <label
          >Kode verifikasi<input
            ref="codeInput"
            v-model="code"
            class="otp-input"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            minlength="6"
            maxlength="6"
            placeholder="6 digit dari SMS"
            required
            :disabled="busy"
        /></label>
        <button
          type="submit"
          class="button full"
          :disabled="unavailable || !/^[0-9]{6}$/.test(code)"
        >
          {{
            busy
              ? "Memeriksa kode…"
              : mode === "link"
                ? "Verifikasi dan hubungkan"
                : "Verifikasi dan masuk"
          }}<ArrowRight :size="17" />
        </button>
        <div class="phone-code-actions">
          <button
            type="button"
            class="text-link"
            :disabled="unavailable || countdown > 0"
            @click="sendCode"
          >
            {{
              countdown > 0
                ? `Kirim ulang dalam ${countdown} dtk`
                : "Kirim ulang kode"
            }}</button
          ><button
            type="button"
            class="text-link"
            :disabled="busy"
            @click="editPhone"
          >
            Ubah nomor
          </button>
        </div>
      </form>
      <div
        ref="captchaContainer"
        class="auth-captcha"
        aria-label="Verifikasi keamanan nomor telepon"
      ></div>
    </div>
    <p v-if="error || session.redirectError" class="form-error" role="alert">
      {{ error || session.redirectError }}
    </p>
    <p v-if="success" class="success-message auth-link-success" role="status">
      <CheckCircle2 :size="18" />{{ success }}
    </p>
    <p v-if="busy && !phoneOpen" class="field-help" role="status">
      {{ mode === "link" ? "Menghubungkan metode masuk…" : "Memeriksa akun…" }}
    </p>
  </section>
</template>

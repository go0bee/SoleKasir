<script setup lang="ts">
import { ref, inject, onMounted } from "vue";
import { Save, Store, MessageCircle, ClipboardList } from "lucide-vue-next";
import { getSettings, saveSettings } from "../data/repository";
import { defaultSettings, normalizePhone } from "../domain/business";
import { useSession } from "../stores/session";
import { useTask, reloadSettingsKey } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
const session = useSession(),
  form = ref({ ...defaultSettings }),
  task = useTask(),
  saveTask = useTask(),
  reload = inject(reloadSettingsKey);
async function load() {
  await task.run(async () => {
    form.value = await getSettings();
  });
}
async function save() {
  const result = await saveTask.run(async () => {
    await saveSettings({
      ...form.value,
      phone: normalizePhone(form.value.phone),
      prefix: form.value.prefix.toUpperCase(),
    });
    return true;
  }, "Pengaturan toko berhasil disimpan.");
  if (result && reload) await reload();
}
onMounted(load);
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">TOKO ANDA, CARA ANDA</span>
      <h1>Pengaturan toko</h1>
      <p>Identitas, ketentuan, dan pesan untuk pelanggan.</p>
    </div>
  </section>
  <AsyncState :loading="task.busy.value" :error="task.error.value" @retry="load"
    ><form class="settings-form" @submit.prevent="save">
      <section class="panel form-panel">
        <div class="step-heading">
          <Store :size="24" />
          <div>
            <h2>Identitas toko</h2>
            <p>Tampil pada nota dan pesan WhatsApp.</p>
          </div>
        </div>
        <div class="form-grid">
          <label
            >Nama toko<input
              v-model="form.name"
              required
              maxlength="100" /></label
          ><label
            >WhatsApp toko<input
              v-model="form.phone"
              required
              inputmode="tel"
              placeholder="081234567890" /></label
          ><label class="span-2"
            >Alamat<textarea
              v-model="form.address"
              maxlength="1000"
              required
            /></label
          ><label
            >Jam operasional<input
              v-model="form.hours"
              maxlength="200"
              placeholder="09.00–18.00 WIB" /></label
          ><label
            >Prefix nomor order<input
              v-model="form.prefix"
              maxlength="6"
              pattern="[A-Za-z0-9]{2,6}"
              required
            /><small class="field-help"
              >2–6 huruf kapital/angka. Berlaku untuk order baru.</small
            ></label
          >
        </div>
      </section>
      <section class="panel form-panel">
        <div class="step-heading">
          <ClipboardList :size="24" />
          <div>
            <h2>Ketentuan layanan</h2>
            <p>Informasi penting yang tercetak di nota.</p>
          </div>
        </div>
        <label
          >Ketentuan<textarea
            v-model="form.terms"
            rows="5"
            maxlength="3000"
            required
          />
        </label>
      </section>
      <section class="panel form-panel">
        <div class="step-heading">
          <MessageCircle :size="24" />
          <div>
            <h2>Template WhatsApp</h2>
            <p>Pesan dibuka untuk dikirim secara manual.</p>
          </div>
        </div>
        <div class="template-help">
          Gunakan variabel: <code>{nama}</code> <code>{order}</code>
          <code>{estimasi}</code> <code>{total}</code> <code>{sisa}</code>
          <code>{toko}</code>
        </div>
        <label
          >Pesan order diterima<textarea
            v-model="form.receivedTemplate"
            rows="4"
            maxlength="3000"
            required
          /></label
        ><label
          >Pesan siap diambil<textarea
            v-model="form.readyTemplate"
            rows="4"
            maxlength="3000"
            required
          />
        </label>
      </section>
      <p v-if="saveTask.error.value" class="form-error" role="alert">
        {{ saveTask.error.value }}
      </p>
      <p v-if="saveTask.success.value" class="success-message" role="status">
        {{ saveTask.success.value }}
      </p>
      <div class="form-actions">
        <button
          class="button"
          :disabled="saveTask.busy.value || !session.online"
        >
          <Save :size="18" />{{
            saveTask.busy.value ? "Menyimpan…" : "Simpan pengaturan"
          }}
        </button>
      </div>
    </form></AsyncState
  >
</template>

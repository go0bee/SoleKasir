<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { Plus, Pencil, Layers, Clock3 } from "lucide-vue-next";
import { listServices, saveService } from "../data/repository";
import type { Service } from "../domain/types";
import { rupiah } from "../domain/business";
import { useSession } from "../stores/session";
import { useTask } from "../components/state";
import AsyncState from "../components/AsyncState.vue";
const session = useSession(),
  rows = ref<Service[]>([]),
  editing = ref(false),
  id = ref<string>(),
  form = reactive({
    name: "",
    price: 0,
    days: 3,
    description: "",
    active: true,
  }),
  task = useTask(),
  saveTask = useTask();
async function load() {
  await task.run(async () => {
    rows.value = await listServices();
  });
}
function edit(service?: Service) {
  id.value = service?.id;
  Object.assign(form, {
    name: service?.name || "",
    price: service?.price || 0,
    days: service?.days || 3,
    description: service?.description || "",
    active: service?.active ?? true,
  });
  editing.value = true;
  saveTask.error.value = "";
  saveTask.success.value = "";
}
async function save() {
  const result = await saveTask.run(
    async () => saveService({ ...form, name: form.name.trim() }, id.value),
    "Layanan berhasil disimpan.",
  );
  if (result) {
    editing.value = false;
    await load();
  }
}
onMounted(load);
</script>
<template>
  <section class="page-heading">
    <div>
      <span class="eyebrow">PERAWATAN TERBAIK, HARGA JELAS</span>
      <h1>Layanan</h1>
      <p>Atur pilihan perawatan dan estimasi pengerjaan.</p>
    </div>
    <button class="button" :disabled="!session.online" @click="edit()">
      <Plus :size="18" />Tambah layanan
    </button>
  </section>
  <p v-if="saveTask.success.value" class="success-message">
    {{ saveTask.success.value }}
  </p>
  <section v-if="editing" class="panel form-panel">
    <div class="panel-heading">
      <h2>{{ id ? "Edit layanan" : "Layanan baru" }}</h2>
      <button
        class="button quiet"
        :disabled="saveTask.busy.value"
        @click="editing = false"
      >
        Tutup
      </button>
    </div>
    <form @submit.prevent="save">
      <div class="form-grid">
        <label class="span-2"
          >Nama layanan<input
            v-model="form.name"
            maxlength="100"
            required
            placeholder="Contoh: Deep clean" /></label
        ><label
          >Harga per pasang (Rp)<input
            v-model.number="form.price"
            type="number"
            min="0"
            max="100000000"
            step="1"
            inputmode="numeric"
            required /></label
        ><label
          >Estimasi pengerjaan (hari)<input
            v-model.number="form.days"
            type="number"
            min="1"
            max="60"
            step="1"
            inputmode="numeric"
            required /></label
        ><label class="span-2"
          >Deskripsi<textarea
            v-model="form.description"
            maxlength="1000"
            placeholder="Apa yang termasuk dalam layanan ini?"
          /></label
        ><label class="check-label span-2"
          ><input v-model="form.active" type="checkbox" />Layanan aktif dan
          dapat dipilih di order baru</label
        >
      </div>
      <p class="field-help">
        Perubahan harga berlaku untuk order baru. Snapshot harga order lama
        tetap tersimpan.
      </p>
      <p v-if="saveTask.error.value" class="form-error" role="alert">
        {{ saveTask.error.value }}
      </p>
      <div class="form-actions">
        <button
          type="button"
          class="button secondary"
          :disabled="saveTask.busy.value"
          @click="editing = false"
        >
          Batal</button
        ><button
          class="button"
          :disabled="saveTask.busy.value || !session.online"
        >
          {{ saveTask.busy.value ? "Menyimpan…" : "Simpan layanan" }}
        </button>
      </div>
    </form>
  </section>
  <AsyncState
    :loading="task.busy.value"
    :error="task.error.value"
    :empty="!rows.length"
    empty-title="Mulai dari layanan pertama"
    empty-text="Tambahkan layanan, harga, dan estimasinya agar pelanggan dapat membuat order."
    @retry="load"
    ><section class="panel service-list">
      <article v-for="service in rows" :key="service.id" class="service-row">
        <span class="service-symbol"><Layers :size="23" /></span>
        <div class="service-copy">
          <h2>
            {{ service.name
            }}<span
              class="badge"
              :class="service.active ? 'green' : 'neutral'"
              >{{ service.active ? "Aktif" : "Nonaktif" }}</span
            >
          </h2>
          <p>{{ service.description || "Belum ada deskripsi layanan." }}</p>
          <small><Clock3 :size="14" />{{ service.days }} hari pengerjaan</small>
        </div>
        <strong class="service-price"
          >{{ rupiah(service.price) }}<small>/ pasang</small></strong
        ><button
          class="button secondary"
          :disabled="!session.online"
          @click="edit(service)"
        >
          <Pencil :size="16" />Edit
        </button>
      </article>
    </section></AsyncState
  >
</template>

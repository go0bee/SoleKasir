<script setup lang="ts">
import { LoaderCircle, AlertCircle, Inbox } from "lucide-vue-next";
defineProps<{
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyText?: string;
}>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="state-block" role="status">
    <LoaderCircle class="spin" :size="28" /><strong>Memuat data toko…</strong
    ><span>Sebentar, kami mengambil data terbaru.</span>
  </div>
  <div v-else-if="error" class="state-block error-state" role="alert">
    <AlertCircle :size="28" /><strong>Data belum dapat dimuat</strong
    ><span>{{ error }}</span
    ><button class="button secondary" @click="$emit('retry')">Coba lagi</button>
  </div>
  <div v-else-if="empty" class="state-block">
    <span class="empty-icon"><Inbox :size="28" /></span
    ><strong>{{ emptyTitle || "Belum ada data" }}</strong
    ><span>{{ emptyText || "Data yang ditambahkan akan muncul di sini." }}</span
    ><slot name="action" />
  </div>
  <slot v-else />
</template>

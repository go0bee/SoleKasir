<script setup lang="ts">
import { ref, provide, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { House, ClipboardList, Plus, Users, Menu, Footprints, ChartNoAxesCombined, SlidersHorizontal, Layers, WifiOff, ShieldCheck } from 'lucide-vue-next'
import { useSession } from './stores/session'
import { defaultSettings, dateTime } from './domain/business'
import { getSettings } from './data/repository'
import { settingsKey, reloadSettingsKey } from './components/state'
const session = useSession(), route = useRoute(), router = useRouter(), settings = ref({ ...defaultSettings })
const settingsError = ref('')
let settingsGeneration = 0
async function reloadSettings() { const generation = ++settingsGeneration; try { const value = await getSettings(); if (generation === settingsGeneration) { settings.value = value; settingsError.value = '' } } catch { if (generation === settingsGeneration) settingsError.value = 'Identitas toko belum dapat dimuat. Coba muat ulang halaman.' } }
provide(settingsKey, settings); provide(reloadSettingsKey, reloadSettings)
watch(() => [session.user?.uid, session.activeStoreId, session.accessState], () => { settingsGeneration++; settings.value = { ...defaultSettings }; settingsError.value = ''; if (session.member && session.accessState === 'active') void reloadSettings() }, { immediate: true })
const standalone = computed(() => route.meta.public || route.meta.account || (route.meta.admin && session.platformAdmin && (!session.member || session.accessState !== 'active')))
const routeReady = ref(false)
void router.isReady().then(() => { routeReady.value = true })
watch(() => [routeReady.value, session.loading, session.accessState, session.user?.uid, route.path], () => {
 if (!routeReady.value || !route.matched.length) return
 if (!session.loading && !route.meta.public && !route.meta.account && !route.meta.admin && (!session.user || !session.member || session.accessState !== 'active')) void router.replace(session.user ? '/pending' : '/login')
 if (!session.loading && route.meta.admin && !session.platformAdmin) void router.replace(session.user ? '/pending' : '/login')
})
const navigation = [ {to:'/',label:'Beranda',icon:House}, {to:'/orders',label:'Order',icon:ClipboardList}, {to:'/orders/new',label:'Buat Order',icon:Plus}, {to:'/customers',label:'Pelanggan',icon:Users}, {to:'/more',label:'Lainnya',icon:Menu} ]
const initials = computed(() => (session.member?.name || session.user?.email || 'S').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase())
function active(to: string) { return to === '/' ? route.path === '/' : to === '/orders' ? route.path.startsWith('/orders') && route.path !== '/orders/new' : route.path.startsWith(to) }
</script>
<template>
 <RouterView v-if="standalone" :key="route.fullPath + session.activeStoreId" />
 <div v-else-if="session.member && session.accessState === 'active'" class="app-shell">
  <aside class="sidebar no-print">
   <RouterLink to="/" class="brand"><span class="brand-mark"><Footprints :size="25" /></span><span>{{ settings.name }}<small>Rapi sepatu, rapi usaha.</small></span></RouterLink>
   <span class="nav-label">RUANG KERJA</span>
   <nav aria-label="Navigasi utama"><RouterLink v-for="nav in navigation" :key="nav.to" :to="nav.to" :class="{active:active(nav.to), 'new-nav':nav.to==='/orders/new'}"><component :is="nav.icon" :size="20" />{{ nav.label }}</RouterLink></nav>
   <template v-if="session.owner"><span class="nav-label manage-label">KELOLA TOKO</span><nav aria-label="Pengelolaan toko"><RouterLink to="/reports" :class="{active:route.path==='/reports'}"><ChartNoAxesCombined :size="20" />Laporan</RouterLink><RouterLink to="/services" :class="{active:route.path==='/services'}"><Layers :size="20" />Layanan</RouterLink><RouterLink to="/settings" :class="{active:route.path==='/settings'}"><SlidersHorizontal :size="20" />Pengaturan</RouterLink></nav></template>
   <nav v-if="session.platformAdmin" class="platform-nav" aria-label="Administrasi platform"><RouterLink to="/admin/subscriptions" :class="{active:route.meta.admin}"><ShieldCheck :size="20" />Persetujuan langganan</RouterLink></nav>
   <div class="sidebar-note"><span class="tiny-label">SATU LANGKAH LEBIH RAPI</span><p>Semua sepatu dan transaksi,<br />dalam satu tempat.</p><Footprints :size="32" /></div>
   <div class="sidebar-account"><span class="avatar">{{ initials }}</span><span><strong>{{ session.member?.name || 'Tim toko' }}</strong><small>{{ session.owner ? 'Pemilik toko' : 'Kasir' }}</small></span></div>
  </aside>
  <div class="workspace">
   <header class="topbar no-print"><div class="breadcrumb"><span class="desktop-only">Ruang kerja <span class="slash">/</span></span><strong>{{ route.meta.title }}</strong></div><div class="topbar-right"><span class="connection" :class="{'offline':!session.online}"><i />{{ session.online ? 'Terhubung' : 'Offline' }}</span><span class="today desktop-only">{{ dateTime(Date.now()).split(',')[0] }}</span><span class="avatar small">{{ initials }}</span></div></header>
   <div v-if="!session.online" class="offline-banner no-print" role="alert"><WifiOff :size="19" /><span>Koneksi terputus. Order, pembayaran, dan perubahan hanya dapat disimpan saat online.</span></div>
   <div v-if="settingsError" class="notice no-print">{{ settingsError }}</div>
   <main id="main" class="main-content"><RouterView :key="route.fullPath + session.activeStoreId" /></main>
   <footer class="workspace-footer no-print"><span>{{ settings.name }} <span class="dot">·</span> Dibuat untuk langkah yang lebih baik.</span><span>Asia/Jakarta</span></footer>
  </div>
  <nav class="mobile-nav no-print" aria-label="Navigasi utama mobile"><RouterLink v-for="nav in navigation" :key="nav.to" :to="nav.to" :class="{active:active(nav.to), 'mobile-create':nav.to==='/orders/new'}"><span><component :is="nav.icon" :size="21" /></span><small>{{ nav.label }}</small></RouterLink></nav>
 </div>
 <main v-else class="state-block" role="status"><strong>Memeriksa akses ruang kerja…</strong></main>
</template>

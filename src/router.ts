import { createRouter, createWebHistory } from 'vue-router'
import { useSession } from './stores/session'
const DashboardView = () => import('./features/DashboardView.vue')
const OrdersView = () => import('./features/OrdersView.vue')
const NewOrderView = () => import('./features/NewOrderView.vue')
const OrderDetailView = () => import('./features/OrderDetailView.vue')
const CustomersView = () => import('./features/CustomersView.vue')
const MoreView = () => import('./features/MoreView.vue')
const ServicesView = () => import('./features/ServicesView.vue')
const SettingsView = () => import('./features/SettingsView.vue')
const ReportsView = () => import('./features/ReportsView.vue')
import LoginView from './features/LoginView.vue'

const router = createRouter({
 history: createWebHistory(),
 scrollBehavior: () => ({ top: 0 }),
 routes: [
  { path: '/login', component: LoginView, meta: { title: 'Masuk', public: true } },
  { path: '/signup', component: () => import('./features/SignupView.vue'), meta: { title: 'Daftar usaha', public: true } },
  { path: '/invoice/:token', component: () => import('./features/PublicInvoiceView.vue'), meta: { title: 'Invoice', public: true } },
  { path: '/pending', component: () => import('./features/PendingView.vue'), meta: { title: 'Status langganan', account: true } },
  { path: '/admin/subscriptions', component: () => import('./features/SubscriptionAdminView.vue'), meta: { title: 'Persetujuan langganan', admin: true } },
  { path: '/', component: DashboardView, meta: { title: 'Beranda' } },
  { path: '/orders', component: OrdersView, meta: { title: 'Order' } },
  { path: '/orders/new', component: NewOrderView, meta: { title: 'Buat order' } },
  { path: '/orders/:id', component: OrderDetailView, meta: { title: 'Detail order' } },
  { path: '/customers', component: CustomersView, meta: { title: 'Pelanggan' } },
  { path: '/customers/:id', component: CustomersView, meta: { title: 'Detail pelanggan' } },
  { path: '/more', component: MoreView, meta: { title: 'Lainnya' } },
  { path: '/services', component: ServicesView, meta: { title: 'Layanan', owner: true } },
  { path: '/settings', component: SettingsView, meta: { title: 'Pengaturan toko', owner: true } },
  { path: '/reports', component: ReportsView, meta: { title: 'Laporan', owner: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
 ],
})
router.beforeEach(async to => {
 const session = useSession()
 await session.ready
 if (to.path.startsWith('/invoice/')) return
 if (to.meta.public) {
  if (session.user) return session.member && session.accessState === 'active' ? '/' : session.platformAdmin ? '/admin/subscriptions' : '/pending'
  return
 }
 if (!session.user) return '/login'
 if (to.meta.admin) return session.platformAdmin ? true : '/pending'
 if (to.meta.account) return
 if (!session.member || session.accessState !== 'active') return session.platformAdmin ? '/admin/subscriptions' : '/pending'
 if (to.meta.owner && !session.owner) return '/more'
})
export default router


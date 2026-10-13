# SoleKasir

Kasir cuci sepatu dengan satu outlet per usaha dan pendaftaran langganan manual, bahasa Indonesia, rupiah integer, zona waktu Asia/Jakarta. Vue 3 Composition API + TypeScript + Vite, Tailwind, Router, Pinia, Firebase email/password, Firestore Standard, Firebase Hosting, PWA. Data persisten utama **hanya Firestore**. Tidak memakai server/VPS, Functions, Storage, App Hosting atau gateway. Login email/password, Google, dan nomor melalui Firebase Auth tersedia; SMS OTP asli membutuhkan Blaze. Pengiriman WhatsApp manual melalui wa.me; transfer/QRIS diverifikasi petugas.

## Mulai lokal

Prasyarat Node 22.20+ dan Java JDK 21 untuk Firebase Emulator. Gunakan npm dan versi terkunci dalam package-lock.json.

```powershell
npm ci
Copy-Item .env.example .env.local
# Jika Java yang aktif lebih lama dari 21:
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
$env:PATH="$env:JAVA_HOME\bin;" + $env:PATH
npm run emulators
```

Di terminal kedua, setelah emulator siap:

```powershell
npm run seed
npm run dev
```

Buka http://127.0.0.1:5173. UI emulator: http://127.0.0.1:4000.

| Akun demo lokal | Password | Role |
| --- | --- | --- |
| owner@solekasir.test | SoleDemo123! | owner |
| kasir@solekasir.test | SoleDemo123! | kasir |

**Seed hanya loopback dan project `demo-solekasir`.** Script memanggil API emulator Authentication dan konteks rules-disabled dari pustaka pengujian; tidak mengandung service account atau SDK Admin dalam frontend. Seed boleh dijalankan ulang untuk mengembalikan data demo dan tidak menyentuh transaksi lain. Harga contoh jelas diberi label demo. Jangan gunakan identitas/password ini di produksi. Rules tests mengosongkan Firestore emulator: jalankan tes sebelum seed atau gunakan instance emulator terpisah dari pekerjaan lokal yang hendak disimpan.

Untuk demo yang bersih setelah tes: `npm run seed -- --reset`. Flag ini menghapus semua dokumen **project emulator demo** sebelum seed; jangan digunakan bila masih ingin mempertahankan pekerjaan lokal. Akun Auth demo tetap digunakan kembali. Tanpa flag ini, seed hanya memperbarui dokumen demo yang bernama tetap.

Runner emulator menyesuaikan direktori pipe Java secara lokal pada Windows/MSIX (`artifacts/java-tmp`) untuk menghindari error `Unable to establish loopback connection`. Tidak mengubah konfigurasi Java sistem. Firestore memakai port8181 karena port8080 bentrok di lingkungan ini; sesuaikan `firebase.json`, `src/lib/firebase.ts`, `scripts/seed.mjs`, dan `tests/fixture.ts` bersama-sama bila mengganti port. Tetap gunakan JDK21+.

## Pengujian dan build

```powershell
npm test
# Tutup emulator yang sedang berjalan sebelum perintah berikut:
npm run test:rules
npm run build
npm run preview
```

Pengujian domain: hitungan rupiah, diskon, DP/pelunasan, kembalian, syarat pengambilan, delta refund/koreksi, normalisasi nomor, zona waktu, mitigasi formula injection CSV. Integrasi rules/emulator: empat item dengan layanan berbeda, create/payment retry, dua pembayaran bersamaan, status dan pengambilan, alasan koreksi mundur, batal/refund eksplisit, batas refund, void dua kali, phone lock, query kasir hari ini. Rules negatif: anonymous, inactive, non-member, cross-store, eskalasi role, master/report kasir, total/status/audit palsu, ledger tanpa perubahan order, nominal negatif, field ekstra dan edit/delete ledger. Emulator tidak membuktikan performa, index produksi, quota atau perilaku semua perangkat; lihat `docs/VERIFICATION.md` untuk hasil aktual.

## Firebase produksi / bootstrap owner

1. Buat Firebase project paket Spark, aktifkan Authentication **Email/Password**, buat Firestore **Standard edition / Native mode**, pilih lokasi dekat pengguna (misalnya Jakarta jika tersedia). Pemilihan lokasi database permanen; periksa ketersediaan di Console. Jangan aktifkan Functions/Storage/App Hosting. Kuota Spark adalah batas operasional, bukan jaminan kapasitas tak terbatas.
2. Daftarkan Web App. Salin konfigurasi web publik ke `.env.production.local`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_STORE_ID=main`, **`VITE_USE_EMULATORS=false`**. API key web tidak menggantikan Security Rules. Jangan masukkan private key/service-account/Google credential ke VITE_*.
3. Authentication → Users → Add user: buat akun pengelola dengan email/password kuat dan salin UID. Buat `platformAdmins/{UID}` dengan `active: true` melalui Console. Pengelola aplikasi ini berbeda dari owner usaha pelanggan; role owner tidak otomatis menjadi pengelola. Aktifkan pendaftaran Email/Password karena `/signup` dipakai pemilik usaha. Akun baru hanya dapat mengirim permohonan dan tidak memperoleh akses toko sebelum disetujui.
4. Melalui Firestore Console dengan akun admin tepercaya, buat `stores/main/members/{UID}`: `role` string `owner`, `name` string, `active` boolean `true`. Membership tidak dapat diubah oleh pemilik usaha atau kasir. Pengelola platform dapat membuat membership owner baru saat menyetujui permohonan secara atomik. Console/Admin SDK adalah trust boundary yang melewati rules; batasi IAM admin dan gunakan MFA.
5. Buat `stores/main/settings/general` melalui Console dengan tepat delapan field string: `name`, `address`, `phone` (format `628…` atau kosong), `hours`, `terms`, `receivedTemplate`, `readyTemplate`, `prefix` (2–6 huruf kapital/angka, misalnya SK). Contoh template: `Halo {nama}, order {order} diterima. Estimasi {estimasi}. Total {total}, sisa {sisa}. — {toko}`. Jangan mempatbahkan field lain. Setelah ini owner dapat mengedit di aplikasi dan membuat layanan dengan harga toko sebenarnya.
6. Untuk kasir, Add user di Authentication; buat `accounts/{UID}` dengan `storeId` toko tujuan melalui Console serta membership UID pada toko yang sama dengan `role: kasir`, `name`, `active: true`. Untuk mencabut akses set active false di Console; rules berlaku pada request berikutnya. Hapus membership juga menolak akses. Aplikasi memverifikasi membership saat login; bila role berubah saat sesi hidup, login ulang memperbarui tampilan, rules tetap menolak akses yang dicabut.
7. Authentication → Settings → Authorized domains: masukkan domain Firebase Hosting dan custom domain Anda. Gunakan reset password dari Firebase Console saat onboarding. Jangan berbagi akun antarpetugas.

## Metode login

Email/Password, Google, dan nomor dengan OTP tersedia pada login/signup. Menu Lainnya menyediakan penautan Google/nomor ke UID akun lama. Semua metode tetap memerlukan persetujuan usaha. Lihat [panduan Auth dan setup domain/SMS](docs/AUTH-METHODS.md); rules terbaru diperlukan untuk permohonan phone-only. SMS produksi membutuhkan paket Blaze, Authorized domains HTTPS, dan region policy Indonesia. Konfigurasi Firebase pengguna tidak diganti oleh mode QA.

## Signup usaha, persetujuan, dan invoice

Lihat [panduan penggunaan baru](docs/SUBSCRIPTIONS-INVOICES.md). Pemilik usaha daftar di `/signup`; pengelola meninjau di `/admin/subscriptions` setelah konfirmasi berlangganan di luar aplikasi. Persetujuan membuka toko terpisah, dengan tanggal akhir yang dipilih. Owner usaha tidak dapat menyetujui dirinya sendiri atau memperpanjang akses. Belum ada tagihan langganan otomatis atau payment gateway.

Detail order → Lihat nota menyediakan PNG/PDF, berbagi PNG, dan link invoice publik. Link tetap, berlaku 30 hari sejak diperbarui, dapat dicabut, dan berisi snapshot tagihan. Perbarui setelah pembayaran/perubahan order. File dibuat di perangkat tanpa upload Storage. Link localhost hanya untuk uji lokal; bagikan link dari domain HTTPS setelah deployment.

## Deployment Vercel

Lihat [konfigurasi Firebase dan redeploy Vercel](docs/VERCEL.md). Environment harus dipilih untuk Production/Preview yang sesuai dan baru berlaku setelah build ulang. Build memeriksa empat konfigurasi Firebase web sebelum menghasilkan aplikasi; `VITE_USE_EMULATORS=false` diperlukan untuk Vercel.

## Deployment Firebase Hosting dan custom domain

```powershell
npx firebase login
npx firebase use --add
# Pilih project produksi milik Anda; jangan deploy demo-solekasir.
npm run build
npx firebase deploy --only firestore:rules,firestore:indexes,hosting --project PROJECT_ID_ANDA
```

`.firebaserc` awal menunjuk demo agar pengembangan tidak tidak sengaja menulis produksi. `firebase.json` mengatur SPA rewrite, headers keamanan dasar, no-cache untuk index/sw. Tunggu semua composite index siap sebelum membuka fitur filter. Emulator tidak menegakkan kebutuhan composite index seperti produksi. Deploy hanya rules/indexes/hosting setelah env produksi diisi; frontend env dibekukan saat build.

Firebase Console → Hosting → Add custom domain → masukkan domain → tambahkan record TXT verifikasi kepemilikan serta A/CNAME yang **ditampilkan Console**, di panel DNS registrar Anda. Jangan menebak alamat IP. Tunggu verifikasi DNS dan provisioning sertifikat SSL. Tambahkan hostname ini ke Authorized domains Authentication. Uji login, refresh URL detail, pembayaran kecil uji, nota dan logout di domain HTTPS. Tidak ada deployment nyata yang otomatis dilakukan oleh repo ini.

## Arsitektur dan folder

```text
src/
  domain/       tipe, aturan perhitungan, format tanggal, nota/CSV
  lib/          inisialisasi Firebase; memory cache, emulator opt-in
  stores/       session Pinia, membership dan koneksi
  data/         repository query/aggregate + transaksi bisnis terpisah dari UI
  components/   komponen UI reusable
  features/     halaman sesuai fitur (login, dashboard, order, customer, owner)
  App.vue       shell sidebar/bottom navigation
  router.ts     route guard
scripts/        seed khusus emulator, generator ikon PWA
tests/          domain, rules negatif, integrasi transaksi
docs/           skema, keamanan, verifikasi
firestore.rules / firestore.indexes.json
firebase.json / .env.example
```

Tidak ada listener seluruh database. Halaman dimuat dari server dan disegarkan setelah aksi; pagination 25 baris. Dashboard memakai server aggregate (count/sum) dan 8 order terbaru. Laporan mengambil halaman 25 baris pada rentang tanggal terpilih, maksimum 10.000 record per jenis; jika terlampaui laporan gagal dengan pesan untuk mempersempit periode, tidak memberikan total parsial. Query dibuat dalam scope store. Detail menggunakan order tunggal + halaman ledger/audit per order.

Snapshot item pada order dipasangkan dengan mirror `orders/{id}/items/{slot1–4}`. Rule setiap item memvalidasi tipe, layanan dan transisi; rule order memastikan seluruh mirror identik dengan list order melalui getAfter. Pembuatan dan perubahan dilakukan dalam satu transaction. Pemisahan ini menjaga ekspresi rules tetap di bawah batas saat memvalidasi beberapa pasang.

Pencarian Firestore MVP adalah **prefix** nama huruf kecil atau prefix nomor ternormalisasi, bukan substring/fuzzy. Order dapat difilter status, tanggal masuk, tunggakan dan keterlambatan. Pelanggan memiliki phone lock unik per toko. Satu order maksimum empat pasang agar Rules dapat memvalidasi setiap item dan snapshot layanan di bawah batas akses dokumen. Dengan empat layanan berbeda + DP atomik, aturan awal dapat mendekati batas evaluasi; tes kasus ini wajib dipertahankan saat skema berubah. Layanan dimuat maksimum 100; kebutuhan katalog besar masuk pengembangan selanjutnya.

## Perilaku transaksi, laporan dan PWA

- Nomor order `PREFIX-YYMMDD-8HEX`, berasal dari UUID acak, dengan reservation doc unik; tidak memakai jumlah dokumen. Benturan nomor menolak create; buka form baru untuk ID baru. Order UUID yang sama saat retry tidak membuat order lain. Tombol dikunci selama save dan ID dipertahankan pada error. Tutup tab sebelum respons tersimpan: periksa daftar order sebelum membuat ulang karena draft MVP hanya di memori.
- Dua retry ID sama bisa bertabrakan dengan rules append-only sebelum SDK mengulang transaction. Repository memeriksa witness order/ledger/audit **dari server** sesudah error dan hanya menganggap berhasil bila operasi ID tersebut telah committed oleh petugas yang sama; bila konfirmasi server tidak tersedia, error tetap ditampilkan. Tidak memakai cache untuk konfirmasi sukses.
- Item snapshot layanan/harga/kondisi/estimasi tidak berubah saat master berubah. Status terpisah dari ledger. Kasir progres berurutan; owner dapat melompat maju atau mengoreksi mundur dengan alasan. Semua perubahan membawa event immutable dan versi order. Audit progres menyimpan snapshot sebelum/sesudah dan UI menampilkan perubahan status, catatan, serta rak per sepatu. Rules menolak snapshot audit yang berbeda dari perubahan sebenarnya.
- Ledger payment/refund/void append-only, mirror immutable per order, dibarengi update paid/balance/event dalam transaction. Transaksi membaca ulang order pada konflik. Retry memakai ID sama. Uang diserahkan terpisah dari pembayaran diterapkan/kembalian. Dua perangkat yang memasukkan **ID berbeda untuk pembayaran fisik yang sama** tidak bisa dikenali otomatis; petugas perlu memeriksa ledger. Tidak ada verifikasi bank/QRIS otomatis.
- Void membatalkan catatan penerimaan keliru dengan alasan; hanya payment asli, satu kali, tidak untuk order sudah diambil. Refund mencatat uang benar-benar dikembalikan; dibatasi pembayaran bersih tersisa. Void tidak menyatakan refund fisik. Jangan mencatat void dan refund untuk uang sama. Koreksi pengeluaran belum tersedia: periksa sebelum save, koreksi administratif terkontrol masuk roadmap.
- Order batal berhenti aktif tetapi pembayaran tetap ada sampai refund eksplisit. Pengambilan sekaligus mensyaratkan semua item status4 dan balance0. Refund sesudah pengambilan tetap diperbolehkan owner untuk mempertahankan catatan uang; tidak otomatis membuka ulang pekerjaan, dan balance hasil refund adalah selisih historis, bukan piutang aktif.
- Periode nilai order berdasar **tanggal masuk**; periode penerimaan/refund/koreksi/pengeluaran berdasar **tanggal pencatatan event**. Sisa tagihan laporan = saldo terkini order aktif yang masuk dalam periode, bukan saldo historis pada akhir periode. Dashboard sisa tagihan = semua order aktif. Surplus kas = penerimaan dikurangi refund/koreksi/pengeluaran, **bukan laba akuntansi**. DP hari berbeda tidak kembali dibukukan pada tanggal masuk.
- Service worker hanya cache aset aplikasi; tidak cache API/auth/Firestore. Penulisan dan pembacaan operasional memerlukan koneksi, Firestore memory cache tidak menjadi database offline. Offline banner menolak aksi; SDK transaction gagal saat offline. Jangan mempatpilkan sukses sebelum commit. Pengaturan toko/PWA tidak mengubah nama aplikasi yang sudah dipasang di Home Screen secara otomatis; pengguna dapat memberi nama sendiri saat instalasi.
- iPhone Safari: buka domain HTTPS → Share → Add to Home Screen → Add. Android: menu browser → Install/Add to Home Screen bila tersedia. Local localhost untuk development; uji PWA sungguhan di HTTPS. Nota dapat disalin, dibagikan manual lewat WhatsApp, dan dicetak via dialog browser/print stylesheet. Tidak mengklaim akses printer Bluetooth dari Safari.

## Batas keamanan dan roadmap

Lihat [skema](docs/SCHEMA.md) dan [batas keamanan](docs/SECURITY.md). MVP melindungi invariants inti dengan rules + transaksi, tetapi tidak menggantikan verifikasi pembayaran dunia nyata atau audit akuntansi tepercaya. Profil kasir dapat membaca detail order toko dan saldo order; memisahkan semua informasi keuangan dari operator yang mengelola pembayaran memerlukan proyeksi dokumen terpisah/backend. Laporan keseluruhan, global ledger historis, pengeluaran, master dan pengaturan dilindungi owner di rules dan route guard. Akun dengan Firebase Console/IAM dapat melewati rules.

Roadmap (belum diimplementasikan): multi-outlet, membership/loyalty, antar-jemput, portal tracking akses terbatas, WhatsApp resmi otomatis, payment gateway, bahan/inventaris, komisi, foto kondisi, pengambilan sebagian, refund per pembayaran asli yang lebih rinci, reversal pengeluaran, audit akuntansi/proyeksi agregat dari backend, App Check dan monitoring quota. Integrasi gateway/webhook/WhatsApp otomatis serta konsistensi agregat dari server membutuhkan backend tepercaya; Cloud Functions Firebase umumnya membutuhkan Blaze. Jangan beralih paket tanpa menilai biaya/kuota. Data pelanggan perlu dibatasi aksesnya dan dipelihara sesuai kebijakan toko.

## Referensi resmi yang dipakai

- [Vue + TypeScript](https://vuejs.org/guide/typescript/overview.html), [Vite prasyarat](https://vite.dev/guide/), [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite).
- [Firestore transaksi/getAfter](https://firebase.google.com/docs/firestore/manage-data/transactions), [Rules unit tests](https://firebase.google.com/docs/rules/unit-tests), [Firebase pricing/kuota Spark](https://firebase.google.com/pricing).
- [Query range beberapa field](https://firebase.google.com/docs/firestore/query-data/multiple-range-fields), [agregasi count/sum dan index](https://firebase.google.com/docs/firestore/query-data/aggregation-queries).
- [Vite PWA](https://vite-pwa-org.netlify.app/guide/), [Firebase Hosting custom domain](https://firebase.google.com/docs/hosting/custom-domain).



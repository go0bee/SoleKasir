# Verifikasi aktual — 13 Oktober 2026

| Pemeriksaan | Hasil |
| --- | --- |
| Unit domain + integrasi + Security Rules (Firestore/Auth Emulator) | 22/22 lulus; project demo-solekasir, Firestore8181, Auth9099, Java21 |
| TypeScript dan build produksi | Lulus; manifest, PNG192/512 dan service worker terbentuk;31 aset, sekitar812KiB precache |
| Format tanggal | Unit test batas tengah malam Jakarta lulus; formatToParts dipakai agar pemisah lokal/browser tidak memengaruhi nomor order |
| Audit dependensi produksi | npm audit --omit=dev:0 advisori pada pemeriksaan ini; bukan jaminan bebas kerentanan |
| Browser lokal desktop dan390×844 | Login/logout owner/kasir, dashboard data server, navigasi responsif; tidak ada overflow horizontal pada layar yang diperiksa; tombol dashboard terlihat>=44px |
| Alur utama browser melalui emulator | Pelanggan baru → order Nike60.000, diskon5.000 → DP20.000 tunai diserahkan50.000/kembalian30.000 → pelunasan35.000 QRIS manual → siap → pengambilan → nota total55.000, saldo0 |
| Nota | Tampilan dan salin teks berhasil; link wa.me berisi pesan benar, tanpa mengirim pesan WhatsApp selama pengujian |
| Laporan/pengeluaran/CSV | Pada data uji: nilai order335.000, penerimaan120.000, pengeluaran20.000, surplus kas100.000. CSV terunduh dan kolom/angka/tanggal WIB diperiksa |
| Filter order | Kombinasi aktif, tanggal masuk, belum lunas dan lewat estimasi berhasil memberi satu order yang cocok |
| Guard kasir | Menu owner tersembunyi; membuka /reports langsung dialihkan ke /more. Rules menolak master/settings/expenses/global ledger historis, eskalasi role dan akses lain toko |
| Riwayat progres terbaru | Browser kasir memperbarui Dicuci→Dikeringkan, catatan dan rakA-02→B-03; UI menampilkan sebelum/sesudah beserta petugas, SDK server mengonfirmasi penyimpanan |
| Evaluasi desain independen | PASS sesudah perbaikan44px dan kontras; model provider berbeda tidak tersedia, evaluator memakai model yang tersedia. Bukti di artifacts/ |

Pengujian otomatis juga mencakup create retry dengan ID tetap, empat layanan berbeda+DP atomik, dua perangkat pembayaran berbeda yang tidak boleh overpay, dua retry pembayaran ID sama yang hanya dicatat sekali, harga snapshot setelah master berubah, pelunasan/pengambilan4 item, owner koreksi mundur wajib alasan dengan snapshot audit, cancel yang tidak otomatis refund, batas refund, void dua kali, nomor WhatsApp unik, false audit, ledger tanpa parent/audit, edit/delete ledger, jumlah negatif/field ekstra, anonymous/non-member/inactive/cross-store dan penolakan operasi offline. Rules negatif memakai batch yang dibuat langsung untuk memastikan validasi bukan hanya dari UI.

Data emulator dikembalikan ke seed bersih setelah pengujian otomatis; angka demo awal berbeda dari angka saat alur browser dicoba. Semua pengujian ini memakai dokumen Firestore emulator yang sebenarnya, bukan penggantian repository dengan data dummy.

## Batas verifikasi

- **Belum deploy** ke Firebase produksi atau custom domain; project/config/domain milik pengguna belum tersedia. Bootstrap owner dan langkah DNS/Hosting tercantum di README.
- **Belum menguji iPhone/Safari/Android fisik**, instalasi Home Screen, cetak printer atau sesi PWA produksi. Uji390px adalah viewport browser desktop, bukan perangkat fisik. Print stylesheet dan manifest dibangun/diperiksa, tetapi tidak membuktikan perilaku printer atau Safari.
- Emulator **tidak menegakkan kebutuhan composite index produksi**;43 definisi index termasuk agregasi/filter disiapkan, perlu deploy/tunggu siap dan smoke test di project sebenarnya. Performa, quota Spark dan konflik di infrastruktur produksi belum diukur.
- Build memiliki peringatan bundle utama sekitar686KiB (gzip214KiB), sebagian besar SDK Firebase; fitur halaman sudah lazy-load. Ini bukan build failure, tetapi performa jaringan/perangkat lambat perlu diukur.
- Audit keseluruhan masih memberi12 advisori pada dependency pengembangan/transitif Firebase CLI (5moderate,7high), tanpa critical pada pemeriksaan terakhir. Audit produksi0 setelah override patch gRPC. Tidak memakai audit fix --force yang dapat menurunkan/mengubah SDK secara tidak kompatibel. Recheck dan perbarui CLI sebelum deployment; toolchain pengembangan tetap punya risiko tersendiri.

Bukti visual: dashboard-desktop.jpg, dashboard-mobile.jpg, login-desktop.jpg, mobile-order-form.jpg, mobile-completed-order.jpg. Beberapa merekam data uji sebelum seed direset. Tidak ada klaim pesan WhatsApp dikirim, transaksi bank diverifikasi otomatis, domain aktif atau uji perangkat berhasil.

## Perubahan 13 Oktober 2026: signup langganan dan invoice
- `npm test`: 6/6 pengujian domain lulus, termasuk perbandingan snapshot tanpa bergantung urutan key Firestore.
- `vitest run tests/rules.test.ts tests/integration.test.ts tests/subscriptions-invoices.test.ts` pada emulator aktif: 25/25 lulus. Runner `npm run test:rules` sekarang mencakup file baru.
- Delapan pengujian baru: create pending/self-escalation deny, approve idempotent/isolation, reject, suspend/expire/renew, empat layanan berbeda+DP pada toko berlangganan, anonymous invoice get/private/list deny, publish ulang URLtetap/revoke, fieldPII/uang/expiry/toko asing deny.
- Tambahan langganan sempat melewati batas1000 evaluasi rules pada order empat item. Diperbaiki dengan menghapus pemeriksaan yang duplikat/implied oleh nilai sumber dan timestamp, mempertahankan seluruh membership/role/expiry check. Kasus empat item main dan toko berlangganan lulus.
- Build produksi final lulus TypeScript, bundling, dan serviceworker. Main chunk~694kB (~217kB gzip), warning bundling masih ada; jsPDF diimpor ketika ekspor PDF dipakai.
- `npm audit --omit=dev`: 0 temuan produksi. Toolchain dev masih 12 (5 moderate,7 high) sebagaimana sebelumnya.
- Browser: signup `signup-qa@solekasir.test` dengan data sintetis pada emulator → pending; direct/orders/new tertahan; ownerdemo menyetujui sampai12Nov2026 akhirhariJakarta; akunusaha login mendapat dashboard0 dan identitasusaha sendiri; main tetap4order. Akun QA ditinggalkan sebagai contoh lokal, bukan akun produksi.
- Direct anonymous invoice awalnya teralihkan login akibat race watcher App dengan initial router; diperbaiki dengan menunggu router.isReady. URL publik setelah fix menampilkan invoice tanpa shell/akun.
- PNG dan PDF diunduh dari tombol produk ke folder Downloads. PNG129.9kB, PDF93.6kB satu halaman A4; dirender ulang memakai pypdfium2 dan diperiksa visual. Nilai order60rb, paid30rb, balance30rb sesuai demo.
- Stress harness lokal artifacts/export-stress.html: empat item dan panjangmaksimalnama160/alamat500/deskripsi160/warna80/layanan100/ketentuan3000 menghasilkan canvas1000x3502, PDF3halaman. Render kontak diperiksa: teks/balance/footer lengkap, tidak terpotong di pergantian halaman. Harness tidak dimasukkan ke build produksi.
- Fitur Web Share bergantung dukungan browser/perangkat; jalur download fallback tersedia. Belum diuji menu share asli Safari iPhone, printerfisik, domainHTTPS nyata, Firebaseproductionindex/quota atau penagihan nyata. Link localhost tetap untuk QA.
- Bukti: artifacts/invoice-public-mobile.jpg, signup-pending.jpg, subscription-admin-mobile.jpg, invoice-export-pdf-page1.png, invoice-long-pdf-contact.png. Evaluasi desain menambah screenshotnya sendiri.


- Pemeriksaan desain PASS pada 375, 768, 1440px. Dua refinement (form kata sandi tablet dan main admin bersarang) diperbaiki; screenshot baru dan DOM diperiksa kembali. Evaluator menggunakan provider yang tersedia karena provider lain tidak tersedia; pemeriksaan kedua memakai screenshot root karena sesi browser evaluator tidak tersedia. Ekspor invoice internal kini membaca order/settings dari server sebelum membuat file; public export tetap snapshot.

## Auth Google dan nomor: 13 Oktober 2026
- npm test: 12/12 lulus (6 domain + 6 orchestration Auth). Memeriksa kode salahformat/salahFirebase/retry, cleanupchallenge, offline, akun berubah saatpenautan, popup/redirect dan pesan collision.
- Firestore rules/integration: 27/27 lulus, termasuk Google pending, phone-only nomor verified, penolakan nomor palsu/tanpaidentity, kontakemailadmin tidak memberiakses, approvalphoneatomik.
- Firebase Auth SDK emulator: 3/3 lulus, Googlecredentialverifiedidentity tetap pending, OTPwrong/right phone-onlysignup, linkGoogle+phone UID tetap danloginulang melalui nomor. PhoneCredential di test memakai browserSDKentry karena NodeAuth mengekspos providerphoneunsupported.
- Build aplikasi, TypeScript, bundling danPWA lulus. Firebase12.19.0 danformatlib/firebase perubahanpengguna dipertahankan. Firebaseconfigreal .env.local serta .firebaserc milikpengguna tidak diganti.
- BrowserQA dilakukan pada port5174 dengan .env.authqa.local demo-solekasir. SDKRecaptchaVerifierfake hanya saatflag emulator dan auth.emulatorConfig nyata. TidakmengirimSMSproduksi.
- Browser: nomorQA +6281999900013 → kodeemulator, 000000ditolakpesanIndonesia, OTPbenar → profilnomorverifiedreadonly/emailkontakeditable → kirimprofile → pending; /orders/newtetaptertahan. Bukti auth-phone-pending.jpg.
- PopupOAuth Google tidak dapat dioperasikan sebagai tab terpisah oleh alatbrowser yangtersedia; credentialGoogle/penautan diuji SDKemulator, popup/redirect diuji orchestrationunit. OAuthasli, CAPTCHAasli, SMSasli dan Safari/iPhonehosted belum diuji. PenggunamenyelesaikanGoogle/CAPTCHA/OTPsendiri.
- Routing login diperbaiki menghapusrefreshganda serta mengalihkanactive/pending menujuworkspace. Pending sungguhantetapterbatas.
- ScreenshotQA desktop/mobile/tablet: auth-login-*,auth-signup-*,auth-phone-mobile.jpg,auth-profile-*,auth-methods-*. Evaluasi visual dilaporkan terpisah.

- Evaluasi visual auth PASS. Setelah evaluasi, redirect-error ditampilkan juga pada penautan dan key RouterView memakai UID agar profil tidak terbawa saat pergantian akun; tipe/build diverifikasi ulang. Server QA/emulator berakhir sebelum pemeriksaan final, sehingga routing terakhir tidak diuji kembali secara browser. SMS/OAuth produksi serta deployment rules tetap tugas konfigurasi terpisah.
- Pratinjau utama dijalankan ulang pada port5173 dengan konfigurasi pengguna. Pemeriksaan tab utama terhalang kebijakan browser karena tab sebelumnya berada pada halaman error internal; pengujian visual menggunakan bukti QA yang telah diambil, bukan klaim login/SMS produksi.

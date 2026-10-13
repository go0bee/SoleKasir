# Model keamanan dan batas MVP

Default deny. UID authenticated harus memiliki membership aktif dan role tepat di store path; anggota store lain tidak memberi akses. Pemilik usaha tidak dapat membuat/mengubah membership. Pengelola platform tepercaya hanya dapat membuat owner baru dengan permohonan approved dan pointer akun dalam transaksi yang sama; pengelola dibootstrap di Console. Master services/settings hanya owner dengan exact key/type/value validation. Customer tersedia staff, nomor unik melalui phone lock atomik. Tidak ada delete order/ledger/event/master/customer dari UI/rules (phone lock lama satu-satunya delete operasional saat ganti nomor).

Order create memvalidasi 1–4 item secara eksplisit, snapshot price/name dari layanan aktif, ID item, seluruh sum/discount/paid/balance, pelanggan snapshot dari doc asli, nomor/reservation, timestamp server, event immutable dan pembayaran awal bila ada. Pembaruan hanya tiga keluarga field (progres/pengambilan, batal, uang), tergantung kind audit, exact diff field dan version+1. Semua update membutuhkan event baru; event tidak dapat disisipkan tanpa order version berpasangan. Ledger global dan mirror per-order saling dibuktikan getAfter; ledger tanpa perubahan order atau order saldo tanpa ledger ditolak. Original payment dan void marker memastikan void sekali. Refund/void owner, reason wajib, paid tidak negatif. Cancel tidak mengubah paid. Pengambilan harus semua ready dan balance0. Kasir tidak dapat skip/back status; owner back wajib reason.

Validasi map sepatu dilakukan pada mirror item di subcollection, dengan kesetaraan getAfter terhadap list order. Parent tidak mengulang seluruh validasi tipe setiap item, sehingga ekspresi tidak melewati batas1000 per evaluasi. Perubahan item tanpa order version+1/audit ditolak. Snapshot harga palsu dan lompatan status melalui batch klien yang dimodifikasi diuji secara langsung, tidak hanya melalui validasi repository.

Trusted boundary: Firebase Auth dan Security Rules, jam server, Console/IAM operator. UI validasi memberi pesan mudah tetapi bukan trust boundary. `.env` berisi web config publik; semua akses tetap rules. Firebase Admin atau credentials admin tidak dibundle dalam aplikasi. Seed rules-disabled hanya project demo dan loopback, bukan prosedur production. Developer tools tidak membuat pengguna owner.

**Batas yang harus dipahami:**

1. Rules tidak membuktikan uang tunai diterima, transfer benar, QRIS diselesaikan atau refund dibayarkan. Staff dapat mencatat pembayaran bohong pada order yang dia akses. Verifikasi manual dan SOP pemeriksaan tetap perlu.
2. Idempotency menjamin satu ID hanya sekali. Dua ID berbeda untuk uang fisik sama tetap dua penerimaan bila tidak melampaui tagihan. Pembayaran bank terverifikasi membutuhkan gateway/backend/webhook yang tepercaya.
3. Kasir harus dapat membaca order dan uang per-order untuk menerima pembayaran/nota. Kasir dapat mengumpulkan informasi itu sendiri. Akses laporan keuangan global/expenses diblokir dan query ledger global kasir dibatasi hari Jakarta saat request; confidentiality seluruh keuangan terhadap kasir tidak dijamin dengan order data model ini. Pisahkan projection dokumen dan backend bila kebijakan meminta kerahasiaan lebih kuat.
4. Client-only tidak membuktikan kebenaran estimasi manual, informasi kondisi, catatan staf atau biaya operasional. Rules membatasi format, angka dan transisi. Owner/admin dipercaya; Firebase Console bisa mengubah/hapus data melewati rules. Audit immutable bagi client aplikasi, bukan immutable terhadap IAM admin atau penghapusan project.
5. Laporan historis piutang/as-of belum ada. Saldo tampil adalah saldo terkini cohort order pada periode, penerimaan/refund menurut tanggal event. Service snapshot immutable, pembatalan order memisahkan nilainya, void merevisi catatan cash receipt di tanggal koreksi tanpa mengubah event lama.
6. Firestore tidak menyediakan text search substring secara native di query ini. Prefix field normalisasi dan phone lock disediakan; search engine fuzzy terpisah perlu biaya/infrastruktur jika dibutuhkan.
7. Tidak ada transaksi offline. Browser dapat kehilangan draft/ID saat tab ditutup; retry selama form terbuka aman. Cek histori saat hasil jaringan tidak diketahui sebelum membuat transaksi baru. Refresh PWA baru menunggu pengguna agar tidak menghapus draft tanpa sengaja.
8. Batas evaluasi rules: maksimal 10 document access per operasi, 20 per transaction/batch, akses cached dapat tidak dihitung. Pembatasan4 item dan penggunaan path ulang penting. Uji ulang kasus4 layanan berbeda+DP ketika memperluas skema; emulator vs produksi berbeda contention/index/throughput, lakukan smoke test project produksi dengan data uji sebelum operasional.

Quota/security monitoring, App Check, backup/export administratif dan SOP rotasi akses perlu disiapkan untuk penggunaan nyata. Tidak mengklaim PCI, audit akuntansi, verifikasi gateway atau proteksi terhadap admin Firebase yang jahat.


## Langganan manual dan link publik
Role pengelola berasal dari platformAdmins Console, terpisah dari role owner usaha. Pending user hanya create/get permohonan sendiri. Approval membutuhkan app+account+member+subscription atomik. Pemilik usaha tidak bisa memperpanjang expiry; status/masa aktif diperiksa server di semua operasi kasir. Pengecualian legacy main tanpa sub eksplisit; semua toko signup wajib punya sub aktif.

InvoiceShares adalah proyeksi yang sengaja dibagikan, bukan dokumen order publik. Publik get-only enabled/unexpired, list denied; token acak32byte. Rules membandingkan proyeksi exact dengan dokumen asli, sehingga field tambahan/nominal palsu ditolak. Metadata IDs/UID pembuat tersedia pada payloadshare; bukan kredensial/profilstaff. Revokasi mencegah request berikutnya, tidak menghapus salinan penerima. Perubahan order tidak memperbarui snapshot otomatis. Linkpublik yang telah terbit tetap berlaku sampai expiry/revoke meski toko suspended; pencabutan administratif tersedia via Console. Referrer no-referrer dan noindex mencegah kebocoran biasa, bukan pengganti token rahasia.

Tidak ada resetpassword publik, undangan tim, billing/subscriptiongateway atau verifikasitransferotomatis. Login Google dan SMS OTP ditambahkan; lihat AUTH-METHODS.md. Batasi IAM/platformadmin, evaluasi AppCheck/rateabuse/kuota untuk produksi, dan ikuti prosedur Firebase setup README.



# Login Email, Google, dan Nomor Telepon
Aplikasi mendukung Email/Password, Google, dan nomor Indonesia dengan kode SMS. Login berhasil hanya membuktikan identitas; pendaftaran usaha tetap pending sampai pengelola menyetujui. UID yang sama digunakan di platformAdmins, accounts, membership, dan application.

## Pemakaian
- Login/Signup: Lanjutkan dengan Google atau Masuk dengan nomor telepon. Akun sosial baru diarahkan ke profil usaha sebelum mengirim permohonan.
- Google membuka popup pemilihan akun; bila browser memblokir popup, SDK memakai redirect. Hasil redirect diproses sebelum pemeriksaan akses.
- Nomor: isi 08… atau +628…, selesaikan reCAPTCHA bila muncul, Kirim kode SMS, lalu enam angka OTP. Kode salah dapat dicoba kembali; ada jeda 30 detik untuk kirim ulang. Pembatasan Firebase server tetap berlaku terpisah.
- Akun nomor tanpa email diminta email kontak. Email kontak ini tidak terverifikasi sebagai identitas dan tidak dipakai untuk menentukan role. Rules mewajibkan nomor aplikasi sama dengan klaim phone_number dari Firebase Auth. Untuk akun dengan email Auth, email permohonan tetap sama dengan email Auth.
- Setelah masuk, menu Lainnya → Metode masuk menyediakan Hubungkan Google/nomor untuk akun yang belum memiliki metode tersebut. UID dan akses toko dipertahankan. Hubungkan dari akun lama sebelum mencoba masuk dengan metode baru.
- Nomor/Google yang sudah terhubung ke UID lain ditolak; penggabungan akun/data tidak dilakukan otomatis. Bila identitas sudah terlanjur memiliki dua UID, pengelola meninjau kebutuhan migrasi secara administratif.
- Tidak ada penghapusan/unlink provider dari UI. CAPTCHA, OAuth dan kode SMS ditangani pengguna sendiri. Tidak menyimpan OTP/kredensial pada file atau localStorage aplikasi.

## Firebase produksi
Konfigurasi .env pengguna tetap dipertahankan. Aktifkan provider Email/Password, Google dan Phone pada project yang sama. Google memerlukan support email serta Authorized domains untuk domain aplikasi. Gunakan domain Hosting HTTPS untuk SMS produksi; localhost bukan hosted domain yang diizinkan untuk phone auth menurut dokumen resmi Firebase.
SMS Region Policy harus mengizinkan Indonesia; project baru dapat default deny semua wilayah. SMS asli memerlukan paket Blaze dan mengikuti kuota/biaya Firebase. Paket/billing tidak diubah oleh aplikasi atau implementasi ini. Nomor uji Firebase dan emulator tidak mengirim SMS nyata.
Untuk redirect Safari/iPhone dengan pembatasan penyimpanan pihak ketiga, ikuti best practices Firebase: sesuaikan authDomain dengan Hosting domain yang digunakan, tambahkan Authorized domains serta redirect URI OAuth yang sesuai; jangan sekadar mengganti authDomain ke hostname yang tidak melayani /__/auth/. Pengujian pada perangkat/domain asli masih diperlukan.

Rules terbaru harus dipasang agar signup phone-only dapat disimpan:
```powershell
npx firebase deploy --only firestore:rules,firestore:indexes --project solekasir-p01
```
Instruksi ini untuk dijalankan setelah login Firebase CLI; workspace tidak otomatis menerbitkan rules produksi.

## QA lokal terpisah
Gunakan .env.authqa.local berisi project demo-solekasir dan VITE_USE_EMULATORS=true, jalankan npm run dev -- --mode authqa --port 5174 --strictPort. Aplikasi utama menggunakan .env.local milik pengguna. Pembypass verifikasi reCAPTCHA testing diaktifkan hanya jika flag emulator dan auth.emulatorConfig keduanya ada.
npm test mencakup domain dan auth-methods; npm run test:rules mencakup aturan/transaksi dan SDK Auth emulator. Jalankan tes sebelum seed; aturan fixtures mengosongkan Firestore demo. Jangan jalankan seed/reset pada project sebenarnya.

Referensi resmi: [Google](https://firebase.google.com/docs/auth/web/google-signin), [phone auth](https://firebase.google.com/docs/auth/web/phone-auth), [account linking](https://firebase.google.com/docs/auth/web/account-linking), [limits/SMS Blaze](https://firebase.google.com/docs/auth/limits), [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices).


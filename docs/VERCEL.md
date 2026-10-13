# Firebase pada Vercel

Di Vercel → Project → Settings → Environment Variables, isi konfigurasi **Web App Firebase yang sama**:

| Nama yang disarankan | Nilai |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` dari Firebase Web App |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` dari Firebase Web App |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` dari Firebase Web App |
| `VITE_FIREBASE_APP_ID` | `appId` dari Firebase Web App |
| `VITE_USE_EMULATORS` | `false` |

Pilih scope **Production** untuk domain produksi; pilih **Preview** juga jika memakai deployment preview. Empat variabel konfigurasi web juga menerima nama `FIREBASE_*` tanpa awalan `VITE_`, termasuk `FIREBASE_API_KEY` yang sudah dipakai sebelumnya. Bila keduanya terisi, nilai `VITE_*` diprioritaskan. Jangan memasukkan tanda kutip sebagai bagian nilai di dashboard Vercel.

Konfigurasi ditanam ke aplikasi **saat build**. Mengubah environment di dashboard tidak mengubah deployment yang sudah ada. Push kode perbaikan ke repository yang terhubung, lalu buat deployment Production baru. Jika hanya mengubah environment, lakukan **Redeploy** pada deployment Production. Gunakan preset Vite, build command `npm run build`, output directory `dist`.

Build berhenti dan menyebut nama variabel yang kurang jika salah satu dari empat konfigurasi web kosong. Nilainya tidak dicetak ke log. Emulator hanya aktif bila `VITE_USE_EMULATORS=true`; deployment Vercel menolak mode emulator karena alamat localhost tidak tersedia di perangkat pelanggan.

Tambahkan hostname aplikasi ke Firebase Authentication → Settings → Authorized domains. Setelah deployment sukses, buka kembali aplikasi dan muat pembaruan jika PWA masih menampilkan versi sebelumnya.

Konfigurasi Web App bersifat publik. Hanya empat field yang diizinkan di atas yang disalin oleh konfigurasi build; jangan simpan private key atau service account dengan awalan `VITE_` karena Vite mengekspos awalan tersebut ke browser.

Referensi: [Vite environment variables](https://vite.dev/guide/env-and-mode.html), [Vercel environment variables](https://vercel.com/docs/environment-variables).

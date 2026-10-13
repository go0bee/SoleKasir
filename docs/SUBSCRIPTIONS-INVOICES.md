# Pendaftaran usaha dan invoice

## Untuk pemilik SoleKasir
- Buka **Persetujuan langganan** pada menu atau `/admin/subscriptions`.
- Daftar Menunggu → pilih usaha → Setujui → tentukan tanggal akhir → Tinjau keputusan → konfirmasi. Awalnya disarankan 30 hari; tidak ada penagihan atau bukti pembayaran otomatis.
- Setelah persetujuan, pemilik usaha masuk ulang atau menekan Periksa persetujuan. Toko baru dimulai kosong; pemilik mengatur layanan/harga sebenarnya.
- Disetujui → pilih usaha → perpanjang atau tangguhkan dengan alasan. Tangguhkan dapat dibuka kembali oleh pengelola. Penolakan menampilkan alasan di akun pemohon.
- Pemohon yang ditolak menghubungi pengelola; pendaftaran kembali memerlukan peninjauan administratif. Tidak ada tombol yang membatalkan penolakan atau mengubah status sendiri.

Pengelola hanya ditentukan melalui `platformAdmins/{authUid}`, field boolean `active:true` di Firebase Console. Jangan berikan hak ini kepada owner usaha pelanggan. Pengelola boleh tidak memiliki membership toko; halaman administrasi tetap dapat dipakai. Akun demo owner sudah menjadi pengelola **hanya di emulator**.

## Untuk usaha yang berlangganan
Buka `/signup`, isi nama, usaha, WhatsApp, email, password; alamat opsional. Permohonan disimpan dengan status pending. Akun dapat dibuat walaupun penyimpanan permohonan gagal jaringan; halaman status memungkinkan melengkapi data menggunakan akun yang sama. Email yang sudah terdaftar harus login.

Setelah disetujui, akun memiliki satu pointer `accounts/{uid}.storeId` yang dikelola admin. Ruang kerja terpisah `stores/business-{uid}`. Rule semua operasi memerlukan membership aktif dan subscription aktif dengan `expiresAt > request.time`. Owner juga terkena batas ini. Masa aktif berakhir pukul 23:59:59.999 Asia/Jakarta pada tanggal pilihan, maksimal 366 hari ke depan per perubahan.

Halaman memeriksa masa berakhir setiap 15 detik; penangguhan administratif berlaku pada request server berikutnya, termasuk bila tampilan lama masih terbuka. Muat ulang/Periksa persetujuan memperbarui status yang ditampilkan. Saat offline akses dan perubahan baru tidak dapat diverifikasi.

Tim kasir dibuat melalui Console seperti sebelumnya, ditambahkan membership pada toko tujuan dan `accounts/{kasirUid}` dengan `storeId` yang sama. Belum ada UI undangan atau pindah toko.

### Kompatibilitas toko lama
`main` tanpa dokumen subscription tetap memakai membership lama. Ini pengecualian migrasi eksplisit **hanya untuk main**, bukan untuk toko hasil signup. Jika ingin main mengikuti masa langganan, admin Console membuat `stores/main/subscription/access` dengan field yang sesuai; setelah ada, main wajib aktif dan belum kedaluwarsa. Akun legacy tanpa pointer memakai VITE_STORE_ID (default main). Jangan memilih default store lain tanpa provisioning pointer/subscription.

## Invoice
Detail order → **Lihat nota**:
- Unduh PNG atau PDF langsung, tanpa menyimpan file di Firebase Storage.
- Bagikan PNG memakai menu berbagi perangkat jika tersedia; bila browser tidak mendukung, file diunduh. Pengguna melampirkan file di chat sendiri.
- Buat link invoice membutuhkan konfirmasi bahwa pemegang link dapat melihat isi tagihan. Salin link atau buka WhatsApp untuk dikirim manual.
- Perbarui link setelah pembayaran atau perubahan order; URL tetap sama. Masa berlaku dimulai ulang 30 hari.
- Cabut link menghentikan akses publik berikutnya. File atau salinan yang sudah diambil penerima tidak bisa ditarik kembali.

Invoice publik `/invoice/{token}` tidak perlu akun dan tidak menampilkan sidebar. Snapshot memuat nama/alamat/telepon/jam/ketentuan toko, nomor/tanggal order, nama pelanggan, sepatu/warna/layanan/harga/estimasi, subtotal/diskon/total/pembayaran bersih/sisa, serta batal/diambil. Tidak memuat nomor pelanggan, kondisi awal, material, ukuran, catatan/rak internal, nama petugas, atau audit.

Ini **snapshot**, bukan pelacakan status/pembayaran realtime. Publik melihat kapan diperbarui dan tanggal kedaluwarsa. Dokumen share juga memiliki ID toko/order dan UID pembuat sebagai metadata teknis untuk rules; tidak berisi kredensial atau profil petugas. Data operasional tetap private, walaupun ID tersebut diketahui.

Token memakai 32 byte acak browser (64 hex). Publik hanya boleh get dokumen enabled yang belum kedaluwarsa; query/list ditolak. Staff hanya boleh menerbitkan proyeksi yang persis sesuai order dan pengaturan tokonya; rules menolak tambahan field pribadi atau angka palsu. Public share yang sudah diterbitkan tetap dapat dibaca sampai dicabut/kedaluwarsa meskipun langganan toko berakhir; staf tidak dapat memperbaruinya saat akses nonaktif. Pengelola dapat melakukan pencabutan administratif dari Console jika diperlukan.

PNG menggunakan canvas lokal dan PDF A4 dari canvas melalui jsPDF (kontennya berupa gambar, teks PDF tidak dapat dipilih). Baris panjang dibungkus, PDF dapat beberapa halaman. Printer fisik memakai dialog browser, tanpa integrasi Bluetooth khusus. Nama file `invoice-{nomor}.png/pdf`.

## Publikasi
Localhost/127.0.0.1 hanya dapat diakses pada mesin yang menjalankan aplikasi. Agar link dapat dibuka dari chat pelanggan, deploy Hosting + rules + indexes ke project produksi, isi config produksi, dan pakai URL HTTPS sebenarnya. Referensi setup terdapat di README. Project, domain, dan Firebase produksi belum terhubung di workspace demo.

Referrer-Policy no-referrer dan robots noindex/nofollow disiapkan; ini tidak menggantikan kerahasiaan token. Jangan menaruh link invoice di halaman publik atau membagikannya ke orang yang tidak dituju. Aset PWA boleh dicache, dokumen invoice/API tidak dicache oleh service worker.


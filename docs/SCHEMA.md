# Skema Firestore

Operasi kasir berada pada `stores/{storeId}`; toko lama `main`, toko signup `business-{ownerUid}`. Metadata pendaftaran/pengelola dan invoice publik berada di koleksi global. Parent store doc tidak perlu ada. Timestamp memakai Firestore Timestamp; timestamp audit/pembayaran/masuk dari serverTimestamp dan rules request.time. Rupiah integer 0–100.000.000 per subtotal/order dan nilai pembayaran; semua item berjumlah maksimal subtotal tersebut.

| Path | Field utama / penggunaan |
| --- | --- |
| members/{authUid} | role owner/kasir, active bool, name. Pengelola hanya create owner saat approval; edit/tim melalui Console/IAM |
| settings/general | name,address,phone,hours,terms,receivedTemplate,readyTemplate,prefix |
| services/{id} | name,price,days1–90,description,active. Nonaktif tanpa delete |
| customers/{uuid} | name,nameLower,phone628…,notes,createdAt. Update identitas tanpa mengubah createdAt |
| phones/{normalizedPhone} | customerId. Phone lock dibuat/pindah atomik dengan customer |
| orders/{operationUUID} | number unik, customerId/Name/Phone snapshot; items; itemCount/readyCount/allReady/dueAt; subtotal/discount/total/paid/balance; cancelled/collected/active; notes; createdBy/At,updatedAt; version,lastEventId |
| orders/{orderId}/items/{slot1–4} | Mirror map sepatu pada posisi slot-1 dalam list order; validasi setiap map dan transisi oleh rules sendiri; write atomik bersama parent dan audit |
| orderNumbers/{number} | orderId,createdAt. Reservation immutable untuk keunikan nomor |
| payments/{operationId} | orderId,kind payment/refund/void,amount,method tunai/transfer/qris,tendered,change,reason,refId,createdBy/At,orderVersion. Owner histori; kasir hanya hari ini |
| orders/{orderId}/payments/{operationId} | Mirror identik global ledger, append-only; baca detail kasir per order |
| orders/{orderId}/events/{operationId} | kind create/status/collect/cancel/payment/refund/void,reason,actor,createdAt,beforeVersion,afterVersion,paymentId,itemsBefore,itemsAfter |
| voids/{originalPaymentId} | orderId,reversalId,createdAt. Menolak void berulang |
| expenses/{operationUUID} | description,amount,createdBy/At. Owner append-only |

`items` list 1–4, setiap pasang terpisah: id `{orderId}-{1-based}`,description,color,material,size,condition,accessories,serviceId,serviceName,price,notes,dueAt,status0–5,rack. Snapshot awal immutable; notes/rack/status dapat diperbarui bersama audit. Tidak ada gambar/upload.

Audit create menyimpan itemsBefore=[] dan itemsAfter=list awal. Audit status/collect menyimpan kedua list lengkap sebelum dan sesudah, dibandingkan exact terhadap parent oleh rules; sejarah kondisi/catatan/rak/status dapat direkonstruksi tanpa mengubah event sebelumnya. Audit payment/refund/void/cancel memakai kedua list kosong karena item tidak berubah. Ini menambah penyimpanan audit tetapi tetap dibatasi empat map berukuran kecil; pantau kuota. UI menampilkan hanya diff yang bermakna, detail teknis versi/UID tersedia bagi owner.

Status integer: 0 Diterima, 1 Dicuci, 2 Dikeringkan, 3 Quality Check, 4 Siap Diambil, 5 Sudah Diambil. readyCount menghitung status>=4. allReady = readyCount==itemCount. dueAt = estimasi terawal item belum siap; sentinel 2099-01-01 bila semua siap. Aktif = tidak batal dan tidak diambil. Pembayaran sah bersih paid = penerimaan dikurangi refund dan void; balance = total-paid. Tidak menyimpan satu status order independen dari item. Keunikan nomor/customer memakai reservation yang harus sesuai getAfter dokumen induk.

Index file mencakup kombinasi filter equality status/customer, createdAt descending dan range balance/dueAt; index aggregate dashboard active/dueAt serta kind/createdAt ledger. Items/notes tidak di-index untuk mengurangi index entry. Query SDK page25, recent8, layanan100; laporan pagination rentang tanggal bukan listener seluruh histori. Agregasi server tetap memiliki biaya baca index; pantau quota Spark.

Range tambahan pada list order memakai arah DESCENDING mengikuti orderBy(createdAt,desc) SDK, sedangkan aggregate tanpa orderBy memakai ASCENDING. Index juga mencakup active/itemCount/readyCount, active/balance dan kind/createdAt/amount untuk agregasi. Emulator tidak memverifikasi kebutuhan index produksi; deploy index lalu tunggu siap dan lakukan smoke test Firebase project sebenarnya.


## Tambahan signup dan invoice
| Path global | Isi / akses |
| --- | --- |
| platformAdmins/{uid} | active boolean; get sendiri; seluruh write Console/IAM |
| applications/{uid} | name,email,phone,businessName,address,status,storeId,reason,createdAt,reviewedAt,reviewedBy; applicant create pending/get sendiri; admin get/list/review |
| accounts/{uid} | storeId; get sendiri/admin; create admin saat approval, edit Console |
| invoiceShares/{token64hex} | snapshot,storeId,orderId,enabled,createdAt,updatedAt,expiresAt,createdBy; public get enabled/unexpired; list selalu ditolak |

Tambahan pada toko:
- `subscription/access`: status active/suspended, ownerUid,expiresAt,approvedBy,approvedAt,updatedAt,reason. Baca member/admin; tulis pengelola.
- `invoiceLinks/{orderId}`: token; staff get dan write terikat share yang sama. Tidak list/delete.
- applications index status ASC + createdAt DESC untuk halaman admin25. snapshot invoice tidak di-index.

Approval atomik: application approved + account pointer + member owner + settings + subscription. Tidak membuat layanan/harga contoh di toko pelanggan.


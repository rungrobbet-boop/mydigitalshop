# FASE 2: Transformasi UI, Seeding Data, & Fitur Harga Bertingkat (Ecer, Partai, Agen)

Rencana implementasi Fase 2 untuk mentransformasikan antarmuka dari landing page kuliner menjadi platform katalog toko material bangunan **MyDigitalShop**, mengintegrasikan data layer Firestore dengan pagination berbasis kursor (*Load More*), memperbarui skema data menjadi 3 tingkatan harga grosir, serta menyediakan antarmuka dan console runner untuk pengujian seeder.

> [!IMPORTANT]
> **Keputusan Kunci Fase 2**:
> 1. **Zero File Deletion**: Tidak ada file yang dihapus. Modifikasi dilakukan langsung pada file tampilan (`public/index.html`), data seeder (`src/services/seedData.js`), dan adapter service.
> 2. **Skema Harga Bertingkat**: Setiap produk memiliki 3 harga: `priceEcer` (Retail utama), `pricePartai` (Grosir/Wholesale), dan `priceAgen` (Distributor/Agen), disertai satuan unit fisik (`/sak`, `/batang`, `/truk`, `/lembar`, dll.).
> 3. **Uji Coba Seeder Ganda**: Disediakan tombol aksi langsung di antarmuka (banner kontrol pengembang/admin) serta perintah global di Developer Console browser (`window.seedDatabase()` dan `window.testPagination()`).
> 4. **Paginasi On-Demand**: Data dimuat bertahap melalui tombol "Muat Lebih Banyak" (*Load More*) yang memanggil `getProducts({ lastDoc })` secara efisien tanpa read berulang.

---

## 1. Skema Harga Bertingkat (Grosir & Retail)

Skema produk pada `src/services/seedData.js` diperbarui dari harga tunggal menjadi struktur harga berjenjang:

| Field | Tipe | Deskripsi & Contoh |
|---|---|---|
| `priceEcer` | Number | Harga eceran / konsumen umum (misal: Rp 68.000) |
| `pricePartai` | Number | Harga borongan / kontraktor proyek (misal: Rp 64.000) |
| `priceAgen` | Number | Harga toko rekanan / distributor volume besar (misal: Rp 61.000) |
| `unit` | String | Satuan fisik barang (`sak`, `batang`, `truk`, `lembar`, `dus`, `roll`, `kaleng`, `pail`, `pcs`) |
| `minOrderPartai` | Number | Minimal pembelian untuk harga partai (misal: 20 sak) |
| `minOrderAgen` | Number | Minimal pembelian untuk harga agen (misal: 100 sak) |

### Penyesuaian 15 Data Produk Dummy:
1. **Semen Tiga Roda 50kg**: Ecer Rp 68.000 · Partai Rp 64.500 · Agen Rp 62.000 `/sak`
2. **Semen Gresik 40kg**: Ecer Rp 54.000 · Partai Rp 51.500 · Agen Rp 49.500 `/sak`
3. **Pasir Cor Muntilan 1 Truk Colt**: Ecer Rp 950.000 · Partai Rp 900.000 · Agen Rp 860.000 `/truk`
4. **Bata Merah Oven Jumbo**: Ecer Rp 850 · Partai Rp 780 · Agen Rp 720 `/pcs`
5. **Besi Beton Polos 8mm x 12m SNI**: Ecer Rp 45.000 · Partai Rp 42.000 · Agen Rp 39.500 `/batang`
6. **Besi Beton Ulir 10mm x 12m SNI**: Ecer Rp 72.000 · Partai Rp 67.500 · Agen Rp 64.000 `/batang`
7. **Besi Beton Ulir 12mm x 12m SNI**: Ecer Rp 105.000 · Partai Rp 98.000 · Agen Rp 93.000 `/batang`
8. **Baja Ringan Canal C75 0.75mm x 6m**: Ecer Rp 88.000 · Partai Rp 82.500 · Agen Rp 78.000 `/batang`
9. **Cat Tembok Dulux Weathershield 20L**: Ecer Rp 1.450.000 · Partai Rp 1.370.000 · Agen Rp 1.300.000 `/pail`
10. **Cat Kayu & Besi Avian 1kg Hitam**: Ecer Rp 65.000 · Partai Rp 60.000 · Agen Rp 56.500 `/kaleng`
11. **Keramik Mulia Signature 40x40 Putih**: Ecer Rp 58.000 · Partai Rp 53.500 · Agen Rp 50.000 `/dus`
12. **Genteng Metal Pasir Merah 2x4**: Ecer Rp 38.000 · Partai Rp 35.000 · Agen Rp 32.500 `/lembar`
13. **Gypsum Board Jayaboard 9mm**: Ecer Rp 75.000 · Partai Rp 70.000 · Agen Rp 66.500 `/lembar`
14. **Pipa PVC Rucika D 3 Inch x 4m**: Ecer Rp 82.000 · Partai Rp 76.000 · Agen Rp 71.500 `/batang`
15. **Kawat Bendrat Pengikat 1 Roll 20kg**: Ecer Rp 320.000 · Partai Rp 295.000 · Agen Rp 280.000 `/roll`

---

## 2. Antarmuka Uji Coba Seeder & Console Runner

Memudahkan verifikasi data masuk ke Cloud Firestore secara instan melalui 2 cara:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [🌱 SEEDER TOOLBAR] Status: Siap (Cloud Firestore)                     │
│ [ Tombol: Jalankan Seeder (15 Produk) ]  [ Tombol: Uji Paginasi ]      │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Floating Dev Seeder Widget di Halaman Utama**:
   - Ditempatkan di bagian bawah/admin quick bar (atau banner developer yang bersih dan dapat di-minimize).
   - Menampilkan status realtime saat seeding berjalan, jumlah kategori & produk yang tersimpan, serta hasil verifikasi paginasi.
2. **Global Browser Console Functions**:
   - `window.seedDatabase()`: Menjalankan `seedProductsAndCategories()` langsung dari DevTools Console.
   - `window.testPagination(pageSize)`: Memanggil `testPaginationDemo()` dan mencetak `console.table()` hasil halaman 1 dan halaman 2 beserta kursor dokumen `lastDoc`.

---

## 3. Redesain Visual & Rebranding Toko Bangunan (Industrial Theme)

Sesuai panduan *Domain-Native Frontend Design* (Industrial & E-Commerce):

- **Brand & Penamaan**:
  - Ganti seluruh teks "Dapur Kuliner Viral" $\to$ **"MyDigitalShop — Pusat Material & Bahan Bangunan"**.
  - Headline Utama: *"Pusat Material Bangunan & Konstruksi Terlengkap"*.
  - Subheadline: *"Suplai kebutuhan semen, besi SNI, baja ringan, cat, dan pipa untuk proyek konstruksi, toko bangunan, dan renovasi rumah. Melayani pesanan eceran, partai besar, dan harga khusus agen."*
- **Palet Warna Industrial Steel & Safety Accent (60-30-10)**:
  - **Canvas (60%)**: Latar belakang bersih `bg-slate-50` / `bg-white` dengan tekstur industrial yang tenang.
  - **Surfaces & Typography (30%)**: Deep Slate (`#0f172a`, `text-slate-900`), border hairline baja `border-slate-200`, dan teks pendukung `text-slate-600`.
  - **Accent Budget (10%)**: Industrial Steel Blue (`#1d4ed8` / `#2563eb`) untuk tombol beli dan filter aktif, dikombinasikan dengan sentuhan safety amber (`#d97706`) untuk tag harga partai/agen.
- **Hero Banner**:
  - Menggantikan foto makanan/dapur dengan visual gudang material modern, baja konstruksi, atau tumpukan semen terorganisir yang rapi.
- **Top Bar Contract**:
  - Brand satu baris: **MyDigitalShop** `Material Bangunan`.
  - Navigasi ringkas: *Katalog Produk*, *Harga Grosir*, *Hitung Kebutuhan*, *Kontak & Pengiriman*.
  - CTA Utama: *Konsultasi Proyek & WhatsApp*.

---

## 4. Desain Kartu Produk (Tingkat Harga Ecer, Partai, Agen)

Kartu produk didesain khusus untuk kebutuhan B2C dan B2B toko bangunan:

```
┌─────────────────────────────────────────────────────────┐
│ [ Foto Produk Material / Placeholder Rapi ]            │
│ Semen & Pasir · SKU: SMN-TR-50KG                        │
│                                                         │
│ Semen Tiga Roda 50kg                                    │
│ Semen Portland Composite SNI untuk cor dan plesteran    │
│                                                         │
│ Rp 68.000 /sak                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  Partai: Rp 64.500/sak   │   Agen: Rp 62.000/sak    │ │
│ └─────────────────────────────────────────────────────┘ │
│ Stok: 250 sak  ·  Min. Ecer: 5 sak                      │
│                                                         │
│ [ + Tambah ke Keranjang ]                               │
└─────────────────────────────────────────────────────────┘
```

- **Harga Utama (Eceran)**: Ditampilkan tegas dengan font tebal (`text-lg font-bold text-slate-900 tabular-nums`) disertai teks satuan (`/sak`, `/batang`).
- **Strip Harga Grosir (Partai & Agen)**: Ditampilkan dalam kotak ringkas bersudut halus di bawah harga utama:
  - *Partai*: `Rp 64.500/sak` (min. 20 sak).
  - *Agen*: `Rp 62.000/sak` (min. 100 sak).
- **Interaksi Keranjang**: Tombol beli yang fleksibel untuk memilih kuantiti dan secara otomatis menghitung tier harga yang didapat pembeli.

---

## 5. Koneksi UI ke Firestore & Paginasi "Muat Lebih Banyak"

- **Inisialisasi Katalog**:
  - Halaman memuat batch awal produk (misal: 6 atau 8 produk pertama) via `getProducts({ limit: 8, categoryId: activeCategory })`.
  - Menyimpan referensi kursor `lastDoc` di state Alpine/JavaScript.
- **Tombol "Muat Lebih Banyak" (Load More)**:
  - Muncul di bawah grid produk selama `hasMore === true`.
  - Saat diklik, memicu `loadMoreProducts()` dengan memanggil `getProducts({ limit: 8, lastDoc, categoryId: activeCategory })`.
  - Menambahkan dokumen baru ke array produk yang sedang tampil secara mulus tanpa me-reload halaman.
  - Menampilkan skeleton/spinner saat memuat, dan teks *"Semua produk telah ditampilkan"* saat `hasMore === false`.
- **Filter Kategori**:
  - Mengambil daftar kategori dari `getCategories()` Firestore.
  - Memilih kategori akan mereset kursor `lastDoc = null` dan mengambil batch pertama kategori tersebut via `getProducts({ categoryId, limit: 8 })`.

---

## 6. Verifikasi & Langkah Kerja

1. **Update `src/services/seedData.js`**:
   - Memasukkan skema harga `priceEcer`, `pricePartai`, `priceAgen`, dan satuan `unit`.
2. **Update Adapter `src/services/firestoreService.js`**:
   - Memastikan compatibility filter kategori dan field sorting.
3. **Update UI pada `public/index.html`**:
   - Mengubah copy & branding ke MyDigitalShop Toko Bangunan.
   - Mengintegrasikan modul Firestore `getProducts`, `seedProductsAndCategories`, dan `testPaginationDemo`.
   - Mengganti template kartu produk dengan 3 harga bertingkat.
   - Memasang tombol dev seeder & tombol "Muat Lebih Banyak".
4. **Verifikasi Kompilasi & Server**:
   - Menjalankan `compile_applet` dan `lint_applet`.
   - Memastikan server berjalan stabil di port 3000.

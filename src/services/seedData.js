/**
 * Seed Data Bahan Bangunan (Skema Harga Bertingkat: Ecer, Partai, Agen)
 * 
 * Berisi 15 data produk bahan bangunan (Semen, Cat, Besi, Pasir, dll)
 * dengan 3 level harga grosir (priceEcer, pricePartai, priceAgen) dan satuan fisik.
 */

import { addCategory, addProduct, getProducts, getCategories } from "./firestoreService.js";

export const CATEGORIES_SEED = [
  {
    id: "semen-pasir",
    name: "Semen & Pasir",
    slug: "semen-pasir",
    icon: "fa-cubes",
    description: "Semen Portland, semen instan/mortar, pasir cor, dan agregat bangunan"
  },
  {
    id: "besi-baja",
    name: "Besi & Baja Ringan",
    slug: "besi-baja",
    icon: "fa-shield-halved",
    description: "Besi beton SNI polos/ulir, kanal C baja ringan, hollow, kawat bendrat"
  },
  {
    id: "cat-finishing",
    name: "Cat & Finishing",
    slug: "cat-finishing",
    icon: "fa-paint-roller",
    description: "Cat tembok interior/eksterior, cat kayu & besi, waterproofing, thinner"
  },
  {
    id: "keramik-lantai",
    name: "Keramik & Lantai",
    slug: "keramik-lantai",
    icon: "fa-border-all",
    description: "Keramik lantai, granit tile, plint, dan semen nat"
  },
  {
    id: "atap-plafon",
    name: "Atap & Plafon",
    slug: "atap-plafon",
    icon: "fa-house-chimney",
    description: "Genteng metal pasir, seng gelombang, gypsum board Jayaboard, rangka plafon"
  },
  {
    id: "plumbing-pipa",
    name: "Plumbing & Sanitari",
    slug: "plumbing-pipa",
    icon: "fa-faucet-drip",
    description: "Pipa PVC tipe AW/D Rucika, fitting sambungan, kran air, lem pipa"
  }
];

export const PRODUCTS_SEED = [
  {
    id: "PROD-SMN-001",
    name: "Semen Tiga Roda 50kg",
    categoryId: "semen-pasir",
    categoryName: "Semen & Pasir",
    priceEcer: 68000,
    pricePartai: 64500,
    priceAgen: 62000,
    price: 68000, // Fallback backward-compatible
    unit: "/sak",
    minOrderPartai: 20,
    minOrderAgen: 100,
    stock: 250,
    description: "Semen Portland Composite (PCC) standar SNI mutu terjamin untuk struktur beton dan plesteran.",
    sku: "SMN-TR-50KG",
    weightGram: 50000,
    image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-SMN-002",
    name: "Semen Gresik 40kg",
    categoryId: "semen-pasir",
    categoryName: "Semen & Pasir",
    priceEcer: 54000,
    pricePartai: 51500,
    priceAgen: 49500,
    price: 54000,
    unit: "/sak",
    minOrderPartai: 20,
    minOrderAgen: 100,
    stock: 180,
    description: "Semen PCC serbaguna untuk pasangan bata, plesteran, dan cor beton rumah tinggal.",
    sku: "SMN-GRS-40KG",
    weightGram: 40000,
    image: "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-PSR-003",
    name: "Pasir Cor Muntilan 1 Truk Colt",
    categoryId: "semen-pasir",
    categoryName: "Semen & Pasir",
    priceEcer: 950000,
    pricePartai: 900000,
    priceAgen: 860000,
    price: 950000,
    unit: "/truk",
    minOrderPartai: 3,
    minOrderAgen: 10,
    stock: 15,
    description: "Pasir hitam muntilan bersih bebas lumpur, sangat kuat untuk struktur cor beton pondasi dan dak.",
    sku: "PSR-MNT-1TRK",
    weightGram: 4000000,
    image: "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-BTA-004",
    name: "Bata Merah Oven Jumbo",
    categoryId: "semen-pasir",
    categoryName: "Semen & Pasir",
    priceEcer: 850,
    pricePartai: 780,
    priceAgen: 720,
    price: 850,
    unit: "/pcs",
    minOrderPartai: 2000,
    minOrderAgen: 10000,
    stock: 12000,
    description: "Bata merah press bakar matang padat, presisi tinggi dan tidak mudah patah.",
    sku: "BTA-OVEN-JMB",
    weightGram: 1800,
    image: "https://images.unsplash.com/photo-1584463699039-445657788876?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-BSI-005",
    name: "Besi Beton Polos 8mm x 12m SNI",
    categoryId: "besi-baja",
    categoryName: "Besi & Baja Ringan",
    priceEcer: 45000,
    pricePartai: 42000,
    priceAgen: 39500,
    price: 45000,
    unit: "/batang",
    minOrderPartai: 50,
    minOrderAgen: 200,
    stock: 400,
    description: "Besi beton polos SNI TP280 panjang 12 meter toleransi resmi untuk begel sloof/kolom.",
    sku: "BSI-PLS-8MM-12M",
    weightGram: 4740,
    image: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-BSI-006",
    name: "Besi Beton Ulir 10mm x 12m SNI",
    categoryId: "besi-baja",
    categoryName: "Besi & Baja Ringan",
    priceEcer: 72000,
    pricePartai: 67500,
    priceAgen: 64000,
    price: 72000,
    unit: "/batang",
    minOrderPartai: 50,
    minOrderAgen: 200,
    stock: 350,
    description: "Besi ulir deform SNI TS280 daya lekat beton tinggi untuk tulangan kolom & balok.",
    sku: "BSI-ULR-10MM-12M",
    weightGram: 7400,
    image: "https://images.unsplash.com/photo-1533090161767-e6ffed986b88?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-BSI-007",
    name: "Besi Beton Ulir 12mm x 12m SNI",
    categoryId: "besi-baja",
    categoryName: "Besi & Baja Ringan",
    priceEcer: 105000,
    pricePartai: 98000,
    priceAgen: 93000,
    price: 105000,
    unit: "/batang",
    minOrderPartai: 30,
    minOrderAgen: 150,
    stock: 280,
    description: "Besi ulir mutu SNI untuk struktur beton bertulang utama bangunan bertingkat.",
    sku: "BSI-ULR-12MM-12M",
    weightGram: 10650,
    image: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-BJA-008",
    name: "Baja Ringan Canal C75 0.75mm x 6m",
    categoryId: "besi-baja",
    categoryName: "Besi & Baja Ringan",
    priceEcer: 88000,
    pricePartai: 82500,
    priceAgen: 78000,
    price: 88000,
    unit: "/batang",
    minOrderPartai: 30,
    minOrderAgen: 100,
    stock: 200,
    description: "Truss C75 full 0.75mm Zincalume/Galvalume anti karat untuk kuda-kuda atap kokoh.",
    sku: "BJA-C75-075-6M",
    weightGram: 5200,
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-CAT-009",
    name: "Cat Tembok Dulux Weathershield 20L",
    categoryId: "cat-finishing",
    categoryName: "Cat & Finishing",
    priceEcer: 1450000,
    pricePartai: 1370000,
    priceAgen: 1300000,
    price: 1450000,
    unit: "/pail",
    minOrderPartai: 3,
    minOrderAgen: 10,
    stock: 25,
    description: "Cat eksterior premium pelindung cuaca ekstrem, anti jamur, anti lumut dengan daya tahan 8 tahun.",
    sku: "CAT-DLX-WTH-20L",
    weightGram: 26000,
    image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-CAT-010",
    name: "Cat Kayu & Besi Avian 1kg Hitam Gloss",
    categoryId: "cat-finishing",
    categoryName: "Cat & Finishing",
    priceEcer: 65000,
    pricePartai: 60000,
    priceAgen: 56500,
    price: 65000,
    unit: "/kaleng",
    minOrderPartai: 12,
    minOrderAgen: 48,
    stock: 90,
    description: "Cat enamel sintetis kilap tinggi tahan cuaca untuk pagar besi, pintu, dan kusen kayu.",
    sku: "CAT-AVN-1KG-BLK",
    weightGram: 1100,
    image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-KRM-011",
    name: "Keramik Lantai Mulia Signature 40x40 Putih",
    categoryId: "keramik-lantai",
    categoryName: "Keramik & Lantai",
    priceEcer: 58000,
    pricePartai: 53500,
    priceAgen: 50000,
    price: 58000,
    unit: "/dus",
    minOrderPartai: 25,
    minOrderAgen: 100,
    stock: 300,
    description: "Keramik glossy grade 1 (KW 1) isi 6 keping (0.96m2) warna putih bersih elegan.",
    sku: "KRM-MLA-40X40-WHT",
    weightGram: 15500,
    image: "https://images.unsplash.com/photo-1584463699039-445657788876?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-GTG-012",
    name: "Genteng Metal Pasir Merah 2x4",
    categoryId: "atap-plafon",
    categoryName: "Atap & Plafon",
    priceEcer: 38000,
    pricePartai: 35000,
    priceAgen: 32500,
    price: 38000,
    unit: "/lembar",
    minOrderPartai: 50,
    minOrderAgen: 200,
    stock: 500,
    description: "Genteng baja lapis batu pasir warna merah bata, meredam panas dan suara hujan.",
    sku: "GTG-MTL-PSR-MRH",
    weightGram: 1400,
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-GYP-013",
    name: "Gypsum Board Jayaboard Sheetrock 9mm",
    categoryId: "atap-plafon",
    categoryName: "Atap & Plafon",
    priceEcer: 75000,
    pricePartai: 70000,
    priceAgen: 66500,
    price: 75000,
    unit: "/lembar",
    minOrderPartai: 20,
    minOrderAgen: 100,
    stock: 150,
    description: "Papan gypsum plafon bobot ringan, anti lendut dengan teknologi sag-defying strength.",
    sku: "GYP-JAY-9MM-STD",
    weightGram: 14800,
    image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-PPA-014",
    name: "Pipa PVC Rucika D 3 Inch x 4m",
    categoryId: "plumbing-pipa",
    categoryName: "Plumbing & Sanitari",
    priceEcer: 82000,
    pricePartai: 76000,
    priceAgen: 71500,
    price: 82000,
    unit: "/batang",
    minOrderPartai: 10,
    minOrderAgen: 50,
    stock: 85,
    description: "Pipa saluran pembuangan air kotor Rucika Standard D tebal kuat dan tidak mudah pecah.",
    sku: "PPA-RCK-D3IN-4M",
    weightGram: 3800,
    image: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "PROD-BND-015",
    name: "Kawat Bendrat Pengikat 1 Roll 20kg",
    categoryId: "besi-baja",
    categoryName: "Besi & Baja Ringan",
    priceEcer: 320000,
    pricePartai: 295000,
    priceAgen: 280000,
    price: 320000,
    unit: "/roll",
    minOrderPartai: 5,
    minOrderAgen: 20,
    stock: 40,
    description: "Kawat kawat beton hitam lunak mudah ditekuk untuk mengikat rangkaian besi tulangan.",
    sku: "KWT-BND-20KG",
    weightGram: 20000,
    image: "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=600&auto=format&fit=crop&q=80"
  }
];

/**
 * Menjalankan proses seeding kategori dan produk ke Firestore
 * @returns {Promise<{ success: boolean, categoriesCount: number, productsCount: number, message: string }>}
 */
export async function seedProductsAndCategories() {
  console.log("[Seeder] Memulai proses seeding data bahan bangunan ke Firestore...");

  // 1. Seed Kategori
  let seededCategories = 0;
  for (const cat of CATEGORIES_SEED) {
    try {
      await addCategory(cat);
      seededCategories++;
    } catch (err) {
      console.warn(`[Seeder] Gagal seed kategori ${cat.name}:`, err);
    }
  }
  console.log(`[Seeder] Sukses memasukkan ${seededCategories}/${CATEGORIES_SEED.length} kategori.`);

  // 2. Seed Produk
  let seededProducts = 0;
  for (const prod of PRODUCTS_SEED) {
    try {
      await addProduct(prod);
      seededProducts++;
    } catch (err) {
      console.warn(`[Seeder] Gagal seed produk ${prod.name}:`, err);
    }
  }
  console.log(`[Seeder] Sukses memasukkan ${seededProducts}/${PRODUCTS_SEED.length} produk bahan bangunan.`);

  return {
    success: true,
    categoriesCount: seededCategories,
    productsCount: seededProducts,
    message: `Berhasil menambahkan ${seededCategories} kategori dan ${seededProducts} produk bahan bangunan dengan 3 tingkat harga (Ecer, Partai, Agen) ke Firestore!`
  };
}

/**
 * Helper untuk menguji mekanisme pagination getProducts()
 * @param {number} pageSize Jumlah per halaman untuk tes (default 5)
 */
export async function testPaginationDemo(pageSize = 5) {
  console.log(`[Pagination Test] Menguji fetch halaman 1 (limit: ${pageSize})...`);
  const page1 = await getProducts({ limit: pageSize, orderByField: "name", orderDirection: "asc" });
  console.log(`[Pagination Test] Halaman 1 diterima: ${page1.products.length} produk. hasMore: ${page1.hasMore}`);
  console.table(
    page1.products.map(p => ({
      ID: p.id,
      Nama: p.name,
      "Eceran (Rp)": p.priceEcer || p.price,
      "Partai (Rp)": p.pricePartai || "-",
      "Agen (Rp)": p.priceAgen || "-",
      Satuan: p.unit || "/pcs",
      Kategori: p.categoryName
    }))
  );

  if (page1.hasMore && page1.lastDoc) {
    console.log(`[Pagination Test] Menguji fetch halaman 2 menggunakan startAfter(page1.lastDoc)...`);
    const page2 = await getProducts({
      limit: pageSize,
      lastDoc: page1.lastDoc,
      orderByField: "name",
      orderDirection: "asc"
    });
    console.log(`[Pagination Test] Halaman 2 diterima: ${page2.products.length} produk. hasMore: ${page2.hasMore}`);
    console.table(
      page2.products.map(p => ({
        ID: p.id,
        Nama: p.name,
        "Eceran (Rp)": p.priceEcer || p.price,
        "Partai (Rp)": p.pricePartai || "-",
        "Agen (Rp)": p.priceAgen || "-",
        Satuan: p.unit || "/pcs",
        Kategori: p.categoryName
      }))
    );
    return { success: true, page1, page2 };
  }

  return { success: true, page1 };
}

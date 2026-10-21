    import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import {
      getFirestore,
      initializeFirestore,
      collection, 
      doc, 
      getDocs, 
      getDoc, 
      setDoc, 
      addDoc, 
      updateDoc, 
      deleteDoc, 
      query, 
      where, 
      orderBy, 
      limit, 
      startAfter, 
      onSnapshot,
      writeBatch 
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
    // ✅ OPTIMASI: firebase-auth.js tidak di-import — tidak dipakai (auth anonim skip)
    import { firebaseConfig, IS_DEMO_MODE } from "../public/firebase-config.js";

    // Cloud Firestore Data Layer & Seeder Services
    import * as firestoreService from "./services/firestoreService.js";
    import * as seedData from "./services/seedData.js";

    // Inisialisasi Firebase & Dynamic Custom Configuration
    let app, db, firestoreDb, auth;
    let activeFirebaseConfig = { ...firebaseConfig };

    // Selalu prioritaskan setelan manual di browser local storage jika ada
    try {
      const storedCustom = localStorage.getItem("dapur_firebase_custom_config");
      if (storedCustom) {
        const parsed = JSON.parse(storedCustom);
        if (parsed && parsed.apiKey && !parsed.apiKey.includes("YOUR_FIREBASE")) {
          activeFirebaseConfig = parsed;
        }
      }
    } catch (e) {
      console.warn("Error reading stored custom firebase config:", e);
    }

    function initFirebaseModule(cfg) {
      try {
        if (cfg && cfg.apiKey && !cfg.apiKey.includes("YOUR_FIREBASE")) {
          // Pastikan projectId valid sebelum inisialisasi Firestore
          if (!cfg.projectId) {
            throw new Error("projectId tidak valid dalam firebaseConfig");
          }
          // Singleton pattern: pakai getApps() — jika DEFAULT app sudah ada, gunakan getApp();
          // jika belum ada, baru inisialisasi dengan initializeApp(cfg).
          const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(cfg);
          app = firebaseApp;
          firestoreDb = initializeFirestore(app, { experimentalForceLongPolling: true });
          // RTDB hanya dihubungkan jika databaseURL tersedia (project ini menggunakan Firestore untuk realtime data);
          // memanggil getDatabase(app) tanpa databaseURL memicu FATAL ERROR "Can't determine Firebase Database URL".
          if (cfg.databaseURL) {
            try { db = getDatabase(app); } catch (_) {}
          }
          console.log("[FIREBASE] Cloud Firestore connected:", cfg.projectId);
          return true;
        }
      } catch (e) {
        console.warn("Firebase initialize fallback:", e);
      }
      firestoreDb = null;
      db = null;
      auth = null;
      return false;
    }

    initFirebaseModule(activeFirebaseConfig);

    // Expose helpers ke window untuk Alpine.js
    window.FirebaseBridge = {
      isDemo: () => !db,
      getConfig: () => ({ ...activeFirebaseConfig }),
      getDatabaseStatus: () => ({
        isConnected: Boolean(db),
        isDemo: !Boolean(db),
        projectId: activeFirebaseConfig.projectId || 'Demo Mode (Lokal)',
        databaseURL: activeFirebaseConfig.databaseURL || 'LocalStorage Browser',
        storageBucket: activeFirebaseConfig.storageBucket || '-',
        mode: db ? 'Firebase Realtime Cloud Database' : 'LocalStorage Offline (Demo Mode)'
      }),
      applyNewConfig: (newCfg) => {
        activeFirebaseConfig = { ...newCfg };
        localStorage.setItem("dapur_firebase_custom_config", JSON.stringify(newCfg));
        return initFirebaseModule(activeFirebaseConfig);
      },
      testConnection: async () => {
        if (!db) {
          return { success: false, message: "Kredensial Firebase belum lengkap atau masih menggunakan placeholder default." };
        }
        try {
          const testRef = ref(db, 'system_ping');
          await set(testRef, {
            pingAt: new Date().toISOString(),
            status: "OK",
            client: "Admin CMS Dapur Kuliner Viral"
          });
          return { success: true, message: "Koneksi Realtime Database BERHASIL! Sinkronisasi multi-device aktif." };
        } catch (err) {
          const msg = err.message || err;
          if (msg.includes("Permission denied") || msg.includes("PERMISSION_DENIED")) {
            return { success: true, message: "Jalur Koneksi BERHASIL! Namun Firebase memblokir penulisan data karena aturan keamanan (Security Rules) belum dikonfigurasi." };
          }
          return { success: false, message: "Gagal menghubungkan ke Firebase: " + msg };
        }
      },
      saveOrder: async (orderData) => {
        if (db) {
          const orderRef = ref(db, `orders/${orderData.orderId}`);
          await set(orderRef, orderData);
          const statusRef = ref(db, `status/${orderData.orderId}`);
          await set(statusRef, orderData.status);
        } else {
          // LocalStorage fallback jika Firebase belum diset
          const existing = JSON.parse(localStorage.getItem("dapur_orders") || "{}");
          existing[orderData.orderId] = orderData;
          localStorage.setItem("dapur_orders", JSON.stringify(existing));
        }
      },

      // FASE 4: Batch write produk ke Firestore (maksimal 500 produk per eksekusi)
      batchWriteFirestore: async ({ collectionName, docs, maxPerBatch = 500 }) => {
        if (!firestoreDb) {
          return { success: 0, failed: docs.length, total: docs.length, errors: ['Firestore belum terhubung'] };
        }
        const result = { success: 0, failed: 0, total: docs.length, errors: [] };
        const numericFields = ['priceEcer', 'pricePartai', 'priceAgen', 'minOrderPartai', 'minOrderAgen', 'stock', 'purchasePrice'];
        const stringFields = ['name', 'categoryId', 'category', 'categoryLabel', 'categoryName', 'unit', 'image', 'imageUrl', 'id', 'supplier'];
        // Batasi batch agar tidak melebihi 500 operasi per commit (batas Firestore)
        const effectiveMax = Math.min(maxPerBatch, 500);
        for (let i = 0; i < docs.length; i += effectiveMax) {
          const chunk = docs.slice(i, i + effectiveMax);
          try {
            const batch = writeBatch(firestoreDb);
            chunk.forEach((docData) => {
              // Sanitasi ketat: pastikan tidak ada undefined/null/NaN sebelum writeBatch.set()
              const cleanData = {};
              // Field angka -> Number(), default 0, NaN -> 0
              numericFields.forEach((key) => {
                const val = docData[key];
                const num = Number(val);
                cleanData[key] = isNaN(num) ? 0 : num;
              });
              // Field string -> String(), undefined/null -> ''
              stringFields.forEach((key) => {
                const val = docData[key];
                cleanData[key] = (val === undefined || val === null) ? '' : String(val);
              });
              // Field tanggal sebagai string ISO
              cleanData.createdAt = String(docData.createdAt || new Date().toISOString());
              cleanData.updatedAt = String(docData.updatedAt || new Date().toISOString());
              // Verifikasi akhir: pastikan tidak ada nilai undefined/NaN yang lolos
              for (const [k, v] of Object.entries(cleanData)) {
                if (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) {
                  cleanData[k] = typeof v === 'number' ? 0 : '';
                }
              }
              // Sinkronisasi image & imageUrl: jika salah satu kosong, isi dari yang lain
              if (cleanData.imageUrl && !cleanData.image) cleanData.image = cleanData.imageUrl;
              if (cleanData.image && !cleanData.imageUrl) cleanData.imageUrl = cleanData.image;
              // Gunakan docData.id jika tersedia dan non-kosong (untuk overwrite/re-import),
              // pakai doc(collectionRef, docId) yang benar untuk Firestore v9 modular SDK.
              // Hindari doc(db, collectionName) tanpa doc ID (1 segment = error "even number of segments").
              const docRef = (docData.id && String(docData.id).trim() !== '')
                ? doc(collection(firestoreDb, collectionName), String(docData.id))
                : doc(collection(firestoreDb, collectionName));
              console.log("DATA YANG AKAN DIKIRIM:", cleanData);
              batch.set(docRef, cleanData);
            });
            await batch.commit();
            result.success += chunk.length;
          } catch (err) {
            result.failed += chunk.length;
            result.errors.push({ start: i, count: chunk.length, message: err.message || err });
          }
        }
        return result;
      },
      listenOrder: (orderId, callback) => {
        if (db) {
          const statusRef = ref(db, `orders/${orderId}/status`);
          return onValue(statusRef, (snapshot) => {
            const val = snapshot.val();
            if (val) callback(val);
          });
        } else {
          // Polling local storage untuk demo
          const interval = setInterval(() => {
            const existing = JSON.parse(localStorage.getItem("dapur_orders") || "{}");
            if (existing[orderId] && existing[orderId].status) {
              callback(existing[orderId].status);
            }
          }, 2000);
          return () => clearInterval(interval);
        }
      },
      listenAllOrders: (callback) => {
        if (db) {
          const ordersRef = ref(db, 'orders');
          return onValue(ordersRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
              const ordersArray = Object.values(val);
              ordersArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              callback(ordersArray);
            } else {
              callback([]);
            }
          });
        } else {
          const interval = setInterval(() => {
            const existing = JSON.parse(localStorage.getItem("dapur_orders") || "{}");
            const ordersArray = Object.values(existing);
            ordersArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            callback(ordersArray);
          }, 5000);
          return () => clearInterval(interval);
        }
      },
      updateStatus: async (orderId, status) => {
        if (db) {
          const orderRef = ref(db, `orders/${orderId}`);
          await update(orderRef, { status: status, updatedAt: new Date().toISOString() });
        } else {
          const existing = JSON.parse(localStorage.getItem("dapur_orders") || "{}");
          if (existing[orderId]) {
            existing[orderId].status = status;
            localStorage.setItem("dapur_orders", JSON.stringify(existing));
          }
        }
      },
      // Realtime Database persistence untuk Konfigurasi Website (Admin CMS)
            saveSiteConfig: async (config) => {
        // Simpan ke localStorage DULU (agar tidak hilang walau Firebase error)
        try {
          localStorage.setItem("dapur_site_config", JSON.stringify(config));
        } catch (e) {
          console.warn("localStorage saveSiteConfig error:", e);
        }
        if (db) {
          try {
            const cleanConfig = JSON.parse(JSON.stringify(config));
            const configRef = ref(db, 'site_config');
            await set(configRef, cleanConfig);
          } catch (err) {
            console.warn("Firebase saveSiteConfig error (localStorage tetap tersimpan):", err);
          }
        }
      },
      listenSiteConfig: (callback) => {
        if (db) {
          const configRef = ref(db, 'site_config');
          return onValue(configRef, (snapshot) => {
            const val = snapshot.val();
            if (val) callback(val);
          });
        }
        return () => {};
      },
      // Realtime Database persistence untuk Daftar Menu & Promo (Admin CMS)
            saveMenu: async (items) => {
        try {
          localStorage.setItem("dapur_menu_items", JSON.stringify(items));
        } catch (e) {}
        if (db) {
          try {
            const cleanItems = JSON.parse(JSON.stringify(items));
            const menuRef = ref(db, 'menu_items');
            await set(menuRef, cleanItems);
          } catch (err) {
            console.warn("Firebase saveMenu error:", err);
          }
        }
      },
        listenMenu: (callback) => {
        if (db) {
          const menuRef = ref(db, 'menu_items');
          return onValue(menuRef, (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === 'object') {
              // ✅ FIX: Inject Firebase key sebagai 'id' kalau missing
              let rawArr;
              if (Array.isArray(val)) {
                rawArr = val.map((item, idx) => {
                  if (!item || typeof item !== 'object') return null;
                  return { ...item, id: item.id || ('auto_' + idx) };
                }).filter(Boolean);
              } else {
                rawArr = Object.entries(val).map(([key, item]) => {
                  if (!item || typeof item !== 'object') return null;
                  return { ...item, id: item.id || key };
                }).filter(Boolean);
              }

              // ✅ FIX: DEDUP by ID — BUANG duplikat, jangan rename
              const seen = new Set();
              const arr = [];
              rawArr.forEach((item) => {
                const uid = item && item.id ? String(item.id) : '';
                if (!uid || seen.has(uid)) return;
                seen.add(uid);
                arr.push(item);
              });

              callback(arr);
            } else {
              callback([]); // Explicit empty (bukan undefined)
            }
          });
        }
        return () => {};
      },
      // Realtime Database persistence untuk Kategori Menu (Admin CMS)
      saveCategories: async (cats) => {
        try {
          localStorage.setItem("dapur_menu_categories", JSON.stringify(cats));
        } catch (e) {}
        if (db) {
          try {
            const cleanCats = JSON.parse(JSON.stringify(cats));
            const catRef = ref(db, 'menu_categories');
            await set(catRef, cleanCats);
          } catch (err) {
            console.warn("Firebase saveCategories error:", err);
          }
        }
      },
      listenCategories: (callback) => {
        if (db) {
          const catRef = ref(db, 'menu_categories');
          return onValue(catRef, (snapshot) => {
            const val = snapshot.val();
            if (val && Array.isArray(val)) callback(val);
          });
        }
        return () => {};
      },
      // ✅ FIX: Realtime listener inventory untuk join stock ke menu
      listenInventory: (callback) => {
        if (db) {
          const invRef = ref(db, 'inventory');
          return onValue(invRef, (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === 'object') {
              const list = Array.isArray(val)
                ? val.map((item, idx) => item && typeof item === 'object' ? { ...item, id: item.id || ('inv_' + idx) } : null).filter(Boolean)
                : Object.entries(val).map(([key, item]) => {
                    if (!item || typeof item !== 'object') return null;
                    return { ...item, id: item.id || key };
                  }).filter(Boolean);
              callback(list);
            } else {
              callback([]);
            }
          });
        }
        return () => {};
      },
      // ==== RTO (BLOK BARU): listener status order online ====
      listenOnlineOrder: (orderId, callback) => {
        if (db && orderId) {
          const rtoOrderRef = ref(db, 'online_orders/' + orderId);
          return onValue(rtoOrderRef, (snapshot) => {
            const val = snapshot.val();
            if (callback) callback(val || null);
          });
        }
        return () => {};
      },
      listenOnlineOrders: (callback) => {
        if (db) {
          const rtoListRef = ref(db, 'online_orders');
          return onValue(rtoListRef, (snapshot) => {
            const val = snapshot.val();
            const list = (val && typeof val === 'object')
              ? Object.entries(val).map(([key, o]) => (o && typeof o === 'object') ? { ...o, orderId: o.orderId || key } : null).filter(Boolean)
              : [];
            if (callback) callback(list);
          });
        }
        return () => {};
      },
      // ==== /RTO ====
      listenMenuRecipes: (callback) => {
        if (db) {
          const recRef = ref(db, 'menu_recipes');
          return onValue(recRef, (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === 'object') {
              try { localStorage.setItem('pos_menu_recipes', JSON.stringify(val)); } catch (e) {}
              callback(val);
            } else {
              callback({});
            }
          });
        }
        return () => {};
      },
      // Cloud Firestore Data Layer & Seeder Functions
      getProducts: firestoreService.getProducts,
      getProductById: firestoreService.getProductById,
      addProduct: firestoreService.addProduct,
      updateProduct: firestoreService.updateProduct,
      deleteProduct: firestoreService.deleteProduct,
      getCategories: firestoreService.getCategories,
      addCategory: firestoreService.addCategory,
      updateCategory: firestoreService.updateCategory,
      deleteCategory: firestoreService.deleteCategory,
      onAdminProductsSnapshot: firestoreService.onAdminProductsSnapshot,
      seedProductsAndCategories: seedData.seedProductsAndCategories,
      testPaginationDemo: seedData.testPaginationDemo,
      PRODUCTS_SEED: seedData.PRODUCTS_SEED,
      CATEGORIES_SEED: seedData.CATEGORIES_SEED
    };

    // Expose global helpers ke window untuk Console F12 dan Alpine
    window.FirestoreService = firestoreService;
    window.SeedData = seedData;
    window.seedProductsAndCategories = seedData.seedProductsAndCategories;
    window.testPaginationDemo = seedData.testPaginationDemo;
    window.getFirestoreProducts = firestoreService.getProducts;

    // Beri tahu Alpine bahwa FirebaseBridge & Firestore sudah siap
    window.dispatchEvent(new CustomEvent('firebase-bridge-ready'));

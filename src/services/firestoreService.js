/**
 * Cloud Firestore Service
 * 
 * Modul data layer untuk interaksi dengan Cloud Firestore.
 * Menangani inisialisasi Firebase & Firestore serta operasi data untuk koleksi
 * 'products' (dengan pagination berbasis kursor startAfter) dan 'categories'.
 * 
 * CATATAN: databaseURL pada konfigurasi RTDB sengaja diabaikan untuk fokus murni pada Cloud Firestore.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot
} from "firebase/firestore";

// Konfigurasi Firebase diambil dari public/firebase-config.js (single source of truth)
import { firebaseConfig } from "../../public/firebase-config.js";

// Inisialisasi Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inisialisasi Cloud Firestore
export const db = getFirestore(app);


  // 2. Cek Environment variables (Vite import.meta.env atau process.env)
  const envApiKey = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY)
    || (typeof process !== "undefined" && process.env && (process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY))
    || "";

  const envProjectId = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID)
    || (typeof process !== "undefined" && process.env && (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID))
    || "";

  const envAuthDomain = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
    || (typeof process !== "undefined" && process.env && process.env.FIREBASE_AUTH_DOMAIN)
    || (envProjectId ? `${envProjectId}.firebaseapp.com` : "");

  const envStorageBucket = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)
    || (typeof process !== "undefined" && process.env && process.env.FIREBASE_STORAGE_BUCKET)
    || (envProjectId ? `${envProjectId}.appspot.com` : "");

  const envMessagingSenderId = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
    || (typeof process !== "undefined" && process.env && process.env.FIREBASE_MESSAGING_SENDER_ID)
    || "";

  const envAppId = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREBASE_APP_ID)
    || (typeof process !== "undefined" && process.env && process.env.FIREBASE_APP_ID)
    || "";





// Referensi Koleksi
export const PRODUCTS_COLLECTION = "products";
export const CATEGORIES_COLLECTION = "categories";

// =============================================================================
// KOLEKSI: PRODUCTS (DENGAN PAGINATION & OPTIMASI READS UNTUK 3000-5000 DOKUMEN)
// =============================================================================

/**
 * Mengambil daftar produk dengan Pagination berbasis kursor (startAfter).
 * Aman untuk menangani skala besar (3.000 - 5.000 produk) tanpa beban memory & kuota read berlebihan.
 * 
 * @param {Object} options
 * @param {number} [options.limit=20] Jumlah data per halaman (default 20)
 * @param {any} [options.lastDoc=null] Dokumen terakhir dari halaman sebelumnya (QueryDocumentSnapshot)
 * @param {string|null} [options.categoryId=null] Filter opsional berdasarkan kategori
 * @param {string} [options.orderByField='name'] Field pengurutan (misal 'name', 'price', atau 'createdAt')
 * @param {'asc'|'desc'} [options.orderDirection='asc'] Arah urutan
 * @returns {Promise<{ products: Array, lastDoc: any, hasMore: boolean, count: number }>}
 */
export async function getProducts({
  limit: pageSize = 20,
  lastDoc = null,
  categoryId = null,
  orderByField = "name",
  orderDirection = "asc"
} = {}) {
  try {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const queryConstraints = [];

    // Filter kategori opsional jika dipilih
    if (categoryId && typeof categoryId === "string" && categoryId.trim() !== "") {
      queryConstraints.push(where("categoryId", "==", categoryId.trim()));
    }

    // Urutan konsisten untuk pagination
    if (orderByField) {
      queryConstraints.push(orderBy(orderByField, orderDirection));
    }

    // Kursor pagination (startAfter)
    if (lastDoc) {
      queryConstraints.push(startAfter(lastDoc));
    }

    // Batasan jumlah dokumen per halaman
    const queryLimit = Math.max(1, Math.min(Number(pageSize) || 20, 100));
    queryConstraints.push(limit(queryLimit));

    const q = query(productsRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    const products = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const ecer = data.priceEcer ?? data.price ?? 0;
      return {
        id: docSnap.id,
        ...data,
        price: ecer,
        priceEcer: ecer,
        pricePartai: data.pricePartai ?? (ecer ? Math.round(ecer * 0.95) : 0),
        priceAgen: data.priceAgen ?? (ecer ? Math.round(ecer * 0.90) : 0),
        unit: data.unit || "/pcs"
      };
    });

    const nextLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const hasMore = snapshot.docs.length === queryLimit;

    return {
      products,
      lastDoc: nextLastDoc,
      hasMore,
      count: products.length
    };
  } catch (error) {
    console.error("[firestoreService] Error getProducts:", error);
    throw error;
  }
}

/**
 * Mengambil satu produk berdasarkan ID dokumen
 * @param {string} productId
 * @returns {Promise<Object|null>}
 */
export async function getProductById(productId) {
  if (!productId) return null;
  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, String(productId));
    const snap = await getDoc(productRef);
    if (!snap.exists()) {
      return null;
    }
    return {
      id: snap.id,
      ...snap.data()
    };
  } catch (error) {
    console.error(`[firestoreService] Error getProductById (${productId}):`, error);
    throw error;
  }
}

/**
 * Menambahkan produk baru ke koleksi 'products'
 * @param {Object} productData Data produk
 * @returns {Promise<{ id: string, ...productData }>}
 */
export async function addProduct(productData) {
  try {
    const cleanData = { ...productData };
    const targetId = cleanData.id ? String(cleanData.id).trim() : null;
    delete cleanData.id;

    const timestamp = new Date().toISOString();
    const finalData = {
      ...cleanData,
      createdAt: cleanData.createdAt || timestamp,
      updatedAt: timestamp
    };

    if (targetId) {
      const productRef = doc(db, PRODUCTS_COLLECTION, targetId);
      await setDoc(productRef, finalData);
      return { id: targetId, ...finalData };
    } else {
      const colRef = collection(db, PRODUCTS_COLLECTION);
      const docRef = await addDoc(colRef, finalData);
      return { id: docRef.id, ...finalData };
    }
  } catch (error) {
    console.error("[firestoreService] Error addProduct:", error);
    throw error;
  }
}

/**
 * Memperbarui data produk yang ada
 * @param {string} productId
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
export async function updateProduct(productId, updateData) {
  if (!productId) throw new Error("productId wajib diisi untuk update");
  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, String(productId));
    const cleanData = { ...updateData };
    delete cleanData.id;

    cleanData.updatedAt = new Date().toISOString();
    await updateDoc(productRef, cleanData);

    return {
      id: String(productId),
      ...cleanData
    };
  } catch (error) {
    console.error(`[firestoreService] Error updateProduct (${productId}):`, error);
    throw error;
  }
}

/**
 * Menghapus produk dari Firestore
 * @param {string} productId
 * @returns {Promise<{ success: boolean, id: string }>}
 */
export async function deleteProduct(productId) {
  if (!productId) throw new Error("productId wajib diisi untuk delete");
  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, String(productId));
    await deleteDoc(productRef);
    return { success: true, id: String(productId) };
  } catch (error) {
    console.error(`[firestoreService] Error deleteProduct (${productId}):`, error);
    throw error;
  }
}

/**
 * Listener real-time KHUSUS PANEL ADMIN dengan batasan limit ketat.
 * Didesain tidak digunakan untuk halaman toko publik demi efisiensi read kuota.
 * 
 * @param {Function} callback (products, snapshot) => void
 * @param {Object} [options]
 * @param {number} [options.limitCount=50] Batas maksimum dokumen real-time
 * @param {string|null} [options.categoryId=null] Filter kategori
 * @param {Function} [errCallback]
 * @returns {Function} Unsubscribe function
 */
export function onAdminProductsSnapshot(
  callback,
  { limitCount = 50, categoryId = null, orderByField = "updatedAt", orderDirection = "desc" } = {},
  errCallback
) {
  const productsRef = collection(db, PRODUCTS_COLLECTION);
  const constraints = [];

  if (categoryId && typeof categoryId === "string" && categoryId.trim() !== "") {
    constraints.push(where("categoryId", "==", categoryId.trim()));
  }

  if (orderByField) {
    constraints.push(orderBy(orderByField, orderDirection));
  }

  constraints.push(limit(Math.min(limitCount || 50, 100)));

  const q = query(productsRef, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      if (typeof callback === "function") {
        callback(items, snapshot);
      }
    },
    (err) => {
      console.warn("[firestoreService] onAdminProductsSnapshot error:", err);
      if (typeof errCallback === "function") {
        errCallback(err);
      }
    }
  );
}

// =============================================================================
// KOLEKSI: CATEGORIES (CRUD & REAL-TIME LISTENER)
// =============================================================================

/**
 * Mengambil semua kategori (one-time fetch)
 * @returns {Promise<Array>}
 */
export async function getCategories() {
  try {
    const catRef = collection(db, CATEGORIES_COLLECTION);
    const q = query(catRef, orderBy("name", "asc"));
    
    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch (_) {
      // Fallback jika indeks 'name' belum terindeks
      snapshot = await getDocs(catRef);
    }

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("[firestoreService] Error getCategories:", error);
    throw error;
  }
}

/**
 * Mengambil satu kategori berdasarkan ID
 * @param {string} categoryId
 * @returns {Promise<Object|null>}
 */
export async function getCategoryById(categoryId) {
  if (!categoryId) return null;
  try {
    const catRef = doc(db, CATEGORIES_COLLECTION, String(categoryId));
    const snap = await getDoc(catRef);
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data()
    };
  } catch (error) {
    console.error(`[firestoreService] Error getCategoryById (${categoryId}):`, error);
    throw error;
  }
}

/**
 * Menambahkan kategori baru
 * @param {Object} categoryData
 * @returns {Promise<Object>}
 */
export async function addCategory(categoryData) {
  try {
    const cleanData = { ...categoryData };
    const targetId = cleanData.id ? String(cleanData.id).trim() : null;
    delete cleanData.id;

    const timestamp = new Date().toISOString();
    const finalData = {
      ...cleanData,
      createdAt: cleanData.createdAt || timestamp,
      updatedAt: timestamp
    };

    if (targetId) {
      const catRef = doc(db, CATEGORIES_COLLECTION, targetId);
      await setDoc(catRef, finalData);
      return { id: targetId, ...finalData };
    } else {
      const colRef = collection(db, CATEGORIES_COLLECTION);
      const docRef = await addDoc(colRef, finalData);
      return { id: docRef.id, ...finalData };
    }
  } catch (error) {
    console.error("[firestoreService] Error addCategory:", error);
    throw error;
  }
}

/**
 * Memperbarui kategori
 * @param {string} categoryId
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
export async function updateCategory(categoryId, updateData) {
  if (!categoryId) throw new Error("categoryId wajib diisi untuk update");
  try {
    const catRef = doc(db, CATEGORIES_COLLECTION, String(categoryId));
    const cleanData = { ...updateData };
    delete cleanData.id;
    cleanData.updatedAt = new Date().toISOString();

    await updateDoc(catRef, cleanData);
    return {
      id: String(categoryId),
      ...cleanData
    };
  } catch (error) {
    console.error(`[firestoreService] Error updateCategory (${categoryId}):`, error);
    throw error;
  }
}

/**
 * Menghapus kategori
 * @param {string} categoryId
 * @returns {Promise<{ success: boolean, id: string }>}
 */
export async function deleteCategory(categoryId) {
  if (!categoryId) throw new Error("categoryId wajib diisi untuk delete");
  try {
    const catRef = doc(db, CATEGORIES_COLLECTION, String(categoryId));
    await deleteDoc(catRef);
    return { success: true, id: String(categoryId) };
  } catch (error) {
    console.error(`[firestoreService] Error deleteCategory (${categoryId}):`, error);
    throw error;
  }
}

/**
 * Listener real-time untuk perubahan daftar kategori
 * @param {Function} callback
 * @param {Function} [errCallback]
 * @returns {Function} Unsubscribe function
 */
export function onCategoriesSnapshot(callback, errCallback) {
  const catRef = collection(db, CATEGORIES_COLLECTION);
  return onSnapshot(
    catRef,
    (snapshot) => {
      const categories = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      if (typeof callback === "function") {
        callback(categories, snapshot);
      }
    },
    (err) => {
      console.warn("[firestoreService] onCategoriesSnapshot error:", err);
      if (typeof errCallback === "function") {
        errCallback(err);
      }
    }
  );
}

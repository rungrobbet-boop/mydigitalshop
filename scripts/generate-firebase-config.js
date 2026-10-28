// Auto-generate public/firebase-config.js from Vite Environment Variables
// Jalankan sebelum vite build: node scripts/generate-firebase-config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.VITE_FIREBASE_API_KEY || '';
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || '';
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || '';
const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || '';
const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
const appId = process.env.VITE_FIREBASE_APP_ID || '';
const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL || '';

const isDemoMode = !apiKey || apiKey.includes('YOUR_FIREBASE');

// Pre-compute fallback values (dievaluasi oleh generator, bukan dibiarkan sebagai template literal di output)
const authDomainFallback = projectId ? `${projectId}.firebaseapp.com` : '';
const storageBucketFallback = projectId ? `${projectId}.appspot.com` : '';

const content = `/**
 * Firebase Configuration Center — SINGLE SOURCE OF TRUTH
 * (Auto-generated from Vite Environment Variables during build)
 * Jangan diedit secara manual — file ini digenerate ulang setiap build
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/**
 * Resolve konfigurasi Firebase dari Environment Variables (Vite) dengan prioritas:
 *   1. import.meta.env.VITE_FIREBASE_*  (Cloudflare Pages / Vite env)
 *   2. localStorage 'dapur_firebase_custom_config' (custom config via Panel Admin Kasir)
 *   3. Fallback kosong (Demo Mode)
 */
export function resolveFirebaseConfig() {
  const config = {
    apiKey: ${JSON.stringify(apiKey)},
    authDomain: ${JSON.stringify(authDomain)} || ${JSON.stringify(authDomainFallback)},
    projectId: ${JSON.stringify(projectId)},
    storageBucket: ${JSON.stringify(storageBucket)} || ${JSON.stringify(storageBucketFallback)},
    messagingSenderId: ${JSON.stringify(messagingSenderId)},
    appId: ${JSON.stringify(appId)},
    databaseURL: ${JSON.stringify(databaseURL)},
  };

  // 2. Cek localStorage untuk custom config (khusus Kasir Panel Admin)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem("dapur_firebase_custom_config");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.apiKey && !parsed.apiKey.includes("YOUR_FIREBASE")) {
          return {
            apiKey: parsed.apiKey,
            authDomain: parsed.authDomain || (parsed.projectId ? \`\${parsed.projectId}.firebaseapp.com\` : ""),
            projectId: parsed.projectId,
            storageBucket: parsed.storageBucket || (parsed.projectId ? \`\${parsed.projectId}.appspot.com\` : ""),
            messagingSenderId: parsed.messagingSenderId || "",
            appId: parsed.appId || "",
            databaseURL: parsed.databaseURL || "",
          };
        }
      }
    } catch (_) {
      // Abaikan error parsing localStorage
    }
  }

  return config;
}

/**
 * Konfigurasi Firebase yang akan diekspor
 */
export const firebaseConfig = resolveFirebaseConfig();

/**
 * Inisialisasi Firebase App, Firestore, dan RTDB
 * Returns { app, db, rtdb } atau null jika konfigurasi tidak valid
 */
let _cachedApp = null;
let _cachedDb = null;
let _cachedRtdb = null;

export function initFirebase() {
  // Jika sudah diinisialisasi, kembalikan instance yang sama (singleton)
  if (_cachedApp) {
    return { app: _cachedApp, db: _cachedDb, rtdb: _cachedRtdb };
  }

  const cfg = firebaseConfig;

  if (!cfg || !cfg.apiKey || cfg.apiKey.includes("YOUR_FIREBASE")) {
    console.warn("[FIREBASE-CONFIG] Kredensial Firebase tidak lengkap — mode Demo/Offline");
    return null;
  }

  try {
    // Inisialisasi App (hindari double initialization)
    const app = getApps().length > 0 ? getApp() : initializeApp(cfg);

    // Inisialisasi Firestore
    const db = getFirestore(app);

    // Inisialisasi Realtime Database
    let rtdb = null;
    if (cfg.databaseURL) {
      try {
        rtdb = getDatabase(app);
      } catch (e) {
        console.warn("[FIREBASE-CONFIG] Gagal inisialisasi RTDB:", e);
      }
    }

    _cachedApp = app;
    _cachedDb = db;
    _cachedRtdb = rtdb;

    console.log("[FIREBASE-CONFIG] Firebase diinisialisasi:", {
      projectId: cfg.projectId,
      databaseURL: cfg.databaseURL || "(tidak ada)",
      hasApiKey: !!cfg.apiKey,
    });

    return { app, db, rtdb };
  } catch (e) {
    console.error("[FIREBASE-CONFIG] Gagal inisialisasi Firebase:", e);
    return null;
  }
}

/**
 * Helper untuk mendapatkan konfigurasi Firebase (untuk non-module script)
 */
export function getFirebaseConfig() {
  return { ...firebaseConfig };
}

export const IS_DEMO_MODE = ${isDemoMode};
`;

const outPath = path.join(__dirname, '..', 'public', 'firebase-config.js');
fs.writeFileSync(outPath, content);
console.log('✅ Generated public/firebase-config.js');
console.log('   projectId:', projectId || '(kosong — Demo Mode)');

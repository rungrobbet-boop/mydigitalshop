// Auto-generate public/firebase-config.js from Vite Environment Variables
// Jalankan sebelum vite build: node scripts/generate-firebase-config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || ''
};

const isDemoMode = !config.apiKey || config.apiKey.includes('YOUR_FIREBASE');

const content = `// Auto-generated from Vite Environment Variables during build
// Jangan diedit secara manual — file ini digenerate ulang setiap build
export const firebaseConfig = ${JSON.stringify(config, null, 2)};
export const IS_DEMO_MODE = ${isDemoMode};
`;

const outPath = path.join(__dirname, '..', 'public', 'firebase-config.js');
fs.writeFileSync(outPath, content);
console.log('✅ Generated public/firebase-config.js');
console.log('   projectId:', config.projectId || '(kosong — Demo Mode)');

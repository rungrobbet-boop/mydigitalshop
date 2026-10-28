/**
 * functions/accounting/rebuild-ledger.js
 * Cloudflare Pages Function — POST /accounting/rebuild-ledger
 * 
 * Rebuild seluruh ledger dari jurnal yang berstatus "approved".
 * - Normalisasi semua kode akun ke 3-digit (fix bug ledger 3-digit vs 4-digit).
 * - Hapus ledger lama, hitung ulang dari jurnal, simpan ke Firebase.
 * 
 * Body: { "bulan": "2026-09" }  (optional — kalau tidak ada, rebuild semua bulan)
 * Body: { "action": "migrate-accounts", "bulan": "2026-09" }  (migrasi 4 digit ke 3 digit)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Sistem akuntansi menggunakan KODE 3 DIGIT (101, 105, 201, 301, 401, 501, 601)
// Semua konfigurasi akun di seluruh sistem sekarang standar 3 digit.
function normalizeAcc(acc) {
  const clean = String(acc || '').trim();
  if (!clean) return '';
  // Konversi 4 digit → 3 digit agar kompatibel dengan standar 3 digit sistem
  const map4to3 = {
    '1001': '101', '1002': '102', '1003': '103', '1004': '105', '1005': '106',
    '2001': '201', '2002': '202',
    '3001': '301', '3002': '303', '3003': '302',
    '4001': '401', '4002': '402',
    '5001': '501',
    '6001': '601', '6002': '602', '6003': '603', '6004': '604', '6005': '605', '6006': '606'
  };
  return map4to3[clean] || clean;
}

function isKreditNormal(acc) {
  // Kewajiban (2), Ekuitas non-Prive (3 kecuali 3003), Pendapatan (4)
  if (acc.startsWith('2')) return true;
  if (acc.startsWith('3') && acc !== '3003') return true;
  if (acc.startsWith('4')) return true;
  return false;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" }
  });
}

/**
 * Migrasi 4-digit → 3-digit langsung ke RTDB (internal, dipanggil oleh rebuild)
 * Membaca seluruh jurnal di /accounting/journal/{bulan}, mengubah acc 4-digit ke 3-digit,
 * lalu menyimpan kembali ke RTDB.
 */
async function runMigrateAccounts(dbUrl, auth, targetBulan) {
  const journalUrl = `${dbUrl}/accounting/journal/${encodeURIComponent(targetBulan)}.json${auth}`;
  const res = await fetch(journalUrl);
  const journalsData = await res.json();

  if (!journalsData || typeof journalsData !== 'object') {
    return { success: false, error: 'Tidak ada jurnal ditemukan', migrated: 0, skipped: 0 };
  }

  const allEntries = Object.entries(journalsData).map(([id, v]) => ({ id, bulan: targetBulan, entry: v }));

  let migrated = 0;
  let skipped = 0;

  for (const { id, bulan, entry } of allEntries) {
    if (!entry || !Array.isArray(entry.lines)) {
      skipped++;
      continue;
    }

    let changed = false;
    const newLines = entry.lines.map(line => {
      const rawAcc = String(line.acc || line.code || '').trim();
      const newAcc = normalizeAcc(rawAcc);
      if (rawAcc !== newAcc) {
        changed = true;
        return { ...line, acc: newAcc };
      }
      return line;
    });

    if (changed) {
      await fetch(`${dbUrl}/accounting/journal/${encodeURIComponent(bulan)}/${encodeURIComponent(id)}.json${auth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, lines: newLines })
      });
      migrated++;
    } else {
      skipped++;
    }
  }

  return {
    success: true,
    message: `Migrasi selesai. ${migrated} jurnal dimigrasi, ${skipped} dilewati.`,
    migrated,
    skipped
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const apiKey = env.FIREBASE_API_KEY || "";
  const auth = apiKey ? `?auth=${encodeURIComponent(apiKey)}` : '';

  const body = await request.json().catch(() => ({}));
  const action = body.action || 'rebuild';
  const targetBulan = body.bulan || null;  // null = rebuild semua bulan

  // =======================================================================
  // ACTION: MIGRATE-ACCOUNTS (4 digit → 3 digit)
  // =======================================================================
  if (action === 'migrate-accounts') {
    try {
      const journalUrl = targetBulan
        ? `${dbUrl}/accounting/journal/${encodeURIComponent(targetBulan)}.json${auth}`
        : `${dbUrl}/accounting/journal.json${auth}`;

      const res = await fetch(journalUrl);
      const journalsData = await res.json();

      if (!journalsData || typeof journalsData !== 'object') {
        return jsonResponse({ success: false, error: 'Tidak ada jurnal ditemukan' }, 404);
      }

      const allEntries = targetBulan
        ? Object.entries(journalsData).map(([id, v]) => ({ id, bulan: targetBulan, entry: v }))
        : Object.entries(journalsData).flatMap(([bulan, monthData]) =>
            Object.entries(monthData || {}).map(([id, v]) => ({ id, bulan, entry: v }))
          );

      let migrated = 0;
      let skipped = 0;

      for (const { id, bulan, entry } of allEntries) {
        if (!entry || !Array.isArray(entry.lines)) {
          skipped++;
          continue;
        }

        let changed = false;
        const newLines = entry.lines.map(line => {
          const rawAcc = String(line.acc || line.code || '').trim();
          const newAcc = normalizeAcc(rawAcc);
          if (rawAcc !== newAcc) {
            changed = true;
            return { ...line, acc: newAcc };
          }
          return line;
        });

        if (changed) {
          await fetch(`${dbUrl}/accounting/journal/${encodeURIComponent(bulan)}/${encodeURIComponent(id)}.json${auth}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...entry, lines: newLines })
          });
          migrated++;
        } else {
          skipped++;
        }
      }

      return jsonResponse({
        success: true,
        message: `Migrasi selesai. ${migrated} jurnal dimigrasi, ${skipped} dilewati.`,
        migrated,
        skipped
      });
    } catch (err) {
      console.error('[MIGRATE-ACCOUNTS] Error:', err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  // =======================================================================
  // ACTION: REBUILD (default)
  // =======================================================================
  // Auto-migrate 4-digit → 3-digit for ALL months before rebuild
  try {
    const migrateAll = await runMigrateAccounts(dbUrl, auth, null);
    if (migrateAll.success) {
      console.log(`[REBUILD-LEDGER] Auto-migrate ALL: ${migrateAll.message}`);
    }
  } catch (e) {
    console.warn('[REBUILD-LEDGER] Auto-migrate ALL skipped:', e.message);
  }

  try {
    console.log(`[REBUILD-LEDGER] Start rebuild for bulan: ${targetBulan || 'ALL'}`);

    // 1. Ambil semua jurnal
    const journalUrl = targetBulan
      ? `${dbUrl}/accounting/journal/${encodeURIComponent(targetBulan)}.json${auth}`
      : `${dbUrl}/accounting/journal.json${auth}`;

    const res = await fetch(journalUrl);
    const journalsData = await res.json();

    if (!journalsData || typeof journalsData !== 'object') {
      return jsonResponse({ success: false, error: 'Tidak ada jurnal ditemukan' }, 404);
    }

    // 2. Struktur data: { bulan: { jrnId: entry } } atau { jrnId: entry } (single month)
    const ledger = {};  // { "2026-09": { "1001": { opening, debit, credit, closing } } }

    const allEntries = targetBulan
      ? Object.entries(journalsData).map(([id, v]) => ({ id, bulan: targetBulan, entry: v }))
      : Object.entries(journalsData).flatMap(([bulan, monthData]) =>
          Object.entries(monthData || {}).map(([id, v]) => ({ id, bulan, entry: v }))
        );

    let processed = 0;
    let skipped = 0;

    for (const { id, bulan, entry } of allEntries) {
      if (!entry || (entry.status !== 'approved' && entry.status !== 'posted')) {
        skipped++;
        continue;
      }

      if (!Array.isArray(entry.lines)) {
        skipped++;
        continue;
      }

      if (!ledger[bulan]) ledger[bulan] = {};

      for (const line of entry.lines) {
        const rawAcc = String(line.acc || line.code || '').trim();
        const acc = normalizeAcc(rawAcc);
        if (!acc) continue;

        const debit = Math.max(0, Number(line.debit) || 0);
        const credit = Math.max(0, Number(line.credit) || 0);
        if (debit === 0 && credit === 0) continue;

        if (!ledger[bulan][acc]) {
          ledger[bulan][acc] = { opening: 0, debit: 0, credit: 0, closing: 0 };
        }

        ledger[bulan][acc].debit += debit;
        ledger[bulan][acc].credit += credit;
      }

      processed++;
    }

    // ✅ FIX BUG-21: FASE 2 — Carry-forward opening antar bulan & hitung closing
    // Urut bulan ascending, lalu setiap bulan ambil opening = closing bulan sebelumnya
    const sortedMonths = Object.keys(ledger).sort();
    const allAccounts = new Set();
    sortedMonths.forEach(b => Object.keys(ledger[b]).forEach(a => allAccounts.add(a)));

    console.log(`[REBUILD-LEDGER] FASE 2: carry-forward ${sortedMonths.length} bulan × ${allAccounts.size} akun`);

    for (let i = 0; i < sortedMonths.length; i++) {
      const bulan = sortedMonths[i];
      const prevMonth = i > 0 ? sortedMonths[i - 1] : null;

      for (const acc of allAccounts) {
        // Ambil opening dari closing bulan sebelumnya (0 untuk bulan pertama)
        let opening = 0;
        if (prevMonth && ledger[prevMonth] && ledger[prevMonth][acc]) {
          opening = Number(ledger[prevMonth][acc].closing) || 0;
        }

        if (!ledger[bulan][acc]) {
          // Akun tidak ada transaksi bulan ini, tapi perlu dicatat kalau ada saldo carry
          if (opening !== 0) {
            ledger[bulan][acc] = { opening, debit: 0, credit: 0, closing: opening };
          }
          continue;
        }

        ledger[bulan][acc].opening = opening;
        ledger[bulan][acc].closing = isKreditNormal(acc)
          ? opening + ledger[bulan][acc].credit - ledger[bulan][acc].debit
          : opening + ledger[bulan][acc].debit - ledger[bulan][acc].credit;
      }
    }

    console.log(`[REBUILD-LEDGER] Processed ${processed} jurnal, skipped ${skipped}. Months:`, sortedMonths);

    // 3. Hapus ledger lama (semua node)
    await fetch(`${dbUrl}/accounting/ledger.json${auth}`, { method: 'DELETE' });

    // 4. Tulis ledger baru
    let writtenCount = 0;
    for (const [bulan, accounts] of Object.entries(ledger)) {
      for (const [acc, data] of Object.entries(accounts)) {
        data.updatedAt = Date.now();
        const writeRes = await fetch(`${dbUrl}/accounting/ledger/${encodeURIComponent(acc)}/${encodeURIComponent(bulan)}.json${auth}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (writeRes.ok) writtenCount++;
      }
    }

    console.log(`[REBUILD-LEDGER] Done. Written ${writtenCount} ledger entries.`);

    return jsonResponse({
      success: true,
      message: `Rebuild selesai. ${processed} jurnal diproses, ${skipped} dilewati, ${writtenCount} ledger entries ditulis.`,
      processed,
      skipped,
      written: writtenCount,
      months: Object.keys(ledger),
      accountCount: Object.values(ledger).reduce((sum, m) => sum + Object.keys(m).length, 0),
      ledgerSnapshot: ledger  // untuk verifikasi
    }, 200);

  } catch (err) {
    console.error('[REBUILD-LEDGER] Error:', err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

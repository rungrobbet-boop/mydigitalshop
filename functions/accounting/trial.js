const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const action = url.searchParams.get('action') || 'preview';

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const apiKey = env.FIREBASE_API_KEY || "";
  const authParam = apiKey ? `?auth=${encodeURIComponent(apiKey)}` : "";

  // Helper: hitung jumlah item di suatu path
  async function countItems(path) {
    try {
      const res = await fetch(`${dbUrl}/${path}.json${authParam}`);
      const data = await res.json();
      if (!data) return 0;
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object') return Object.keys(data).length;
      return 0;
    } catch (e) { return 0; }
  }

  // Helper: hapus data di path
  async function deleteAll(path) {
    try {
      await fetch(`${dbUrl}/${path}.json${authParam}`, { method: 'DELETE' });
      return true;
    } catch (e) { return false; }
  }

  // Helper: baca status mode (trial/live)
  async function getModeStatus() {
    try {
      const res = await fetch(`${dbUrl}/accounting/system_mode.json${authParam}`);
      const data = await res.json();
      return data || { mode: 'trial', productionStartedAt: null };
    } catch (e) {
      return { mode: 'trial', productionStartedAt: null };
    }
  }

  // Helper: set mode
  async function setMode(mode, extraData = {}) {
    await fetch(`${dbUrl}/accounting/system_mode.json${authParam}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        updatedAt: Date.now(),
        ...extraData
      })
    });
  }

  // Helper: copy data ke archive
  async function archiveData(prefix) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archivePath = `accounting/archive/${prefix}_${timestamp}`;

    const pathsToArchive = [
      'accounting/journal',
      'accounting/ledger',
      'accounting/summary',
      'accounting/closed_periods',
      'inventory_deducted',
      'pos/transactions',
      'orders',
      'purchases'
    ];

    for (const path of pathsToArchive) {
      try {
        const dataRes = await fetch(`${dbUrl}/${path}.json${authParam}`);
        const data = await dataRes.json();
        if (data) {
          await fetch(`${dbUrl}/${archivePath}/${path.replace(/\//g, '_')}.json${authParam}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }
      } catch (e) { /* skip individual errors */ }
    }

    return { archivePath, timestamp };
  }

  try {

    // =======================================================================
    // ACTION: PREVIEW
    // =======================================================================
    if (action === 'preview' && method === 'GET') {
      const [journals, ledgers, orders, transactions, modeStatus] = await Promise.all([
        countItems('accounting/journal'),
        countItems('accounting/ledger'),
        countItems('orders'),
        countItems('pos/transactions'),
        getModeStatus()
      ]);

      // Cek neraca balance dari summary terbaru
      let neracaBalance = false;
      let noDraftJournals = true;
      let noPendingOrders = true;

      try {
        const bulan = new Date().toISOString().slice(0, 7);
        const sumRes = await fetch(`${dbUrl}/accounting/summary/${bulan}.json${authParam}`);
        const summary = await sumRes.json();
        if (summary) {
          const diff = Math.abs((summary.totalAset || 0) - ((summary.totalKewajiban || 0) + (summary.totalEkuitas || 0)));
          neracaBalance = diff < 100;
        }

        // Cek draft journals bulan ini
        const jRes = await fetch(`${dbUrl}/accounting/journal/${bulan}.json${authParam}`);
        const journalsData = await jRes.json();
        if (journalsData) {
          for (const entry of Object.values(journalsData)) {
            if (entry.status === 'draft' || entry.status === 'pending') {
              noDraftJournals = false;
              break;
            }
          }
        }

        // Cek order menggantung
        const oRes = await fetch(`${dbUrl}/orders.json${authParam}`);
        const ordersData = await oRes.json();
        if (ordersData) {
          for (const o of Object.values(ordersData)) {
            const st = (o.status || '').toLowerCase();
            if (st.includes('gantung') || st.includes('pending') || st === 'ditunda') {
              noPendingOrders = false;
              break;
            }
          }
        }
      } catch (e) { /* skip */ }

      return jsonResponse({
        success: true,
        preview: { journals, ledgers, orders, transactions },
        mode: modeStatus.mode,
        productionStartedAt: modeStatus.productionStartedAt,
        validation: { neracaBalance, noDraftJournals, noPendingOrders }
      });
    }

    // =======================================================================
    // ACTION: CLOSE PERIOD
    // =======================================================================
    if (action === 'close-period' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const bulan = body.bulan || new Date().toISOString().slice(0, 7);

      // Copy data bulan ini ke closed_periods
      const [jRes, lRes, sRes] = await Promise.all([
        fetch(`${dbUrl}/accounting/journal/${bulan}.json${authParam}`),
        fetch(`${dbUrl}/accounting/ledger.json${authParam}`),
        fetch(`${dbUrl}/accounting/summary/${bulan}.json${authParam}`)
      ]);

      const journals = await jRes.json();
      const ledgers = await lRes.json();
      const summary = await sRes.json();

      await fetch(`${dbUrl}/accounting/closed_periods/${bulan}.json${authParam}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulan,
          closedAt: Date.now(),
          closedBy: body.adminName || 'Admin',
          journalCount: journals ? Object.keys(journals).length : 0,
          ledgerSnapshot: ledgers || {},
          summarySnapshot: summary || {},
          status: 'closed'
        })
      });

      // =======================================================================
      // JURNAL PENUTUP (Closing Entries)
      // Pindahkan laba bersih ke Laba Ditahan (302), reset Pendapatan (4xx) & Beban (6xx) ke 0
      // =======================================================================
      const pendapatanPerAkun = {};
      let hppSaldo = 0;
      const bebanPerAkun = {};

      if (ledgers && typeof ledgers === 'object') {
        for (const [accCode, accData] of Object.entries(ledgers)) {
          const code = String(accCode);
          if (!accData || typeof accData !== 'object') continue;
          const closing = Number(accData.closing || 0);
          if (closing === 0) continue;

          if (code.startsWith('4')) {
            pendapatanPerAkun[code] = closing;
          } else if (code === '501') {
            hppSaldo = closing;
          } else if (code.startsWith('6')) {
            bebanPerAkun[code] = closing;
          }
        }
      }

      const totalPendapatan = Object.values(pendapatanPerAkun).reduce((a, b) => a + b, 0);
      const totalBeban = Object.values(bebanPerAkun).reduce((a, b) => a + b, 0);
      const totalHppBeban = hppSaldo + totalBeban;
      const labaBersih = totalPendapatan - totalHppBeban;

      const closingEntries = [];
      const entryId = 'CLOSING-' + bulan + '-' + Date.now();

      // 1. Pendapatan (4xx): Debit Pendapatan, Kredit Laba Ditahan (302)
      for (const [accCode, saldo] of Object.entries(pendapatanPerAkun)) {
        if (saldo > 0) {
          closingEntries.push({
            id: entryId + '-REV-' + accCode,
            date: bulan + '-31',
            timestamp: new Date(bulan + '-31T23:59:59').getTime(),
            desc: 'Penutup Pendapatan ' + accCode,
            lines: [
              { acc: accCode, debit: saldo, credit: 0 },
              { acc: '302', debit: 0, credit: saldo }
            ]
          });
        }
      }

      // 2. HPP (501): Debit Laba Ditahan (302), Kredit HPP
      if (hppSaldo > 0) {
        closingEntries.push({
          id: entryId + '-HPP-501',
          date: bulan + '-31',
          timestamp: new Date(bulan + '-31T23:59:59').getTime(),
          desc: 'Penutup HPP 501',
          lines: [
            { acc: '302', debit: hppSaldo, credit: 0 },
            { acc: '501', debit: 0, credit: hppSaldo }
          ]
        });
      }

      // 3. Beban (6xx): Debit Laba Ditahan (302), Kredit Beban
      for (const [accCode, saldo] of Object.entries(bebanPerAkun)) {
        if (saldo > 0) {
          closingEntries.push({
            id: entryId + '-EXP-' + accCode,
            date: bulan + '-31',
            timestamp: new Date(bulan + '-31T23:59:59').getTime(),
            desc: 'Penutup Beban ' + accCode,
            lines: [
              { acc: '302', debit: saldo, credit: 0 },
              { acc: accCode, debit: 0, credit: saldo }
            ]
          });
        }
      }

      // Simpan jurnal penutup ke RTDB /accounting/journal/{bulan}
      for (const ce of closingEntries) {
        await fetch(`${dbUrl}/accounting/journal/${encodeURIComponent(bulan)}/${encodeURIComponent(ce.id)}.json${authParam}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: ce.id,
            date: ce.date,
            timestamp: ce.timestamp,
            desc: ce.desc,
            status: 'approved',
            lines: ce.lines,
            totalDebit: ce.lines.reduce((s, l) => s + l.debit, 0),
            totalCredit: ce.lines.reduce((s, l) => s + l.credit, 0)
          })
        });
      }

      // Sinkronisasi Ledger via rebuild-ledger function
      try {
        const host = new URL(request.url).host;
        await fetch(`https://${host}/accounting/rebuild-ledger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bulan })
        });
      } catch (e) {
        console.warn('[CLOSE-PERIOD] Rebuild ledger gagal:', e);
      }

      return jsonResponse({
        success: true,
        message: `Periode ${bulan} berhasil ditutup. ${closingEntries.length} jurnal penutup dibuat.`,
        bulan,
        closedAt: Date.now(),
        closingEntries: closingEntries.length,
        labaBersih: labaBersih
      });
    }

    // =======================================================================
    // ACTION: RESET TRIAL
    // =======================================================================
    if (action === 'reset' && method === 'POST') {
      // Safety: hanya bisa di mode trial
      const modeStatus = await getModeStatus();
      if (modeStatus.mode === 'production') {
        return jsonResponse({ success: false, error: 'Reset tidak tersedia di mode produksi' }, 403);
      }

      // Backup dulu
      const archiveInfo = await archiveData('reset');

      // Hapus data
      const pathsToDelete = [
        'accounting/journal',
        'accounting/ledger',
        'accounting/summary',
        'accounting/closed_periods',
        'inventory_deducted',
        'pos/transactions',
        'orders',
        'purchases'
      ];

      const deleted = [];
      for (const path of pathsToDelete) {
        const ok = await deleteAll(path);
        if (ok) deleted.push(path);
      }

      return jsonResponse({
        success: true,
        message: 'Reset trial selesai',
        archivedTo: archiveInfo.archivePath,
        deletedPaths: deleted
      });
    }

    // =======================================================================
    // ACTION: GO-LIVE
    // =======================================================================
    if (action === 'go-live' && method === 'POST') {
      const modeStatus = await getModeStatus();
      if (modeStatus.mode === 'production') {
        return jsonResponse({ success: false, error: 'Go-Live sudah pernah dilakukan' }, 403);
      }

      // Backup trial
      const archiveInfo = await archiveData('trial');

      // Hapus data trial
      const pathsToDelete = [
        'accounting/journal',
        'accounting/ledger',
        'accounting/summary',
        'accounting/closed_periods',
        'inventory_deducted',
        'pos/transactions',
        'orders',
        'purchases'
      ];

      const deleted = [];
      for (const path of pathsToDelete) {
        const ok = await deleteAll(path);
        if (ok) deleted.push(path);
      }

      // Set mode ke production
      await setMode('production', { productionStartedAt: Date.now() });

      return jsonResponse({
        success: true,
        message: 'Go-Live berhasil. Sistem sekarang dalam mode produksi.',
        archivedTo: archiveInfo.archivePath,
        productionStartedAt: Date.now()
      });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('[TRIAL-API] Error:', err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

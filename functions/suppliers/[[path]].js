/**
 * functions/suppliers/[[path]].js
 * Cloudflare Pages Function — CRUD Supplier Master di Firestore
 *
 * Endpoint:
 *   GET    /suppliers              — Daftar semua supplier
 *   GET    /suppliers/{id}         — Detail satu supplier
 *   POST   /suppliers              — Buat supplier baru
 *   PUT/PATCH /suppliers/{id}      — Update supplier
 *   DELETE /suppliers/{id}         — Hapus supplier
 *   POST   /suppliers/migrate      — Migrasi RTDB -> Firestore (body: {})
 *
 * Env: FIREBASE_API_KEY, FIREBASE_PROJECT_ID (atau turunan dari FIREBASE_DATABASE_URL)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Derive project ID from env or Firebase Database URL
function getProjectId(env) {
  const explicit = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "";
  if (explicit) return explicit;

  const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  const match = dbUrl.match(/^https:\/\/([a-z0-9-]+)-default-rtdb/);
  if (match) return match[1];

  return "";
}

function getFirestoreBaseUrl(env) {
  const projectId = getProjectId(env);
  if (!projectId) return "";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function getAuthKey(env) {
  return env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || "";
}

// Firestore value helpers
function fvString(val) {
  return val != null ? { stringValue: String(val) } : { nullValue: null };
}
function fvInteger(val) {
  return val != null ? { integerValue: String(toNum(val)) } : { integerValue: "0" };
}
function fvBoolean(val) {
  return { booleanValue: Boolean(val) };
}
function fvMap(fields) {
  return { mapValue: { fields } };
}

// Convert Firestore document to plain JS object
function docToSupplier(doc) {
  if (!doc || !doc.fields) return null;
  const f = doc.fields;
  return {
    id: doc.name.split("/").pop(),
    name: f.name?.stringValue || "",
    contact: f.contact?.stringValue || "",
    address: f.address?.stringValue || "",
    active: f.active?.booleanValue !== false,
    createdAt: f.createdAt?.stringValue || "",
    updatedAt: f.updatedAt?.stringValue || "",
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean); // e.g. ['suppliers', 'id']

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const baseUrl = getFirestoreBaseUrl(env);
  const apiKey = getAuthKey(env);

  if (!baseUrl || !apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Firestore tidak dikonfigurasi (FIREBASE_PROJECT_ID / FIREBASE_API_KEY)" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    // ========================================================================
    // POST /suppliers/migrate — Migrasi RTDB -> Firestore
    // ========================================================================
    if (method === "POST" && pathParts.length === 2 && pathParts[1] === "migrate") {
      const dbUrl = (env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
      const rtdbAuth = apiKey ? `?auth=${encodeURIComponent(apiKey)}` : "";

      // 1. Baca semua data dari RTDB /suppliers
      const rtdbRes = await fetch(`${dbUrl}/suppliers.json${rtdbAuth}`);
      const rtdbData = await rtdbRes.json();
      const suppliers = rtdbData && typeof rtdbData === 'object'
        ? Object.entries(rtdbData).map(([id, v]) => ({ id, ...(v || {}) }))
        : [];

      if (suppliers.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "Tidak ada supplier di RTDB untuk dimigrasi", migrated: 0 }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // 2. Salin ke Firestore suppliers (jika belum ada)
      const listRes = await fetch(`${baseUrl}/suppliers?key=${apiKey}&pageSize=1000`);
      const listJson = await listRes.json();
      const existingNames = new Set((listJson.documents || []).map(d => d.fields?.name?.stringValue));

      let migrated = 0;
      let skipped = 0;
      const now = new Date().toISOString();

      for (const sup of suppliers) {
        // Skip jika nama sudah ada di Firestore
        if (existingNames.has(sup.name || "")) {
          skipped++;
          continue;
        }

        const docBody = {
          fields: {
            name: fvString(sup.name || "Supplier Tanpa Nama"),
            contact: fvString(sup.contact || ""),
            address: fvString(sup.address || ""),
            active: fvBoolean(sup.active !== undefined ? Boolean(sup.active) : true),
            createdAt: fvString(sup.createdAt || now),
            updatedAt: fvString(now),
          },
        };

        const res = await fetch(`${baseUrl}/suppliers?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(docBody),
        });

        if (res.ok) {
          migrated++;
        } else {
          console.warn(`[MIGRATE] Gagal migrasi supplier ${sup.name}:`, await res.text().catch(() => ""));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Migrasi selesai. ${migrated} supplier ditambahkan, ${skipped} dilewati (sudah ada)`,
          migrated,
          skipped,
          total: suppliers.length
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // GET /suppliers — Daftar semua supplier
    // ========================================================================
    if (method === "GET" && pathParts.length === 1) {
      const res = await fetch(`${baseUrl}/suppliers?key=${apiKey}&pageSize=1000`);
      const json = await res.json();

      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: json.error?.message || "Gagal ambil supplier" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const docs = json.documents || [];
      const suppliers = docs.map(docToSupplier).filter(Boolean);
      return new Response(
        JSON.stringify({ success: true, data: suppliers, count: suppliers.length }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // GET /suppliers/{id} — Detail satu supplier
    // ========================================================================
    if (method === "GET" && pathParts.length === 2) {
      const supplierId = pathParts[1];
      const res = await fetch(`${baseUrl}/suppliers/${encodeURIComponent(supplierId)}?key=${apiKey}`);

      if (!res.ok) {
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ success: false, error: "Supplier tidak ditemukan" }),
            { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Gagal ambil supplier" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      return new Response(
        JSON.stringify({ success: true, data: docToSupplier(json) }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // POST /suppliers — Buat supplier baru
    // ========================================================================
    if (method === "POST" && pathParts.length === 1) {
      const body = await request.json().catch(() => ({}));
      const { name, contact, address, active } = body;

      if (!name) {
        return new Response(
          JSON.stringify({ success: false, error: "Nama supplier wajib diisi" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();
      const docBody = {
        fields: {
          name: fvString(name),
          contact: fvString(contact || ""),
          address: fvString(address || ""),
          active: fvBoolean(active !== undefined ? Boolean(active) : true),
          createdAt: fvString(now),
          updatedAt: fvString(now),
        },
      };

      const res = await fetch(`${baseUrl}/suppliers?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docBody),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: err.error?.message || "Gagal buat supplier" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      return new Response(
        JSON.stringify({ success: true, data: docToSupplier(json) }),
        { status: 201, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // PUT/PATCH /suppliers/{id} — Update supplier
    // ========================================================================
    if ((method === "PUT" || method === "PATCH") && pathParts.length === 2) {
      const supplierId = pathParts[1];
      const body = await request.json().catch(() => ({}));
      const now = new Date().toISOString();

      const fields = {};
      const mask = [];
      for (const key of ["name", "contact", "address", "active"]) {
        if (body[key] !== undefined) {
          if (key === "active") {
            fields[key] = fvBoolean(body[key]);
          } else {
            fields[key] = fvString(body[key]);
          }
          mask.push(key);
        }
      }
      fields.updatedAt = fvString(now);
      mask.push("updatedAt");

      if (mask.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Tidak ada field yang diupdate" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(
        `${baseUrl}/suppliers/${encodeURIComponent(supplierId)}?key=${apiKey}&updateMask.fieldPaths=${mask.join("&updateMask.fieldPaths=")}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ success: false, error: "Supplier tidak ditemukan" }),
            { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        const err = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: err.error?.message || "Gagal update supplier" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      return new Response(
        JSON.stringify({ success: true, data: docToSupplier(json) }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // DELETE /suppliers/{id} — Hapus supplier
    // ========================================================================
    if (method === "DELETE" && pathParts.length === 2) {
      const supplierId = pathParts[1];
      const res = await fetch(`${baseUrl}/suppliers/${encodeURIComponent(supplierId)}?key=${apiKey}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ success: false, error: "Supplier tidak ditemukan" }),
            { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Gagal hapus supplier" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Supplier berhasil dihapus" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Endpoint tidak dikenali" }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SUPPLIERS-FN] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}

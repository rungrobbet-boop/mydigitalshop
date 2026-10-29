/**
 * functions/customers/[[path]].js
 * Cloudflare Pages Function — CRUD Customer Master Data di Firestore
 *
 * Endpoint:
 *   GET    /customers              — Daftar semua customer
 *   GET    /customers/{id}         — Detail satu customer
 *   POST   /customers              — Buat customer baru (body: { name, phone, email, addressKirim, addressKtp, officePhone, tempoKredit })
 *   PUT    /customers/{id}         — Update customer
 *   DELETE /customers/{id}         — Hapus customer
 *
 * Env: FIREBASE_API_KEY, FIREBASE_PROJECT_ID (atau turunan dari FIREBASE_DATABASE_URL)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
function fvMap(fields) {
  return { mapValue: { fields } };
}

// Convert Firestore document to plain JS object
function docToCustomer(doc) {
  if (!doc || !doc.fields) return null;
  const f = doc.fields;
  return {
    id: doc.name.split("/").pop(),
    name: f.name?.stringValue || "",
    phone: f.phone?.stringValue || "",
    email: f.email?.stringValue || "",
    addressKirim: f.addressKirim?.stringValue || "",
    addressKtp: f.addressKtp?.stringValue || "",
    officePhone: f.officePhone?.stringValue || "",
    tempoKredit: toNum(f.tempoKredit?.integerValue || 30),
    notes: f.notes?.stringValue || "",
    createdAt: f.createdAt?.stringValue || "",
    updatedAt: f.updatedAt?.stringValue || "",
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean); // e.g. ['customers', 'id']

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
    // GET /customers — Daftar semua customer
    // ========================================================================
    if (method === "GET" && pathParts.length === 1) {
      const res = await fetch(`${baseUrl}/customers?key=${apiKey}&pageSize=1000`);
      const json = await res.json();

      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: json.error?.message || "Gagal ambil customer" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const docs = json.documents || [];
      const customers = docs.map(docToCustomer).filter(Boolean);
      return new Response(
        JSON.stringify({ success: true, data: customers, count: customers.length }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // GET /customers/{id} — Detail satu customer
    // ========================================================================
    if (method === "GET" && pathParts.length === 2) {
      const customerId = pathParts[1];
      const res = await fetch(`${baseUrl}/customers/${encodeURIComponent(customerId)}?key=${apiKey}`);

      if (!res.ok) {
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ success: false, error: "Customer tidak ditemukan" }),
            { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Gagal ambil customer" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      return new Response(
        JSON.stringify({ success: true, data: docToCustomer(json) }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // POST /customers — Buat customer baru
    // ========================================================================
    if (method === "POST" && pathParts.length === 1) {
      const body = await request.json().catch(() => ({}));
      const { name, phone, email, addressKirim, addressKtp, officePhone, tempoKredit, notes } = body;

      if (!name || !phone) {
        return new Response(
          JSON.stringify({ success: false, error: "Nama dan nomor HP wajib diisi" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // Cek duplikasi phone
      const listRes = await fetch(`${baseUrl}/customers?key=${apiKey}&pageSize=1000`);
      const listJson = await listRes.json();
      const existing = (listJson.documents || []).find(d => d.fields?.phone?.stringValue === phone);
      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "Nomor HP sudah terdaftar" }),
          { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();
      const docBody = {
        fields: {
          name: fvString(name),
          phone: fvString(phone),
          email: fvString(email || ""),
          addressKirim: fvString(addressKirim || ""),
          addressKtp: fvString(addressKtp || ""),
          officePhone: fvString(officePhone || ""),
          tempoKredit: fvInteger(tempoKredit || 30),
          notes: fvString(notes || ""),
          createdAt: fvString(now),
          updatedAt: fvString(now),
        },
      };

      const res = await fetch(`${baseUrl}/customers?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docBody),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: err.error?.message || "Gagal buat customer" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      return new Response(
        JSON.stringify({ success: true, data: docToCustomer(json) }),
        { status: 201, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // PUT /customers/{id} — Update customer
    // ========================================================================
    if (method === "PUT" && pathParts.length === 2) {
      const customerId = pathParts[1];
      const body = await request.json().catch(() => ({}));
      const now = new Date().toISOString();

      const fields = {};
      const mask = [];
      for (const key of ["name", "phone", "email", "addressKirim", "addressKtp", "officePhone", "notes"]) {
        if (body[key] !== undefined) {
          fields[key] = fvString(body[key]);
          mask.push(key);
        }
      }
      if (body.tempoKredit !== undefined) {
        fields.tempoKredit = fvInteger(body.tempoKredit);
        mask.push("tempoKredit");
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
        `${baseUrl}/customers/${encodeURIComponent(customerId)}?key=${apiKey}&updateMask.fieldPaths=${mask.join("&updateMask.fieldPaths=")}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ success: false, error: "Customer tidak ditemukan" }),
            { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        const err = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: err.error?.message || "Gagal update customer" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const json = await res.json();
      return new Response(
        JSON.stringify({ success: true, data: docToCustomer(json) }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // DELETE /customers/{id} — Hapus customer
    // ========================================================================
    if (method === "DELETE" && pathParts.length === 2) {
      const customerId = pathParts[1];
      const res = await fetch(`${baseUrl}/customers/${encodeURIComponent(customerId)}?key=${apiKey}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ success: false, error: "Customer tidak ditemukan" }),
            { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Gagal hapus customer" }),
          { status: res.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Customer berhasil dihapus" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Endpoint tidak dikenali" }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[CUSTOMERS-FN] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}

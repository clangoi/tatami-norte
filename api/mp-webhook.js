/* ==========================================================
   Kizuna · Webhook de Mercado Pago (función de Vercel)
   POST /api/mp-webhook   ← Mercado Pago avisa cada pago

   1. Verifica la firma del aviso (x-signature) con MP_WEBHOOK_SECRET.
   2. Consulta el pago a la API de Mercado Pago con MP_ACCESS_TOKEN:
      el aviso solo trae el id, nunca se confía en su contenido.
   3. Si está aprobado, lo guarda en Firestore (payments/mp_<id>) a
      nombre del deportista y extiende su membresía (1 o 12 meses).
      Si después se reembolsa, marca el pago como reembolsado.

   Variables de entorno (Vercel → Settings → Environment Variables):
     MP_ACCESS_TOKEN            el mismo de api/pagar.js
     MP_WEBHOOK_SECRET          clave secreta del webhook en Mercado Pago
     FIREBASE_SERVICE_ACCOUNT   JSON de la cuenta de servicio de Firebase
   Ver PAGOS.md.
   ========================================================== */
const crypto = require("crypto");
const admin = require("firebase-admin");

const TZ = "America/Santiago";
const localDate = d => new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ }); // AAAA-MM-DD

// Suma meses a AAAA-MM-DD (31 ene + 1 mes → 28/29 feb), igual que js/deportista.js
function addMonths(iso, n){
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

// La cuenta de servicio puede venir como JSON o en base64
function firestore(){
  if (!admin.apps.length) {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
    const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    admin.initializeApp({ credential: admin.credential.cert(json) });
  }
  return admin.firestore();
}

/* Firma de Mercado Pago:
   x-signature: ts=<ts>,v1=<hmac>
   hmac = HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;") */
function validSignature(req, dataId, secret){
  const header = String(req.headers["x-signature"] || "");
  const parts = Object.fromEntries(header.split(",").map(p => p.trim().split("=")));
  if (!parts.ts || !parts.v1) return false;
  const requestId = req.headers["x-request-id"];
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(parts.v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const REVERSED = ["refunded", "charged_back", "cancelled"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const token = process.env.MP_ACCESS_TOKEN;
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!token || !secret || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("Webhook sin configurar: faltan variables de entorno.");
    return res.status(503).json({ error: "Webhook sin configurar." });
  }

  const body = req.body || {};
  const type = req.query.type || body.type;
  const dataId = String(req.query["data.id"] || (body.data && body.data.id) || "");
  // Solo interesan los pagos (Mercado Pago también avisa otras cosas)
  if (type !== "payment" || !dataId) return res.status(200).json({ ok: true, ignored: true });
  if (!validSignature(req, dataId, secret)) {
    console.warn("Firma inválida para el pago", dataId);
    return res.status(401).json({ error: "Firma inválida." });
  }

  // El pago real, desde la API (fuente de verdad)
  let pay;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (r.status === 404) return res.status(200).json({ ok: true, ignored: "no existe" });
    if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}`);
    pay = await r.json();
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "No se pudo consultar el pago." }); // Mercado Pago reintenta
  }

  const db = firestore();
  const payRef = db.doc(`payments/mp_${pay.id}`);

  try {
    // Reembolso o contracargo de un pago ya registrado
    if (REVERSED.includes(pay.status)) {
      const snap = await payRef.get();
      if (snap.exists && snap.get("estado") !== pay.status) {
        await payRef.update({ estado: pay.status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      return res.status(200).json({ ok: true, estado: pay.status });
    }
    if (pay.status !== "approved") return res.status(200).json({ ok: true, estado: pay.status });

    const meta = pay.metadata || {};
    const ref = String(pay.external_reference || "").split("|"); // plan|periodo|inicio|correo|uid
    const uid = String(meta.uid || ref[4] || "");
    const email = String(meta.email || ref[3] || (pay.payer && pay.payer.email) || "").toLowerCase();
    const cycle = (meta.cycle || ref[1]) === "anual" ? "anual" : "mes";
    const planName = String(meta.plan_name || "").slice(0, 60);
    const date = localDate(pay.date_approved || pay.date_created || Date.now());

    const result = await db.runTransaction(async t => {
      if ((await t.get(payRef)).exists) return "repetido"; // Mercado Pago avisa más de una vez

      // Deportista: por UID y, si no calza, por correo
      let athlete = null;
      if (/^[A-Za-z0-9]{10,40}$/.test(uid)) {
        const s = await t.get(db.doc(`athletes/${uid}`));
        if (s.exists) athlete = s;
      }
      if (!athlete && email) {
        const q = await t.get(db.collection("athletes").where("email", "==", email).limit(1));
        if (!q.empty) athlete = q.docs[0];
      }

      const data = athlete ? athlete.data() : {};
      t.create(payRef, {
        uid: athlete ? athlete.id : "",
        athleteName: athlete ? [data.nombre, data.apellido].filter(Boolean).join(" ") : String(meta.name || "").slice(0, 120),
        payerEmail: email,
        amount: Number(pay.transaction_amount) || 0,
        date,
        method: "mercadopago",
        planName,
        note: `Mercado Pago #${pay.id} · ${cycle === "anual" ? "anual" : "mensual"}`,
        mpId: String(pay.id),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (athlete) {
        const today = localDate(Date.now());
        const base = data.vigenteHasta && data.vigenteHasta >= today ? data.vigenteHasta : today;
        t.update(athlete.ref, {
          vigenteHasta: addMonths(base, cycle === "anual" ? 12 : 1),
          ...(planName ? { plan: planName } : {}),
          activo: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return athlete ? "registrado" : "sin deportista";
    });

    console.log(`Pago ${pay.id}: ${result}`);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo registrar el pago." }); // Mercado Pago reintenta
  }
};

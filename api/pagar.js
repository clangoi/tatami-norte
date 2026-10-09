/* ==========================================================
   Kizuna · Pago con Mercado Pago (función de Vercel)
   POST /api/pagar  →  { url }  (checkout de Mercado Pago)

   Recibe { plan, cycle, name, email, start } desde index.html,
   calcula el precio aquí en el servidor (nunca confía en el que
   manda el navegador) y crea una preferencia de Checkout Pro.

   Necesita la variable de entorno MP_ACCESS_TOKEN en
   Vercel → Settings → Environment Variables. Ver PAGOS.md.
   ========================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// site.config.js es un script de navegador: se evalúa con un window falso
function siteConfig() {
  const code = fs.readFileSync(path.join(process.cwd(), "site.config.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.SITE_CONFIG;
}

const toPrice = v => (typeof v === "number" && v > 0 ? v : null);

// Plan visible en Firestore (lo que se edita en admin.html), vía REST.
// Las reglas solo dejan leer planes visibles, así que un plan oculto o
// inexistente responde error y se devuelve null.
async function firestorePlan(cfg, id) {
  const { projectId, apiKey } = cfg.firebase || {};
  if (!projectId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/plans/${encodeURIComponent(id)}?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const f = (await r.json()).fields || {};
  if (!f.visible || f.visible.booleanValue !== true) return null;
  const n = f.price && (f.price.integerValue ?? f.price.doubleValue);
  return { name: f.name ? f.name.stringValue : id, price: toPrice(Number(n)) };
}

// Los tres planes de respaldo de index.html, con precio desde site.config.js
const FALLBACK = { base: "Base", ilim: "Ilimitado", comp: "Competidor" };

async function findPlan(cfg, id) {
  const fromDb = await firestorePlan(cfg, id).catch(() => null);
  if (fromDb) return fromDb;
  if (FALLBACK[id]) return { name: FALLBACK[id], price: toPrice((cfg.prices || {})[id]) };
  return null;
}

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(v);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Los pagos en línea aún no están activos." });

  const b = req.body || {};
  const planId = String(b.plan || "").slice(0, 80);
  const cycle = b.cycle === "anual" ? "anual" : "mes";
  const name = String(b.name || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().slice(0, 160);
  const start = dateOk(b.start) ? b.start : "";
  if (!planId || name.length < 3 || !emailOk(email)) {
    return res.status(400).json({ error: "Faltan datos: revisa nombre y correo." });
  }

  let cfg;
  try { cfg = siteConfig(); }
  catch (e) { console.error(e); return res.status(500).json({ error: "No se pudo leer la configuración." }); }

  const plan = await findPlan(cfg, planId);
  if (!plan || plan.price == null) return res.status(404).json({ error: "Ese plan no tiene precio en línea." });

  // Mismo cálculo que index.html: anual = mensual con descuento × 12
  const discount = cfg.annualDiscount || 0;
  const total = cycle === "mes" ? plan.price : Math.round(plan.price * (1 - discount)) * 12;
  const currency = (cfg.currency && cfg.currency.code) || "CLP";
  const period = cycle === "mes" ? "mensual" : "anual (12 meses)";

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const site = `https://${host}`;
  const [first, ...rest] = name.split(/\s+/);

  const preference = {
    items: [{
      id: planId,
      title: `Plan ${plan.name} · ${period}`,
      description: `${cfg.name} · inicio ${start || "a coordinar"}`,
      quantity: 1,
      currency_id: currency,
      unit_price: total
    }],
    payer: { name: first, surname: rest.join(" "), email },
    back_urls: {
      success: `${site}/?pago=ok#planes`,
      pending: `${site}/?pago=pendiente#planes`,
      failure: `${site}/?pago=error#planes`
    },
    auto_return: "approved",
    statement_descriptor: (cfg.shortName || "KIZUNA").toUpperCase().slice(0, 22),
    external_reference: `${planId}|${cycle}|${start}|${email}`.slice(0, 256),
    metadata: { plan: planId, plan_name: plan.name, cycle, start, name, email }
  };

  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(preference)
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Mercado Pago:", r.status, data);
      return res.status(502).json({ error: "Mercado Pago no respondió. Intenta de nuevo en un rato." });
    }
    return res.status(200).json({ url: data.init_point });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "No se pudo conectar con Mercado Pago." });
  }
};

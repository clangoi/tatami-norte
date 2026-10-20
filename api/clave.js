/* ==========================================================
   Kizuna · Restablecer la clave de un deportista
   POST /api/clave  { email }  →  { ok: true }
   Si el correo es de un deportista activo, le llega por correo (Brevo) un enlace
   para fijar una clave nueva. La respuesta es siempre la misma, exista o no la
   cuenta, para no revelar qué correos están registrados. Un mismo deportista
   puede pedir un enlace cada 2 minutos.
   ========================================================== */
const { handler, siteUrl } = require("./_lib/http");
const { getDb, getAuth } = require("./_lib/firebase");
const A = require("./_lib/athletes");
const mail = require("./_lib/mail");

const COOLDOWN_MS = 2 * 60 * 1000;

module.exports = handler(["POST"], async (req, res) => {
  const email = A.normEmail((req.body || {}).email);
  const reply = () => res.status(200).json({ ok: true });
  if (!A.emailOk(email)) return reply();

  const db = getDb();
  const found = await db.collection("athletes").where("email", "==", email).limit(1).get();
  if (found.empty) return reply();
  const doc = found.docs[0], a = doc.data();
  if (a.active === false) return reply();
  if (a.resetAt && Date.now() - new Date(a.resetAt).getTime() < COOLDOWN_MS) return reply();

  const site = siteUrl(req);
  const auth = getAuth();
  let link;
  try {
    link = await auth.generatePasswordResetLink(email, { url: `${site}/deportista` });
  } catch (e) {
    console.warn("Enlace con retorno al sitio no disponible:", e.code || e.message);
    link = await auth.generatePasswordResetLink(email);
  }
  await doc.ref.update({ resetAt: new Date().toISOString() });
  await mail.toAthleteInvite({ email, name: a.name, link, site, reminder: true }).catch(e => console.error(e));
  return reply();
});

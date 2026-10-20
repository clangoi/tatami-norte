/* ==========================================================
   Kizuna · Deportistas (solo el equipo del panel)
   Todas las llamadas llevan  Authorization: Bearer <ID token de Firebase>
   GET  /api/deportistas                        →  { athletes, candidates }
   POST /api/deportistas { action: "create", email, name?, phone? }
   POST /api/deportistas { action: "resend", id }       reenvía el enlace para crear la clave
   POST /api/deportistas { action: "update", id, name, phone, active }
   POST /api/deportistas { action: "delete", id }
   Crear un deportista no es automático: lo decide el equipo, con el correo con
   el que la persona se inscribió (esté o no en las reservas). Se crea su cuenta
   y se le envía el enlace para fijar su clave.
   ========================================================== */
const { handler, siteUrl, HttpError } = require("./_lib/http");
const { getDb, getAuth } = require("./_lib/firebase");
const A = require("./_lib/athletes");
const B = require("./_lib/bookings");
const mail = require("./_lib/mail");

const clean = (v, max) => String(v || "").trim().replace(/\s+/g, " ").slice(0, max);

function phoneFields(raw) {
  if (!String(raw || "").trim()) return {};
  const p = B.parsePhone(raw);
  if (!p) throw new HttpError(400, "Revisa el número de teléfono.");
  return p;
}

// Enlace para fijar la clave; si el dominio aún no está autorizado en Firebase, usa el enlace básico
async function passwordLink(email, site) {
  const auth = getAuth();
  try {
    return await auth.generatePasswordResetLink(email, { url: `${site}/deportista` });
  } catch (e) {
    console.warn("Enlace con retorno al sitio no disponible:", e.code || e.message);
    return auth.generatePasswordResetLink(email);
  }
}

async function sendInvite(athlete, site, reminder) {
  const link = await passwordLink(athlete.email, site);
  const emailSent = await mail.toAthleteInvite({ email: athlete.email, name: athlete.name, link, site, reminder })
    .catch(e => { console.error(e); return false; });
  return { link, emailSent };
}

// Una persona por correo: lo último que dejó en sus reservas sirve para completar sus datos
function peopleFromBookings(all) {
  const map = new Map();
  all.forEach(b => {
    const key = A.normEmail(b.email);
    if (!key) return;
    const p = map.get(key) || { email: key, name: "", phone: "", bookings: 0, last: "" };
    p.bookings++;
    if (b.startAt > p.last) { p.last = b.startAt; p.name = b.name; p.phone = b.phone; p.lastClass = b.classLabel; }
    map.set(key, p);
  });
  return map;
}

async function list(db) {
  const [athletesSnap, bookingsSnap, classes] = await Promise.all([
    db.collection("athletes").get(), db.collection("bookings").get(), A.classCatalog(db)
  ]);
  const all = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const byEmail = new Map();
  all.forEach(b => {
    const key = A.normEmail(b.email);
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(b);
  });
  const athletes = athletesSnap.docs.map(d => {
    const a = d.data();
    return {
      id: d.id, email: a.email, name: a.name || "", phone: a.phone || "", active: a.active !== false,
      createdAt: a.createdAt || "", invitedAt: a.invitedAt || "", lastLoginAt: a.lastLoginAt || "",
      ...A.summarize(byEmail.get(A.normEmail(a.email)) || [], classes)
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "es") || a.email.localeCompare(b.email));

  const have = new Set(athletes.map(a => A.normEmail(a.email)));
  const candidates = [...peopleFromBookings(all).values()]
    .filter(p => !have.has(p.email))
    .sort((a, b) => b.last.localeCompare(a.last));
  return { athletes, candidates };
}

module.exports = handler(["GET", "POST"], async (req, res) => {
  await A.requireAdmin(req);
  const db = getDb();
  const site = siteUrl(req);

  if (req.method === "GET") return res.status(200).json(await list(db));

  const body = req.body || {};
  const auth = getAuth();

  if (body.action === "create") {
    const email = A.normEmail(body.email);
    if (!A.emailOk(email)) throw new HttpError(400, "Revisa el correo.");
    const dup = await db.collection("athletes").where("email", "==", email).limit(1).get();
    if (!dup.empty) throw new HttpError(409, "Ese correo ya es un deportista.");

    // Datos: lo que escribió el equipo, o lo último que dejó esa persona en sus reservas
    const prior = (await A.bookingsOf(db, email))[0];
    const name = clean(body.name, 80) || (prior ? prior.name : "");
    const phone = phoneFields(body.phone || (prior && prior.phone));
    if (name.length < 3) throw new HttpError(400, "Escribe el nombre de la persona (este correo no tiene reservas de donde tomarlo).");

    let user;
    try {
      user = await auth.getUserByEmail(email);
      const isAdmin = await db.collection("admins").doc(user.uid).get();
      if (isAdmin.exists) throw new HttpError(409, "Ese correo ya pertenece al equipo del panel.");
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (e.code !== "auth/user-not-found") throw e;
      user = await auth.createUser({ email, displayName: name, emailVerified: false });
    }

    const now = new Date().toISOString();
    const athlete = {
      email, name, ...phone, active: true, calToken: A.newToken(),
      createdAt: now, invitedAt: now, createdBy: "panel"
    };
    await db.collection("athletes").doc(user.uid).set(athlete);
    const invite = await sendInvite(athlete, site, false);
    return res.status(200).json({ id: user.uid, ...invite });
  }

  const ref = db.collection("athletes").doc(String(body.id || "_"));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "No encontramos a ese deportista.");
  const athlete = snap.data();

  if (body.action === "resend") {
    await ref.update({ invitedAt: new Date().toISOString() });
    return res.status(200).json(await sendInvite(athlete, site, true));
  }

  if (body.action === "update") {
    const name = clean(body.name, 80);
    if (name.length < 3) throw new HttpError(400, "Escribe el nombre completo.");
    const phone = phoneFields(body.phone);
    const patch = { name, phone: phone.phone || "", waPhone: phone.waPhone || "", phoneKey: phone.phoneKey || "", active: body.active !== false };
    await ref.update(patch);
    await auth.updateUser(snap.id, { displayName: name, disabled: !patch.active }).catch(e => console.warn(e));
    return res.status(200).json({ ok: true });
  }

  if (body.action === "delete") {
    // Sus reservas no se tocan: quedan en el historial de la escuela
    await ref.delete();
    await auth.deleteUser(snap.id).catch(e => { if (e.code !== "auth/user-not-found") throw e; });
    return res.status(200).json({ ok: true });
  }

  throw new HttpError(400, "Acción no válida.");
});

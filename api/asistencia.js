/* ==========================================================
   Kizuna · Pasar lista (solo el equipo del panel)
   Todas las llamadas llevan  Authorization: Bearer <ID token de Firebase>
   GET  /api/asistencia?date=AAAA-MM-DD[&known=1]
        →  { date, today, sessions: [{ key, classLabel, start, end, capacity, people }], known? }
        people: [{ id, name, phone, email, walkIn, booked, present: true | false | null }]
        known (con known=1): personas conocidas (cuentas y reservas) para completar al agregar a alguien.
   POST /api/asistencia { action: "mark", sessionKey, id, present: true | false | null }
   POST /api/asistencia { action: "walkin", sessionKey, name, phone?, email? }   llegó sin reservar
   POST /api/asistencia { action: "remove", sessionKey, id }                      quita a alguien agregado a mano
   Una persona que llega sin reservar se agrega con su nombre (y teléfono o correo si los da); no necesita cuenta.
   Solo se puede pasar lista de clases de hoy o de días anteriores.
   ========================================================== */
const { handler, HttpError } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");
const { bookingSettings } = require("./_lib/config");
const A = require("./_lib/athletes");
const B = require("./_lib/bookings");
const S = require("./_lib/sessions");
const T = require("./_lib/time");
const X = require("./_lib/attendance");

const isDate = A.isDate;

async function sessionsOf(db, date) {
  const base = await S.loadBase(db, date);
  return S.occurrences(base, date, date, { ignoreNotice: true });
}

async function sessionByKey(db, key, today) {
  const parsed = S.parseKey(key);
  if (!parsed) throw new HttpError(400, "Esa clase no existe.");
  if (parsed.date > today) throw new HttpError(400, "Todavía no se puede pasar lista de esa clase.");
  const found = (await sessionsOf(db, parsed.date)).find(s => s.key === key);
  if (!found) throw new HttpError(404, "Esa clase no está en el horario de ese día.");
  return found;
}

const recordFields = (s, who, uid, present) => ({
  sessionKey: s.key, classId: s.classId, classLabel: s.classLabel, date: s.date, start: s.start, startAt: s.startAt,
  name: who.name, email: who.email || "", emailKey: String(who.email || "").trim().toLowerCase(),
  phone: who.phone || "", bookingId: who.bookingId || null, walkIn: !!who.walkIn,
  present, markedAt: new Date().toISOString(), markedBy: uid
});

// Personas que el instructor puede elegir al agregar a alguien: cuentas de deportistas y quienes ya reservaron
async function known(db) {
  const [athletes, bookings] = await Promise.all([db.collection("athletes").get(), db.collection("bookings").get()]);
  const map = new Map();
  bookings.docs.forEach(d => {
    const b = d.data(), key = A.normEmail(b.email) || b.phoneKey;
    if (key) map.set(key, { name: b.name, email: b.email || "", phone: b.phone || "" });
  });
  athletes.docs.forEach(d => {
    const a = d.data();
    map.set(A.normEmail(a.email), { name: a.name, email: a.email, phone: a.phone || "" });
  });
  return [...map.values()].filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

module.exports = handler(["GET", "POST"], async (req, res) => {
  const user = await A.requireAdmin(req);
  const db = getDb();
  const { timeZone } = bookingSettings();
  const today = T.todayIn(timeZone);

  if (req.method === "GET") {
    const date = isDate(req.query.date) ? req.query.date : today;
    const [sessions, bookingsSnap, records] = await Promise.all([
      sessionsOf(db, date),
      db.collection("bookings").where("date", "==", date).get(),
      X.ofDate(db, date)
    ]);
    const confirmed = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.status === "confirmed");
    const out = sessions.map(s => {
      const rec = new Map(records.filter(r => r.sessionKey === s.key).map(r => [r.id.slice(s.key.length + 2), r]));
      const booked = confirmed.filter(b => b.sessionKey === s.key).sort((a, b) => a.name.localeCompare(b.name, "es"));
      const people = booked.map(b => ({
        id: b.id, name: b.name, phone: b.phone || "", email: b.email || "", walkIn: false, booked: true,
        present: rec.has(b.id) ? rec.get(b.id).present : null
      }));
      // Quien llegó sin reservar (o con una reserva que luego se canceló) y ya fue marcado
      rec.forEach((r, id) => {
        if (booked.some(b => b.id === id)) return;
        people.push({ id, name: r.name, phone: r.phone || "", email: r.email || "", walkIn: !!r.walkIn, booked: false, present: r.present });
      });
      return { key: s.key, classLabel: s.classLabel, start: s.start, end: s.end, capacity: s.capacity, people };
    });
    return res.status(200).json({ date, today, sessions: out, known: req.query.known ? await known(db) : undefined });
  }

  const body = req.body || {};
  const s = await sessionByKey(db, String(body.sessionKey || ""), today);

  if (body.action === "mark") {
    const id = String(body.id || "");
    const ref = db.collection("attendance").doc(X.docId(s.key, id));
    if (body.present === null) { await ref.delete(); return res.status(200).json({ ok: true }); }
    if (typeof body.present !== "boolean") throw new HttpError(400, "Marca si vino o faltó.");
    if (X.isWalkIn(id)) {
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, "No encontramos a esa persona.");
      await ref.update({ present: body.present, markedAt: new Date().toISOString(), markedBy: user.uid });
    } else {
      const b = await B.find(db, id);
      if (b.sessionKey !== s.key || b.status !== "confirmed") throw new HttpError(409, "Esa reserva ya no está activa en esta clase.");
      await ref.set(recordFields(s, { name: b.name, email: b.email, phone: b.phone, bookingId: b.id }, user.uid, body.present));
    }
    return res.status(200).json({ ok: true });
  }

  if (body.action === "walkin") {
    const name = A.clean(body.name, 80);
    if (name.length < 2) throw new HttpError(400, "Escribe el nombre de la persona.");
    const email = A.normEmail(body.email);
    if (email && !A.emailOk(email)) throw new HttpError(400, "Revisa el correo.");
    const phone = String(body.phone || "").trim() ? B.parsePhone(body.phone) : null;
    if (String(body.phone || "").trim() && !phone) throw new HttpError(400, "Revisa el teléfono.");
    const id = X.newWalkInId();
    await db.collection("attendance").doc(X.docId(s.key, id)).set(
      recordFields(s, { name, email, phone: phone ? phone.phone : "", walkIn: true }, user.uid, true));
    return res.status(200).json({ id });
  }

  if (body.action === "remove") {
    const id = String(body.id || "");
    if (!X.isWalkIn(id)) throw new HttpError(400, "Solo se puede quitar a quien se agregó a mano.");
    await db.collection("attendance").doc(X.docId(s.key, id)).delete();
    return res.status(200).json({ ok: true });
  }

  throw new HttpError(400, "Acción no válida.");
});

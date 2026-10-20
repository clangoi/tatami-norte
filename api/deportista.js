/* ==========================================================
   Kizuna · Panel personal del deportista
   Todas las llamadas llevan  Authorization: Bearer <ID token de Firebase>
   GET  /api/deportista
        →  { profile, summary, bookings, sessions, classes, calendar }
   POST /api/deportista { action: "profile", name, phone }
   POST /api/deportista { action: "book", sessionKey }
   POST /api/deportista { action: "cancel", id, reason }
   POST /api/deportista { action: "reschedule", id, newSessionKey, reason }
   Reservar, reagendar y cancelar usan las mismas reglas y los mismos correos
   que las reservas del sitio, pero con los datos del deportista ya guardados.
   ========================================================== */
const { handler, siteUrl, HttpError } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");
const { bookingSettings } = require("./_lib/config");
const A = require("./_lib/athletes");
const B = require("./_lib/bookings");
const S = require("./_lib/sessions");
const T = require("./_lib/time");
const mail = require("./_lib/mail");

const clean = (v, max) => String(v || "").trim().replace(/\s+/g, " ").slice(0, max);

// Datos de contacto de la reserva: los del deportista
function contactOf(a) {
  const phone = B.parsePhone(a.phone);
  if (a.name.length < 3 || !phone) throw new HttpError(400, "Completa tu nombre y teléfono para poder reservar.");
  return { name: a.name, nickname: "", email: a.email, ...phone };
}

const ownsBooking = (a, b) => A.normEmail(b.email) === A.normEmail(a.email);

async function findOwn(db, a, id) {
  const b = await B.find(db, id);
  if (!ownsBooking(a, b)) throw new HttpError(404, "No encontramos esa reserva.");
  return b;
}

function bookingView(b, classes) {
  const c = classes.get(b.classId) || {};
  const v = B.manageView(b);
  return {
    id: v.id, sessionKey: v.sessionKey, status: v.status, classId: v.classId, classLabel: v.classLabel, date: v.date,
    start: v.start, end: v.end, startAt: v.startAt, canChange: v.canChange,
    cancelReason: v.cancelReason, rescheduleReason: v.rescheduleReason,
    club: c.club || "", discipline: c.discipline || "", type: c.type || ""
  };
}

async function overview(db, a, site) {
  const { timeZone } = bookingSettings();
  const today = T.todayIn(timeZone);
  const [mine, classes, base, booked] = await Promise.all([
    A.bookingsOf(db, a.email), A.classCatalog(db), S.loadBase(db, today), S.confirmedBySession(db, today)
  ]);
  const heldKeys = new Set(mine.filter(b => b.status === "confirmed").map(b => b.sessionKey));
  const sessions = S.occurrences(base, today, S.horizonEnd(today)).map(s => {
    const c = classes.get(s.classId) || {};
    return { ...S.publicView(s, booked.get(s.key)), attendees: undefined, mine: heldKeys.has(s.key), club: c.club || "", discipline: c.discipline || "", type: c.type || "" };
  });
  const webcal = `${site.replace(/^https?:/, "webcal:")}/api/calendario?a=${a.calToken}`;
  return {
    profile: { name: a.name, email: a.email, phone: a.phone || "", complete: a.name.length >= 3 && !!B.parsePhone(a.phone) },
    summary: A.summarize(mine, classes),
    bookings: mine.filter(b => b.status !== "rescheduled").slice(0, 400).map(b => bookingView(b, classes)),
    sessions,
    classes: [...new Set(sessions.map(s => s.classId))].map(id => ({ id, ...(classes.get(id) || {}) })),
    calendar: {
      webcal,
      google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
      ics: `${site}/api/calendario?a=${a.calToken}`
    }
  };
}

module.exports = handler(["GET", "POST"], async (req, res) => {
  const db = getDb();
  const site = siteUrl(req);
  const { ref, athlete } = await A.requireAthlete(req);

  if (req.method === "GET") {
    ref.update({ lastLoginAt: new Date().toISOString() }).catch(() => {});
    return res.status(200).json(await overview(db, athlete, site));
  }

  const body = req.body || {};

  if (body.action === "profile") {
    const name = clean(body.name, 80);
    const phone = B.parsePhone(body.phone);
    if (name.length < 3) throw new HttpError(400, "Escribe tu nombre completo.");
    if (!phone) throw new HttpError(400, "Revisa tu número de teléfono.");
    await ref.update({ name, phone: phone.phone, waPhone: phone.waPhone, phoneKey: phone.phoneKey });
    return res.status(200).json({ ok: true });
  }

  if (body.action === "book") {
    const session = await S.bookableSession(db, body.sessionKey);
    const booking = await B.create(db, session, contactOf(athlete));
    const [emailSent] = await Promise.all([
      mail.toAttendee("confirmed", booking, site).catch(e => { console.error(e); return false; }),
      mail.toHost("confirmed", booking, site).catch(e => console.error(e))
    ]);
    return res.status(200).json({ id: booking.id, emailSent });
  }

  const reason = B.parseReason(body.reason);

  if (body.action === "cancel") {
    const found = await findOwn(db, athlete, body.id);
    const b = await B.cancel(db, found.id, reason);
    await Promise.all([
      mail.toAttendee("cancelled", b, site).catch(e => console.error(e)),
      mail.toHost("cancelled", b, site, `Motivo: ${mail.esc(reason)}`).catch(e => console.error(e))
    ]);
    return res.status(200).json({ ok: true });
  }

  if (body.action === "reschedule") {
    const old = await findOwn(db, athlete, body.id);
    const target = await S.bookableSession(db, body.newSessionKey);
    const { old: moved, created } = await B.reschedule(db, old.id, reason, target);
    const [emailSent] = await Promise.all([
      mail.toAttendee("rescheduled", created, site).catch(e => { console.error(e); return false; }),
      mail.toHost("rescheduled", created, site,
        `Antes: ${mail.esc(moved.classLabel)} ${mail.esc(moved.date)} ${mail.esc(moved.start)}<br>Motivo: ${mail.esc(reason)}`).catch(e => console.error(e))
    ]);
    return res.status(200).json({ id: created.id, emailSent });
  }

  throw new HttpError(400, "Acción no válida.");
});

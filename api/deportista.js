/* ==========================================================
   Kizuna · Panel personal del deportista
   Todas las llamadas llevan  Authorization: Bearer <ID token de Firebase>
   GET  /api/deportista
        →  { profile, medical, ranks, summary, bookings, sessions, classes, calendar }
   POST /api/deportista { action: "profile", name, nickname, phone, emergencyName, emergencyPhone }
   POST /api/deportista { action: "medical", conditions, injuries, allergies, medications, bloodType, insurance, consent }
   POST /api/deportista { action: "survey", id, fatigue, comment }   encuesta de la clase (desde 20 min antes de que termine): responderla marca que asistió
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
const ics = require("./_lib/ics");
const X = require("./_lib/attendance");

const medicalOn = () => !!(require("./_lib/config").siteConfig().features || {}).medicalRecord;   // ficha médica en pausa: ver site.config.js
const SURVEY_DAYS = 7;        // plazo para responder la encuesta de una clase
const SURVEY_LEAD_MIN = 20;   // se habilita 20 minutos antes de que termine la clase
const clean = (v, max) => String(v || "").trim().replace(/\s+/g, " ").slice(0, max);

// Datos de contacto de la reserva: los del deportista
function contactOf(a) {
  const phone = B.parsePhone(a.phone);
  if (a.name.length < 3 || !phone) throw new HttpError(400, "Completa tu nombre y teléfono para poder reservar.");
  return { name: a.name, nickname: a.nickname || "", email: a.email, ...phone };
}

const ownsBooking = (a, b) => A.normEmail(b.email) === A.normEmail(a.email);

async function findOwn(db, a, id) {
  const b = await B.find(db, id);
  if (!ownsBooking(a, b)) throw new HttpError(404, "No encontramos esa reserva.");
  return b;
}

function bookingView(b, classes, marks) {
  const c = classes.get(b.classId) || {};
  const v = B.manageView(b);
  return {
    id: v.id, sessionKey: v.sessionKey, status: v.status, classId: v.classId, classLabel: v.classLabel, date: v.date,
    start: v.start, end: v.end, startAt: v.startAt, canChange: v.canChange,
    cancelReason: v.cancelReason, rescheduleReason: v.rescheduleReason,
    club: c.club || "", discipline: c.discipline || "", type: c.type || "",
    tone: c.tone || "oro", design: c.design || 0, clubTone: c.clubTone || "",   // diseño del bloque, igual que en el horario
    endAt: b.endAt,
    attended: marks.has(b.id) ? marks.get(b.id).present : null,   // true vino, false faltó, null sin registro
    fatigue: marks.has(b.id) ? marks.get(b.id).fatigue || null : null,
    comment: marks.has(b.id) ? marks.get(b.id).comment || "" : ""
  };
}

async function overview(db, a, site) {
  const { timeZone } = bookingSettings();
  const today = T.todayIn(timeZone);
  const [mine, classes, base, booked, records] = await Promise.all([
    A.bookingsOf(db, a.email), A.classCatalog(db), S.loadBase(db, today), S.confirmedBySession(db, today), X.ofEmail(db, a.email)
  ]);
  const marks = new Map(records.filter(r => r.bookingId).map(r => [r.bookingId, r]));
  const attendance = X.summarize(records, classes, a.ranks);
  const heldKeys = new Set(mine.filter(b => b.status === "confirmed").map(b => b.sessionKey));
  const sessions = S.occurrences(base, today, S.horizonEnd(today)).map(s => {
    const c = classes.get(s.classId) || {};
    return { ...S.publicView(s, booked.get(s.key)), attendees: undefined, mine: heldKeys.has(s.key), club: c.club || "", discipline: c.discipline || "", type: c.type || "" };
  });
  const webcal = `${site.replace(/^https?:/, "webcal:")}/api/calendario?a=${a.calToken}`;
  return {
    profile: {
      name: a.name, nickname: a.nickname || "", email: a.email, phone: a.phone || "",
      emergencyName: a.emergencyName || "", emergencyPhone: a.emergencyPhone || "",
      complete: a.name.length >= 3 && !!B.parsePhone(a.phone)
    },
    medical: medicalOn() ? a.medical || null : null,
    ranks: Object.fromEntries(Object.entries(a.ranks || {}).map(([d, r]) => [d, { ...r, count: attendance.sinceGrade[d] || 0 }])),
    attendance: { total: attendance.total, last90: attendance.last90, clubs: attendance.clubs, disciplines: attendance.disciplines, types: attendance.types },
    summary: A.summarize(mine, classes),
    bookings: mine.filter(b => b.status !== "rescheduled").slice(0, 400).map(b => bookingView(b, classes, marks)),
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
    const nickname = clean(body.nickname, 30);
    const emergency = A.parseEmergency(body.emergencyName, body.emergencyPhone);
    await ref.update({ name, nickname, phone: phone.phone, waPhone: phone.waPhone, phoneKey: phone.phoneKey, ...emergency });
    return res.status(200).json({ ok: true });
  }

  // Ficha médica: la llena la propia persona, con su consentimiento. La ve solo el equipo (panel).
  if (body.action === "medical") {
    if (!medicalOn()) throw new HttpError(403, "La ficha médica aún no está disponible.");
    if (body.consent !== true) throw new HttpError(400, "Para guardar tu ficha debes aceptar la declaración.");
    const now = new Date().toISOString();
    const medical = {
      conditions: clean(body.conditions, 500), injuries: clean(body.injuries, 500),
      allergies: clean(body.allergies, 300), medications: clean(body.medications, 300),
      bloodType: clean(body.bloodType, 8), insurance: clean(body.insurance, 80),
      consentAt: (athlete.medical && athlete.medical.consentAt) || now, consentVersion: "v1", updatedAt: now
    };
    await ref.update({ medical });
    return res.status(200).json({ ok: true });
  }

  if (body.action === "book") {
    const session = await S.bookableSession(db, body.sessionKey);
    const booking = await B.create(db, session, contactOf(athlete));
    const [emailSent] = await Promise.all([
      mail.toAttendee("confirmed", booking, site).catch(e => { console.error(e); return false; }),
      mail.toHost("confirmed", booking, site).catch(e => console.error(e))
    ]);
    return res.status(200).json({
      id: booking.id, booking: B.manageView(booking),
      google: ics.googleUrl(mail.eventOf(booking, site)), ics: `${site}/api/calendario?t=${booking.id}`, emailSent
    });
  }

  // Encuesta de cansancio (1 a 10) y comentarios: responderla implica haber ido a la clase
  if (body.action === "survey") {
    const b = await findOwn(db, athlete, body.id);
    const fatigue = Number(body.fatigue);
    if (!Number.isInteger(fatigue) || fatigue < 1 || fatigue > 10) throw new HttpError(400, "Elige un número del 1 al 10.");
    if (b.status !== "confirmed") throw new HttpError(409, "Esa reserva ya no está activa.");
    if (new Date(b.endAt).getTime() - SURVEY_LEAD_MIN * 60000 > Date.now()) throw new HttpError(409, `La encuesta se habilita ${SURVEY_LEAD_MIN} minutos antes de que termine la clase.`);
    if (Date.now() - new Date(b.endAt).getTime() > SURVEY_DAYS * 86400000) throw new HttpError(409, `Ya pasaron más de ${SURVEY_DAYS} días. Pídele a tu instructor que marque tu asistencia.`);
    const ref = db.collection("attendance").doc(X.docId(b.sessionKey, b.id));
    const snap = await ref.get();
    if (snap.exists && snap.data().present === false) throw new HttpError(409, "Tu instructor registró que no asististe. Escríbele si es un error.");
    const now = new Date().toISOString();
    const survey = { fatigue, comment: clean(body.comment, 500), answeredAt: now };
    if (snap.exists) await ref.update({ ...survey, present: true });
    else await ref.set(X.fromBooking(b, { present: true, source: "athlete", markedAt: now, markedBy: athlete.id, ...survey }));
    return res.status(200).json({ ok: true });
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

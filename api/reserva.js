/* ==========================================================
   Kizuna · Ver, reprogramar o cancelar una reserva
   GET  /api/reserva?t=ID            →  { booking, options, google, ics }
   POST /api/reserva  { t, action: "cancel", reason }
   POST /api/reserva  { t, action: "reschedule", reason, newSessionKey }
   El motivo es obligatorio en ambos casos.
   ========================================================== */
const { handler, siteUrl, HttpError } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");
const { bookingSettings } = require("./_lib/config");
const B = require("./_lib/bookings");
const S = require("./_lib/sessions");
const T = require("./_lib/time");
const mail = require("./_lib/mail");
const ics = require("./_lib/ics");

const links = (b, site) => ({
  google: ics.googleUrl(mail.eventOf(b, site)),
  ics: `${site}/api/calendario?t=${b.id}`
});

// Otras horas de la misma clase a las que se puede pasar
async function options(db, b) {
  const { timeZone } = bookingSettings();
  const today = T.todayIn(timeZone);
  const base = await S.loadBase(db, today);
  const booked = await S.confirmedBySession(db, today);
  return S.occurrences(base, today, S.horizonEnd(today))
    .filter(s => s.classId === b.classId && s.key !== b.sessionKey)
    .map(s => S.publicView(s, booked.get(s.key)));
}

module.exports = handler(["GET", "POST"], async (req, res) => {
  const db = getDb();
  const site = siteUrl(req);

  if (req.method === "GET") {
    const b = await B.find(db, req.query.t);
    const view = B.manageView(b);
    return res.status(200).json({
      booking: view,
      options: view.canChange ? await options(db, b) : [],
      ...links(b, site)
    });
  }

  const body = req.body || {};
  const reason = B.parseReason(body.reason);

  if (body.action === "cancel") {
    const found = await B.find(db, body.t);
    const b = await B.cancel(db, found.id, reason);
    await Promise.all([
      mail.toAttendee("cancelled", b, site).catch(e => console.error(e)),
      mail.toHost("cancelled", b, site, `Motivo: ${mail.esc(reason)}`).catch(e => console.error(e))
    ]);
    return res.status(200).json({ booking: B.manageView(b) });
  }

  if (body.action === "reschedule") {
    const old = await B.find(db, body.t);
    const target = await S.bookableSession(db, body.newSessionKey);
    const { old: moved, created } = await B.reschedule(db, old.id, reason, target);
    const [emailSent] = await Promise.all([
      mail.toAttendee("rescheduled", created, site).catch(e => { console.error(e); return false; }),
      mail.toHost("rescheduled", created, site,
        `Antes: ${mail.esc(moved.classLabel)} ${mail.esc(moved.date)} ${mail.esc(moved.start)}<br>Motivo: ${mail.esc(reason)}`).catch(e => console.error(e))
    ]);
    return res.status(200).json({ booking: B.manageView(created), emailSent, ...links(created, site) });
  }

  throw new HttpError(400, "Acción no válida.");
});

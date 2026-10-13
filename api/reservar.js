/* ==========================================================
   Kizuna · Reservar una clase
   POST /api/reservar  { sessionKey, name, nickname, phone, email }
   →  { id, booking, google, ics, emailSent }
   Guarda la reserva respetando el cupo y envía la confirmación por correo.
   ========================================================== */
const { handler, siteUrl } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");
const B = require("./_lib/bookings");
const S = require("./_lib/sessions");
const mail = require("./_lib/mail");
const ics = require("./_lib/ics");

module.exports = handler(["POST"], async (req, res) => {
  const body = req.body || {};
  const contact = B.parseContact(body);
  const db = getDb();
  const session = await S.bookableSession(db, body.sessionKey);
  const booking = await B.create(db, session, contact);

  const site = siteUrl(req);
  const [emailSent] = await Promise.all([
    mail.toAttendee("confirmed", booking, site).catch(e => { console.error(e); return false; }),
    mail.toHost("confirmed", booking, site).catch(e => console.error(e))
  ]);

  res.status(200).json({
    id: booking.id,
    booking: B.manageView(booking),
    google: ics.googleUrl(mail.eventOf(booking, site)),
    ics: `${site}/api/calendario?t=${booking.id}`,
    emailSent
  });
});

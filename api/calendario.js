/* ==========================================================
   Kizuna · Archivos de calendario
   GET /api/calendario?t=ID          →  .ics de una reserva (para quien reservó)
   GET /api/calendario?feed=SECRETO  →  calendario de la escuela con todas las
                                        clases y sus inscritos (suscripción)
   SECRETO es la variable CALENDAR_FEED_SECRET en Vercel. Quien tenga ese
   enlace ve los nombres de los inscritos: no lo compartas.
   ========================================================== */
const crypto = require("crypto");
const { handler, siteUrl, HttpError } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");
const { siteConfig, bookingSettings } = require("./_lib/config");
const B = require("./_lib/bookings");
const S = require("./_lib/sessions");
const T = require("./_lib/time");
const mail = require("./_lib/mail");
const ics = require("./_lib/ics");

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = handler(["GET"], async (req, res) => {
  const db = getDb();
  const site = siteUrl(req);

  if (req.query.feed !== undefined) {
    const secret = process.env.CALENDAR_FEED_SECRET;
    if (!secret || !same(req.query.feed, secret)) throw new HttpError(404, "No encontrado.");
    const cfg = siteConfig();
    const { timeZone } = bookingSettings();
    const today = T.todayIn(timeZone);
    const base = await S.loadBase(db, today);
    const booked = await S.confirmedBySession(db, today);
    const where = [cfg.address && cfg.address.line, cfg.address && cfg.address.city].filter(Boolean).join(", ");
    const events = S.occurrences(base, today, T.addDays(today, 42), { ignoreNotice: true }).map(s => {
      const list = booked.get(s.key) || [];
      const people = list.length ? list.map(b => `• ${b.name} (${b.phone})`).join("\n") : "Sin inscritos todavía";
      return {
        uid: `${s.key}@kizuna`, startAt: s.startAt, endAt: s.endAt,
        title: `${s.classLabel} (${list.length}/${s.capacity})`,
        description: `Inscritos:\n${people}`, location: where
      };
    });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).send(ics.calendar(`${cfg.shortName || cfg.name} · Clases`, events));
  }

  const b = await B.find(db, req.query.t);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="clase.ics"');
  res.status(200).send(ics.calendar("Clase", [{ ...mail.eventOf(b, site), cancelled: b.status !== "confirmed" }]));
});

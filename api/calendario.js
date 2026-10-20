/* ==========================================================
   Kizuna · Archivos de calendario
   GET /api/calendario?t=ID          →  .ics de una reserva (para quien reservó)
   GET /api/calendario?feed=SECRETO  →  calendario de la escuela con todas las
                                        clases y sus inscritos (suscripción)
   GET /api/calendario?a=TOKEN       →  calendario personal de un deportista (suscripción):
                                        sus reservas, que se actualizan solas al agendar,
                                        reagendar o cancelar
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
const A = require("./_lib/athletes");
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

  if (req.query.a !== undefined) {
    const token = String(req.query.a || "");
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new HttpError(404, "No encontrado.");
    const found = await db.collection("athletes").where("calToken", "==", token).limit(1).get();
    if (found.empty || found.docs[0].data().active === false) throw new HttpError(404, "No encontrado.");
    const a = found.docs[0].data();
    const cfg = siteConfig();
    const since = Date.now() - 60 * 86400000;   // lo cancelado queda marcado para que el calendario lo quite
    const events = (await A.bookingsOf(db, a.email))
      .filter(b => new Date(b.startAt).getTime() >= since && b.status !== "rescheduled")
      .map(b => ({ ...mail.eventOf(b, site), cancelled: b.status !== "confirmed" }));
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(ics.calendar(`${cfg.shortName || cfg.name} · Mis clases`, events));
  }

  const b = await B.find(db, req.query.t);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="clase.ics"');
  res.status(200).send(ics.calendar("Clase", [{ ...mail.eventOf(b, site), cancelled: b.status !== "confirmed" }]));
});

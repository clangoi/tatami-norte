/* ==========================================================
   Kizuna · Clases disponibles
   GET /api/clases  →  { classes, sessions, today }  (con ?semana=1 también week y days)
   Las próximas sesiones con cupos y los nombres de quienes ya
   se inscribieron (nombre + inicial o apodo; nunca teléfono ni correo).
   ========================================================== */
const { handler } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");
const { bookingSettings } = require("./_lib/config");
const S = require("./_lib/sessions");
const T = require("./_lib/time");

module.exports = handler(["GET"], async (req, res) => {
  const db = getDb();
  const { timeZone } = bookingSettings();
  const today = T.todayIn(timeZone);
  // ?semana=1: además, las clases de la semana en curso y la siguiente (de lunes a domingo), incluidas las que ya pasaron
  const monday = T.addDays(today, -((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7));
  const withWeek = !!req.query.semana;
  const base = await S.loadBase(db, withWeek ? monday : today);
  const booked = await S.confirmedBySession(db, today);
  const sessions = S.occurrences(base, today, S.horizonEnd(today))
    .map(s => S.publicView(s, booked.get(s.key)));

  const week = withWeek
    ? S.occurrences(base, monday, T.addDays(monday, 13), { ignoreNotice: true }).map(s => S.publicView(s, booked.get(s.key)))
    : undefined;

  // Días en que el horario semanal tiene clases recurrentes (las únicas no cuentan)
  const days = withWeek
    ? T.DAYS.slice(1).concat(T.DAYS[0]).filter(d => base.slots.some(sl => sl.active !== false && !sl.date && sl.day === d && base.classes.has(sl.classId) && base.classes.get(sl.classId).active !== false))
    : undefined;

  const used = new Set([...sessions, ...(week || [])].map(s => s.classId));
  const classes = [...base.classes.values()]
    .filter(c => c.active !== false && used.has(c.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(c => ({ id: c.id, label: c.label, tone: c.tone || "oro", page: c.page || "", pages: Array.isArray(c.pages) ? c.pages : (c.page ? [c.page] : []), discipline: c.discipline || "", type: c.type || "", club: c.club || "", clubTone: c.clubTone || "", design: c.design || 0 }));

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ classes, sessions, week, days, today });
});

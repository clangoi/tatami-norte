/* ==========================================================
   Kizuna · Clases disponibles
   GET /api/clases  →  { classes, sessions, today }
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
  const { timeZone, horizonDays } = bookingSettings();
  const today = T.todayIn(timeZone);
  const base = await S.loadBase(db, today);
  const booked = await S.confirmedBySession(db, today);
  const sessions = S.occurrences(base, today, T.addDays(today, horizonDays))
    .map(s => S.publicView(s, booked.get(s.key)));

  const used = new Set(sessions.map(s => s.classId));
  const classes = [...base.classes.values()]
    .filter(c => c.active !== false && used.has(c.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(c => ({ id: c.id, label: c.label, tone: c.tone || "oro", page: c.page || "" }));

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ classes, sessions, today });
});

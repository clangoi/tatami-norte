/* Clases del horario semanal convertidas en sesiones con fecha.
   Una sesión = un bloque semanal (slots/{id}) en una fecha concreta.
   Su clave es "<slotId>_<AAAA-MM-DD>" y es lo que guardan las reservas. */
const { HttpError } = require("./http");
const { bookingSettings } = require("./config");
const T = require("./time");

const keyOf = (slotId, date) => `${slotId}_${date}`;

function parseKey(key) {
  const m = /^([A-Za-z0-9_-]{1,40})_(\d{4}-\d{2}-\d{2})$/.exec(String(key || ""));
  return m ? { slotId: m[1], date: m[2] } : null;
}

// Clases, bloques semanales y cierres desde Firestore
async function loadBase(db, fromDate) {
  const [classes, slots, closures] = await Promise.all([
    db.collection("classes").get(),
    db.collection("slots").get(),
    db.collection("closures").where("date", ">=", fromDate).get()
  ]);
  return {
    classes: new Map(classes.docs.map(d => [d.id, { id: d.id, ...d.data() }])),
    slots: slots.docs.map(d => ({ id: d.id, ...d.data() })),
    closures: closures.docs.map(d => d.data())
  };
}

function build(base, slot, date, tz, defaultCapacity) {
  const cls = base.classes.get(slot.classId);
  const duration = slot.duration || cls.duration || 60;
  const start = slot.start, end = T.addMinutes(start, duration);
  const startMs = T.zonedToUtc(date, start, tz);
  return {
    key: keyOf(slot.id, date),
    slotId: slot.id,
    classId: slot.classId,
    classLabel: cls.label || slot.classId,
    date, start, end, duration,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + duration * 60000).toISOString(),
    capacity: slot.capacity || cls.capacity || defaultCapacity,
    note: slot.note || ""
  };
}

// Sesiones reservables entre dos fechas (inclusive). Respeta cierres y aviso mínimo.
function occurrences(base, from, to, opts = {}) {
  const { timeZone: tz, minNoticeMinutes, defaultCapacity } = bookingSettings();
  const earliest = Date.now() + (opts.ignoreNotice ? -Infinity : minNoticeMinutes * 60000);
  const closedAll = new Set(base.closures.filter(c => !c.slotId).map(c => c.date));
  const closedSlot = new Set(base.closures.filter(c => c.slotId).map(c => keyOf(c.slotId, c.date)));
  const out = [];
  for (let date = from; date <= to; date = T.addDays(date, 1)) {
    const day = T.dayKeyOf(date);
    for (const slot of base.slots) {
      if (slot.active === false || slot.day !== day || !T.isTime(slot.start)) continue;
      const cls = base.classes.get(slot.classId);
      if (!cls || cls.active === false) continue;
      const s = build(base, slot, date, tz, defaultCapacity);
      if (closedAll.has(date) || closedSlot.has(s.key)) continue;
      if (new Date(s.startAt).getTime() < earliest) continue;
      out.push(s);
    }
  }
  return out.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.classLabel.localeCompare(b.classLabel));
}

// Reservas confirmadas desde una fecha, agrupadas por sesión
async function confirmedBySession(db, fromDate) {
  const snap = await db.collection("bookings").where("date", ">=", fromDate).get();
  const map = new Map();
  snap.docs.forEach(d => {
    const b = d.data();
    if (b.status !== "confirmed") return;
    if (!map.has(b.sessionKey)) map.set(b.sessionKey, []);
    map.get(b.sessionKey).push({ id: d.id, ...b });
  });
  map.forEach(list => list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")));
  return map;
}

// Lo que ve cualquiera: cupos y nombres para mostrar (nunca teléfono ni correo)
function publicView(session, bookings) {
  const list = bookings || [];
  return {
    key: session.key, classId: session.classId, classLabel: session.classLabel,
    date: session.date, start: session.start, end: session.end,
    capacity: session.capacity, taken: list.length, full: list.length >= session.capacity,
    attendees: list.map(b => b.display), note: session.note
  };
}

// Sesión por clave si todavía se puede reservar; si no, el error que corresponde
async function bookableSession(db, key) {
  const parsed = parseKey(key);
  if (!parsed) throw new HttpError(400, "Esa clase no existe.");
  const { horizonDays, timeZone } = bookingSettings();
  const today = T.todayIn(timeZone);
  if (parsed.date > T.addDays(today, horizonDays)) throw new HttpError(400, "Todavía no se puede reservar esa fecha.");
  const base = await loadBase(db, parsed.date);
  const found = occurrences(base, parsed.date, parsed.date).find(s => s.key === key);
  if (!found) throw new HttpError(409, "Esa clase ya no está disponible. Elige otra.");
  return found;
}

// Nombre para mostrar: apodo, o nombre + inicial del apellido ("Camila R.")
function displayName(name, nickname) {
  const nick = String(nickname || "").trim();
  if (nick) return nick;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

module.exports = { keyOf, parseKey, loadBase, occurrences, confirmedBySession, publicView, bookableSession, displayName };

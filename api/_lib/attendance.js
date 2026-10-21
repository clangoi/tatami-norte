/* Asistencia real: quién llegó a cada clase.
   attendance/{sessionKey}__{id}: un documento por persona y clase.
   - id = el de su reserva, o "w…" si llegó sin reservar (no hace falta que tenga cuenta).
   - present: true (vino) o false (faltó). Sin documento = el instructor aún no la marcó.
   - emailKey une la asistencia con la cuenta del deportista, si dejó su correo.
   Solo las funciones del servidor lo leen y escriben (ver firestore.rules). */
const crypto = require("crypto");

const docId = (sessionKey, id) => `${sessionKey}__${id}`;
const newWalkInId = () => "w" + crypto.randomBytes(7).toString("base64url");
const isWalkIn = id => /^w[A-Za-z0-9_-]{6,20}$/.test(String(id || ""));

const fromSnap = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

const ofDate = async (db, date) => fromSnap(await db.collection("attendance").where("date", "==", date).get());
const ofEmail = async (db, email) => fromSnap(await db.collection("attendance").where("emailKey", "==", String(email).trim().toLowerCase()).get());
const allPresent = async db => fromSnap(await db.collection("attendance").where("present", "==", true).get());

const DAY = 86400000;
const bump = (map, key) => { if (key) map.set(key, (map.get(key) || 0) + 1); };
const toList = map => [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

/* Resumen de asistencias reales (solo present: true): total, últimos 90 días y por club, disciplina y tipo.
   Con ranks ({ "BJJ": { grade, since } }) cuenta también cuántas clases lleva en cada disciplina desde su grado actual. */
function summarize(records, classes, ranks = {}) {
  const present = records.filter(r => r.present === true);
  const since90 = Date.now() - 90 * DAY;
  const clubs = new Map(), disciplines = new Map(), types = new Map();
  let last90 = 0;
  present.forEach(r => {
    const c = classes.get(r.classId) || {};
    bump(clubs, c.club); bump(disciplines, c.discipline); bump(types, c.type);
    if (new Date(r.startAt).getTime() >= since90) last90++;
  });
  const norm = s => String(s || "").trim().toLowerCase();
  const sinceGrade = {};
  Object.entries(ranks || {}).forEach(([discipline, r]) => {
    sinceGrade[discipline] = present.filter(x => {
      const c = classes.get(x.classId) || {};
      return norm(c.discipline) === norm(discipline) && (!r.since || x.date >= r.since);
    }).length;
  });
  return { total: present.length, last90, clubs: toList(clubs), disciplines: toList(disciplines), types: toList(types), sinceGrade };
}

module.exports = { docId, newWalkInId, isWalkIn, ofDate, ofEmail, allPresent, summarize };

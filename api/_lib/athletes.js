/* Deportistas: cuentas, sesión y resumen de clases.
   athletes/{uid}: el id es el UID de Firebase Auth. Lo crea el panel (api/deportistas.js)
   con el correo con el que la persona se inscribe; la persona entra con ese correo y su clave.
   Sus reservas se reconocen por el correo (bookings.emailKey, o email en las antiguas). */
const crypto = require("crypto");
const { HttpError } = require("./http");
const { getDb, getAuth } = require("./firebase");

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const normEmail = v => String(v || "").trim().toLowerCase().slice(0, 160);

async function verify(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) throw new HttpError(401, "Inicia sesión para continuar.");
  try {
    return await getAuth().verifyIdToken(m[1]);
  } catch (e) {
    throw new HttpError(401, "Tu sesión venció. Vuelve a entrar.");
  }
}

// Quien llama debe ser parte del equipo: admins/{uid}
async function requireAdmin(req) {
  const user = await verify(req);
  const snap = await getDb().collection("admins").doc(user.uid).get();
  if (!snap.exists) throw new HttpError(403, "Solo el equipo de la escuela puede hacer esto.");
  return user;
}

// Quien llama debe ser un deportista creado desde el panel y activo
async function requireAthlete(req) {
  const user = await verify(req);
  const ref = getDb().collection("athletes").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists || snap.data().active === false) throw new HttpError(403, "Tu cuenta de deportista no está activa. Escríbenos.");
  return { ref, athlete: { id: snap.id, ...snap.data() } };
}

const newToken = () => crypto.randomBytes(24).toString("base64url");

// Reservas de un correo (sin importar mayúsculas), de la más reciente a la más antigua
async function bookingsOf(db, email) {
  const lower = normEmail(email);
  const queries = [
    db.collection("bookings").where("emailKey", "==", lower).get(),
    db.collection("bookings").where("email", "in", [...new Set([lower, String(email).trim()])]).get()
  ];
  const map = new Map();
  (await Promise.all(queries)).forEach(snap => snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() })));
  return [...map.values()].sort((a, b) => b.startAt.localeCompare(a.startAt));
}

// Club, disciplina y tipo de cada clase (las antiguas los sacan de su nombre: «BJJ Gi · Kizuna»)
async function classCatalog(db) {
  const snap = await db.collection("classes").get();
  const map = new Map();
  snap.docs.forEach(d => {
    const c = d.data();
    let { discipline = "", type = "", club = "" } = c;
    if (!discipline && !club) {
      const [left, ...rest] = String(c.label || "").split(" · ");
      discipline = left.trim(); club = rest.join(" · ").trim();
    }
    // tone, design y clubTone son el diseño del bloque de la clase en el horario del sitio
    map.set(d.id, { discipline, type, club, tone: c.tone || "oro", design: Number.isInteger(c.design) ? c.design : 0, clubTone: c.clubTone || "" });
  });
  return map;
}

const bump = (map, key) => { if (key) map.set(key, (map.get(key) || 0) + 1); };
const toList = map => [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

/* Resumen: clases ya tomadas (confirmadas y pasadas) por club, disciplina y tipo,
   y próximas. Las disciplinas y clubes de la persona salen de aquí, sin que nadie los asigne. */
function summarize(list, classes) {
  const now = Date.now();
  const clubs = new Map(), disciplines = new Map(), types = new Map();
  let taken = 0, upcoming = 0;
  list.forEach(b => {
    if (b.status !== "confirmed") return;
    if (new Date(b.startAt).getTime() > now) { upcoming++; return; }
    taken++;
    const c = classes.get(b.classId) || {};
    bump(clubs, c.club); bump(disciplines, c.discipline); bump(types, c.type);
  });
  return { taken, upcoming, clubs: toList(clubs), disciplines: toList(disciplines), types: toList(types) };
}

const clean = (v, max) => String(v || "").trim().replace(/\s+/g, " ").slice(0, max);
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

// Grados por disciplina: { "BJJ": { grade: "Azul", since: "2025-03-10" } }. Los asigna el equipo; la persona solo los ve.
function parseRanks(raw) {
  const out = {};
  Object.entries(raw && typeof raw === "object" ? raw : {}).slice(0, 20).forEach(([discipline, r]) => {
    const key = clean(discipline, 40), grade = clean(r && r.grade, 40);
    if (!key || !grade) return;   // sin grado = sin registro
    out[key] = { grade, since: isDate(r.since) ? r.since : "" };
  });
  return out;
}

// Contacto de emergencia (opcional): nombre y teléfono van juntos
function parseEmergency(name, phone) {
  const n = clean(name, 80), raw = String(phone || "").trim();
  if (!n && !raw) return { emergencyName: "", emergencyPhone: "" };
  const { parsePhone } = require("./bookings");
  const p = parsePhone(raw);
  if (n.length < 3) throw new HttpError(400, "Escribe el nombre de tu contacto de emergencia.");
  if (!p) throw new HttpError(400, "Revisa el teléfono de tu contacto de emergencia.");
  return { emergencyName: n, emergencyPhone: p.phone };
}

module.exports = { clean, isDate, parseRanks, parseEmergency, emailOk, normEmail, requireAdmin, requireAthlete, newToken, bookingsOf, classCatalog, summarize };

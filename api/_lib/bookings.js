/* Reservas: validación de datos, creación con cupo y cambios de estado.
   bookings/{id}: el id es un código aleatorio largo; quien lo tiene (en el
   enlace del correo) puede ver, cambiar o cancelar esa reserva.
   status: "confirmed" | "cancelled" | "rescheduled" */
const crypto = require("crypto");
const { HttpError } = require("./http");
const S = require("./sessions");

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const newId = () => crypto.randomBytes(18).toString("base64url");

// Teléfono: se guarda como lo escribió (limpio) y aparte en dígitos para WhatsApp
function parsePhone(raw) {
  const clean = String(raw || "").replace(/[^\d+\s()-]/g, "").trim().slice(0, 24);
  let digits = clean.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.length === 9 && digits[0] === "9") digits = "56" + digits;   // celular chileno sin código de país
  return { phone: clean, waPhone: digits, phoneKey: digits.slice(-9) };
}

// Datos que escribe quien reserva
function parseContact(b) {
  if (b.website) throw new HttpError(400, "No se pudo reservar.");   // campo trampa para bots
  const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const nickname = String(b.nickname || "").trim().replace(/\s+/g, " ").slice(0, 30);
  const email = String(b.email || "").trim().slice(0, 160);
  const phone = parsePhone(b.phone);
  if (name.length < 3) throw new HttpError(400, "Escribe tu nombre completo.");
  if (!phone) throw new HttpError(400, "Revisa tu número de teléfono.");
  if (!emailOk(email)) throw new HttpError(400, "Revisa tu correo: ahí te enviamos la confirmación.");
  return { name, nickname, email, ...phone };
}

function parseReason(raw) {
  const reason = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 300);
  if (reason.length < 3) throw new HttpError(400, "Cuéntanos el motivo (es obligatorio).");
  return reason;
}

function bookingData(session, contact, extra = {}) {
  const now = new Date().toISOString();
  return {
    sessionKey: session.key, slotId: session.slotId, classId: session.classId, classLabel: session.classLabel,
    date: session.date, start: session.start, end: session.end, startAt: session.startAt, endAt: session.endAt,
    name: contact.name, nickname: contact.nickname, display: S.displayName(contact.name, contact.nickname),
    phone: contact.phone, waPhone: contact.waPhone, phoneKey: contact.phoneKey, email: contact.email,
    status: "confirmed", createdAt: now,
    history: [{ type: extra.rescheduledFrom ? "rescheduled-in" : "created", at: now, ...(extra.history || {}) }],
    ...(extra.fields || {})
  };
}

// Dentro de una transacción: comprueba cupo y que la persona no esté ya inscrita, y crea la reserva
async function addInTransaction(db, tx, session, contact, extra) {
  const snap = await tx.get(db.collection("bookings").where("sessionKey", "==", session.key));
  const confirmed = snap.docs.filter(d => d.data().status === "confirmed");
  if (confirmed.length >= session.capacity) throw new HttpError(409, "Esa clase se llenó. Elige otra hora.");
  if (confirmed.some(d => d.data().phoneKey === contact.phoneKey)) {
    throw new HttpError(409, "Ya tienes un cupo en esa clase con este teléfono.");
  }
  const id = newId();
  const data = bookingData(session, contact, extra);
  tx.set(db.collection("bookings").doc(id), data);
  return { id, ...data };
}

async function create(db, session, contact) {
  return db.runTransaction(tx => addInTransaction(db, tx, session, contact));
}

async function find(db, id) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(id || ""))) throw new HttpError(404, "No encontramos esa reserva.");
  const snap = await db.collection("bookings").doc(id).get();
  if (!snap.exists) throw new HttpError(404, "No encontramos esa reserva.");
  return { id: snap.id, ...snap.data() };
}

const contactOf = b => ({ name: b.name, nickname: b.nickname, email: b.email, phone: b.phone, waPhone: b.waPhone, phoneKey: b.phoneKey });
const isFuture = b => new Date(b.startAt).getTime() > Date.now();

// Cancelar: pide motivo y deja el cupo libre
async function cancel(db, id, reason, by = "attendee") {
  return db.runTransaction(async tx => {
    const ref = db.collection("bookings").doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "No encontramos esa reserva.");
    const b = snap.data();
    if (b.status !== "confirmed") throw new HttpError(409, "Esta reserva ya no está activa.");
    if (!isFuture(b)) throw new HttpError(409, "Esa clase ya pasó.");
    const at = new Date().toISOString();
    const patch = {
      status: "cancelled", cancelReason: reason, cancelledAt: at, cancelledBy: by,
      history: [...(b.history || []), { type: "cancelled", at, reason, by }]
    };
    tx.update(ref, patch);
    return { id, ...b, ...patch };
  });
}

// Reprogramar: la reserva vieja queda como "rescheduled" (con su motivo) y se crea otra en la clase nueva
async function reschedule(db, id, reason, newSession) {
  return db.runTransaction(async tx => {
    const ref = db.collection("bookings").doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "No encontramos esa reserva.");
    const old = snap.data();
    if (old.status !== "confirmed") throw new HttpError(409, "Esta reserva ya no está activa.");
    if (!isFuture(old)) throw new HttpError(409, "Esa clase ya pasó.");
    if (newSession.classId !== old.classId) throw new HttpError(400, "Solo puedes cambiarte a otra hora de la misma clase.");
    if (newSession.key === old.sessionKey) throw new HttpError(400, "Elige una hora distinta a la actual.");
    const created = await addInTransaction(db, tx, newSession, contactOf(old), {
      rescheduledFrom: id,
      history: { from: old.sessionKey, reason },
      fields: { rescheduledFrom: id, rescheduleReason: reason }
    });
    const at = new Date().toISOString();
    const patch = {
      status: "rescheduled", rescheduleReason: reason, rescheduledAt: at, movedTo: created.id, movedToKey: newSession.key,
      history: [...(old.history || []), { type: "rescheduled", at, reason, to: newSession.key }]
    };
    tx.update(ref, patch);
    return { old: { id, ...old, ...patch }, created };
  });
}

// Lo que ve quien tiene el enlace de su reserva
function manageView(b) {
  return {
    id: b.id, status: b.status, classId: b.classId, classLabel: b.classLabel,
    date: b.date, start: b.start, end: b.end, startAt: b.startAt, sessionKey: b.sessionKey,
    name: b.name, display: S.displayName(b.name, b.nickname), phone: b.phone, email: b.email,
    cancelReason: b.cancelReason || "", rescheduleReason: b.rescheduleReason || "", movedTo: b.movedTo || "",
    canChange: b.status === "confirmed" && isFuture(b)
  };
}

module.exports = { parseContact, parseReason, create, find, cancel, reschedule, manageView };

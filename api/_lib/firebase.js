/* Firestore con permisos de administrador (salta las reglas).
   Necesita FIREBASE_SERVICE_ACCOUNT en Vercel: el JSON de la cuenta de
   servicio, tal cual o en base64. Ver RESERVAS.md. */
const admin = require("firebase-admin");
const { HttpError } = require("./http");

let db;
function getDb() {
  if (db) return db;
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) throw new HttpError(503, "Las reservas en línea aún no están activas.");
  let cred;
  try {
    cred = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  } catch (e) {
    console.error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido");
    throw new HttpError(503, "Las reservas en línea aún no están activas.");
  }
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) });
  db = admin.firestore();
  return db;
}

// Firebase Auth (cuentas de los deportistas y verificación de sus sesiones)
function getAuth() {
  getDb();
  return admin.auth();
}

module.exports = { getDb, getAuth };

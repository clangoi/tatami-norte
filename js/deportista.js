/* ==========================================================
   Kizuna · Cuenta de deportista (compartido)
   Sesión con Firebase Auth y ficha en athletes/{uid}.
   Lo usan cuenta.html (js/cuenta.js), las páginas con reservas
   (js/sesion.js) y el panel (js/admin-deportistas.js).

   athletes/{uid}   ficha del deportista. Él edita sus datos;
                    plan, vigenteHasta y activo solo los cambia el admin.
   payments/{id}    pagos registrados por el admin (campo uid = dueño).
   ========================================================== */
import { SDK, app, db, fs } from "./firebase.js";

export const A = await import(`${SDK}/firebase-auth.js`);
export const auth = A.getAuth(app);
auth.languageCode = "es";

// Campos que el deportista puede editar (deben calzar con firestore.rules)
export const PROFILE_FIELDS = ["nombre", "apellido", "telefono", "nacimiento", "rut", "disciplinas", "emergenciaNombre", "emergenciaTelefono"];
// Sin estos no se puede reservar
export const REQUIRED = ["nombre", "apellido", "telefono"];

export const isComplete = p => !!p && REQUIRED.every(k => String(p[k] || "").trim());
export const fullName = p => [p?.nombre, p?.apellido].filter(Boolean).join(" ");

export async function getProfile(uid){
  const snap = await fs.getDoc(fs.doc(db, "athletes", uid));
  return snap.exists() ? snap.data() : null;
}

// cb({ user, profile, error }) cada vez que cambia la sesión
export function onAthlete(cb){
  return A.onAuthStateChanged(auth, async user => {
    if (!user) return cb({ user: null, profile: null });
    try {
      cb({ user, profile: await getProfile(user.uid) });
    } catch (error) {
      cb({ user, profile: null, error });
    }
  });
}

/* ---- Fechas y membresía ---- */
const locale = () => window.SITE_CONFIG?.currency?.locale || "es-CL";
export const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD, hora local
export const fmtDate = iso => iso ? new Date(iso + "T12:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" }) : "";

// Suma meses a una fecha AAAA-MM-DD (31 ene + 1 mes → 28/29 feb)
export function addMonths(iso, n){
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  const date = new Date(y, m - 1 + n, Math.min(d, last));
  return date.toLocaleDateString("sv-SE");
}

// Estado de la membresía para mostrar: key = aldia | vencida | sin | inactivo
export function membership(p){
  if (p?.activo === false) return { key: "inactivo", label: "Cuenta inactiva" };
  const until = p?.vigenteHasta;
  if (!until) return { key: "sin", label: "Sin membresía" };
  return until >= today()
    ? { key: "aldia", label: `Al día hasta el ${fmtDate(until)}` }
    : { key: "vencida", label: `Vencida el ${fmtDate(until)}` };
}

export const METHODS = { mercadopago: "Mercado Pago", transferencia: "Transferencia", efectivo: "Efectivo", tarjeta: "Tarjeta", otro: "Otro" };

// Mensajes de Firebase Auth en español
export function authError(e){
  const map = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-email": "Revisa el correo.",
    "auth/missing-password": "Escribe tu contraseña.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Entra con tu contraseña.",
    "auth/operation-not-allowed": "El registro de cuentas no está habilitado todavía. Escríbenos por Instagram o WhatsApp.",
    "auth/admin-restricted-operation": "El registro de cuentas no está habilitado todavía. Escríbenos por Instagram o WhatsApp.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/requires-recent-login": "Por seguridad, escribe tu contraseña otra vez.",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet."
  };
  return map[e.code] || "Algo falló. Intenta otra vez.";
}

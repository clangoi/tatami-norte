/* ==========================================================
   Kizuna · Mi cuenta (cuenta.html)
   Registro e inicio de sesión del deportista, su perfil en
   athletes/{uid}, su membresía y sus pagos (solo lectura).
   ========================================================== */
import { db, fs } from "./firebase.js";
import {
  A, auth, PROFILE_FIELDS, isComplete, fullName, getProfile,
  today, fmtDate, membership, METHODS, authError
} from "./deportista.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const S = window.SITE;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const phoneOk = v => v.replace(/\D/g, "").length >= 8;

function toast(msg){
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3200);
}

/* ---- Adónde volver después de entrar (solo rutas de este sitio) ---- */
const params = new URLSearchParams(location.search);
const rawNext = params.get("next") || "";
const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "";
if (next) {
  $("#nextLink").href = next;
  $("#nextLink").textContent = next.endsWith("#planes") ? "Volver a los planes" : "Ir a reservar";
}

/* ---- RUT chileno: valida el dígito verificador y lo formatea ---- */
function normRut(v){
  const clean = v.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1), dv = clean.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) { sum += +body[i] * mul; mul = mul === 7 ? 2 : mul + 1; }
  const exp = 11 - (sum % 11);
  const ok = exp === 11 ? "0" : exp === 10 ? "K" : String(exp);
  if (dv !== ok) return null;
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

/* ---------- Vistas ---------- */
const views = ["vLoading", "vAuth", "vProfile"];
const show = id => views.forEach(v => $("#" + v).hidden = v !== id);

function setMode(mode){
  $$("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
  $("#loginForm").hidden = mode !== "login";
  $("#regForm").hidden = mode !== "registro";
}
$$("[data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
setMode(params.get("modo") === "registro" ? "registro" : "login");

/* ---------- Sesión ---------- */
// Marca que el inicio de sesión se hizo en esta página (no una sesión anterior)
function justSignedIn(){
  try {
    const v = sessionStorage.getItem("tn_just_signed_in");
    sessionStorage.removeItem("tn_just_signed_in");
    return !!v;
  } catch { return false; }
}
let user = null, profile = null;
let registering = false;   // mientras se crea la ficha, no dibujar el perfil vacío

A.onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { show("vAuth"); return; }
  if (registering) return;
  try {
    profile = await getProfile(u.uid);
  } catch (e) {
    console.warn(e);
    profile = null;
  }
  // Venía a reservar y ya puede: de vuelta
  if (next && isComplete(profile) && justSignedIn()) {
    location.replace(next);
    return;
  }
  renderProfile();
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  $("#lErr").textContent = "";
  try {
    try { sessionStorage.setItem("tn_just_signed_in", "1"); } catch {}
    await A.signInWithEmailAndPassword(auth, $("#lEmail").value.trim(), $("#lPass").value);
    $("#lPass").value = "";
  } catch (err) {
    try { sessionStorage.removeItem("tn_just_signed_in"); } catch {}
    $("#lErr").textContent = authError(err);
  } finally { btn.disabled = false; }
});

$("#forgot").addEventListener("click", async () => {
  const email = $("#lEmail").value.trim();
  if (!emailOk(email)) { $("#lErr").textContent = "Escribe tu correo arriba y vuelve a presionar."; $("#lEmail").focus(); return; }
  try {
    await A.sendPasswordResetEmail(auth, email);
    $("#lErr").textContent = "";
    toast("Si el correo tiene cuenta, te llegará un enlace para cambiar la contraseña");
  } catch (err) { $("#lErr").textContent = authError(err); }
});

$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#rErr");
  const data = {
    nombre: $("#rNombre").value.trim(),
    apellido: $("#rApellido").value.trim(),
    telefono: $("#rTel").value.trim()
  };
  const email = $("#rEmail").value.trim(), pass = $("#rPass").value;
  if (!data.nombre || !data.apellido) { err.textContent = "Escribe tu nombre y apellido."; return; }
  if (!phoneOk(data.telefono)) { err.textContent = "Revisa el teléfono: al menos 8 dígitos."; $("#rTel").focus(); return; }
  if (!emailOk(email)) { err.textContent = "Revisa el correo."; $("#rEmail").focus(); return; }
  if (pass.length < 8) { err.textContent = "La contraseña debe tener al menos 8 caracteres."; $("#rPass").focus(); return; }
  if (!$("#rOk").checked) { err.textContent = "Necesitamos tu autorización para guardar tus datos."; return; }

  const btn = e.submitter; btn.disabled = true; err.textContent = "";
  registering = true;
  try {
    const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
    const u = cred.user;
    profile = { ...data, email: u.email, disciplinas: [], createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() };
    await fs.setDoc(fs.doc(db, "athletes", u.uid), profile);
    A.updateProfile(u, { displayName: fullName(data) }).catch(() => {});
    A.sendEmailVerification(u).catch(() => {});
    registering = false;
    user = u;
    if (next) { location.replace(next); return; }
    renderProfile();
    toast("Cuenta creada. Te enviamos un correo para confirmarlo");
  } catch (e2) {
    registering = false;
    err.textContent = authError(e2);
    // La cuenta se creó pero la ficha no: se completa en el perfil
    if (auth.currentUser) { profile = null; renderProfile(); }
  } finally { btn.disabled = false; }
});

/* ---------- Perfil ---------- */
const DISCIPLINES = S.config.athletes?.disciplines || [];
const P = {
  nombre: $("#pNombre"), apellido: $("#pApellido"), telefono: $("#pTel"), rut: $("#pRut"),
  nacimiento: $("#pNac"), emergenciaNombre: $("#pEmNombre"), emergenciaTelefono: $("#pEmTel")
};
P.nacimiento.max = today();

function renderProfile(){
  show("vProfile");
  const p = profile || {};
  $("#hello").textContent = p.nombre ? `Hola, ${p.nombre}` : "Tu perfil";
  $("#email").textContent = user.email;
  $("#unverified").hidden = user.emailVerified;
  $("#incomplete").hidden = isComplete(profile);
  $("#nextLink").hidden = !(next && isComplete(profile));

  Object.entries(P).forEach(([k, el]) => { el.value = p[k] || ""; });
  const mine = new Set(p.disciplinas || []);
  $("#pDisc").innerHTML = DISCIPLINES.map(d =>
    `<button type="button" aria-pressed="${mine.has(d)}" data-disc="${esc(d)}">${esc(d)}</button>`).join("");

  const m = membership(p);
  $("#mStatus").innerHTML = `<span class="acc-tag is-${m.key}">${esc(m.label)}</span>`;
  $("#mPlan").textContent = p.plan ? `Plan ${p.plan}` : "";
  $("#mPlan").hidden = !p.plan;

  const link = document.querySelector("[data-account-link]");
  if (link) link.textContent = p.nombre ? `Hola, ${p.nombre}` : "Mi cuenta";

  loadPayments();
}

$("#pDisc").addEventListener("click", e => {
  const b = e.target.closest("[data-disc]");
  if (b) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
});

$("#profileForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#pErr");
  const data = Object.fromEntries(Object.entries(P).map(([k, el]) => [k, el.value.trim()]));
  data.disciplinas = $$("#pDisc [aria-pressed=true]").map(b => b.dataset.disc);
  if (!data.nombre || !data.apellido) { err.textContent = "Escribe tu nombre y apellido."; return; }
  if (!phoneOk(data.telefono)) { err.textContent = "Revisa el teléfono: al menos 8 dígitos."; P.telefono.focus(); return; }
  if (data.rut) {
    const r = normRut(data.rut);
    if (!r) { err.textContent = "El RUT no es válido. Revisa el dígito verificador."; P.rut.focus(); return; }
    data.rut = P.rut.value = r;
  }
  if (data.emergenciaTelefono && !phoneOk(data.emergenciaTelefono)) { err.textContent = "Revisa el teléfono de emergencia."; P.emergenciaTelefono.focus(); return; }

  const clean = Object.fromEntries(PROFILE_FIELDS.map(k => [k, data[k] ?? ""]));
  const btn = e.submitter; btn.disabled = true; err.textContent = "";
  try {
    const ref = fs.doc(db, "athletes", user.uid);
    if (profile) {
      await fs.updateDoc(ref, { ...clean, updatedAt: fs.serverTimestamp() });
      profile = { ...profile, ...clean };
    } else {
      profile = { ...clean, email: user.email, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() };
      await fs.setDoc(ref, profile);
    }
    A.updateProfile(user, { displayName: fullName(clean) }).catch(() => {});
    renderProfile();
    toast("Datos guardados");
    if (next && isComplete(profile)) $("#nextLink").focus();
  } catch (e2) {
    console.warn(e2);
    err.textContent = e2.code === "permission-denied"
      ? "No se pudo guardar. Recarga la página e intenta otra vez."
      : "No se pudo guardar. Revisa tu conexión.";
  } finally { btn.disabled = false; }
});

/* ---------- Pagos ---------- */
async function loadPayments(){
  const box = $("#payments");
  try {
    const q = fs.query(fs.collection(db, "payments"), fs.where("uid", "==", user.uid));
    const list = (await fs.getDocs(q)).docs.map(d => d.data()).sort((a, b) => b.date.localeCompare(a.date));
    box.innerHTML = list.length
      ? `<ul class="acc-pays">${list.map(p => `<li>
          <div><b>${S.money(p.amount)}</b><span>${esc(p.planName ? "Plan " + p.planName : METHODS[p.method] || "")}${p.estado ? " · Reembolsado" : ""}</span></div>
          <div class="acc-pay-meta">${fmtDate(p.date)}<span>${esc(METHODS[p.method] || "")}</span></div>
        </li>`).join("")}</ul>`
      : '<p class="acc-help">Todavía no hay pagos registrados.</p>';
  } catch (e) {
    console.warn(e);
    box.innerHTML = '<p class="acc-help">No pudimos cargar tus pagos. Recarga la página.</p>';
  }
}

/* ---------- Cuenta ---------- */
$("#resend").addEventListener("click", async () => {
  try { await A.sendEmailVerification(user); toast("Te reenviamos el correo de confirmación"); }
  catch (err) { toast(authError(err)); }
});

$("#changePass").addEventListener("click", async () => {
  try { await A.sendPasswordResetEmail(auth, user.email); toast(`Te enviamos un enlace a ${user.email}`); }
  catch (err) { toast(authError(err)); }
});

$("#logout").addEventListener("click", () => A.signOut(auth));

$("#deleteForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#dErr");
  const pass = $("#dPass").value;
  if (!pass) { err.textContent = "Escribe tu contraseña para confirmar."; return; }
  if (!confirm("¿Eliminar tu cuenta y tus datos? No se puede deshacer.")) return;
  const btn = e.submitter; btn.disabled = true; err.textContent = "";
  try {
    await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, pass));
    await fs.deleteDoc(fs.doc(db, "athletes", user.uid)).catch(() => {});
    await A.deleteUser(user);
    location.replace("index.html");
  } catch (e2) {
    err.textContent = authError(e2);
    btn.disabled = false;
  }
});

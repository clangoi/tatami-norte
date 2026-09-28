/* ==========================================================
   Kizuna · Panel → Deportistas (admin.html)
   Lista de deportistas, su ficha, su membresía y sus pagos.
   athletes/{uid}  la crea el deportista al registrarse (cuenta.html)
   payments/{id}   pagos registrados aquí
   Se carga desde js/admin.js una vez confirmado que es admin.
   ========================================================== */
import { db, fs } from "./firebase.js";
import { PROFILE_FIELDS, fullName, today, fmtDate, addMonths, membership, METHODS } from "./deportista.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const S = window.SITE;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const parseAmount = v => { const d = String(v).replace(/\D/g, ""); return d ? +d : null; };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const DISCIPLINES = S.config.athletes?.disciplines || [];

let toast = () => {}, saveError = e => String(e);
let athletes = [];       // [{ uid, ...ficha }]
let plans = [];          // para los selectores de plan
let filter = "todos";
let current = null;      // ficha abierta
let loaded = false;

export function initAthletes(helpers){
  ({ toast, saveError } = helpers);
  // Se cargan la primera vez que se abre la pestaña
  $$('[data-tab]').forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tab !== "athletes") return;
    closeDetail();
    if (!loaded) load();
  }));
}

async function load(){
  loaded = true;
  $("#athRows").innerHTML = '<p class="adm-loading">Cargando deportistas…</p>';
  try {
    const [a, p, pays] = await Promise.all([
      fs.getDocs(fs.collection(db, "athletes")),
      fs.getDocs(fs.collection(db, "plans")),
      fs.getDocs(fs.query(fs.collection(db, "payments"), fs.where("date", ">=", today().slice(0, 7) + "-01")))
    ]);
    athletes = a.docs.map(d => ({ ...d.data(), uid: d.id }))
      .sort((x, y) => norm(fullName(x)).localeCompare(norm(fullName(y))));
    plans = p.docs.map(d => ({ ...d.data(), id: d.id })).sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
    renderStats(pays.docs.map(d => d.data()));
    renderList();
  } catch (e) {
    console.warn(e);
    loaded = false;
    $("#athRows").innerHTML = `<p class="err">${esc(saveError(e))}</p>`;
  }
}

function renderStats(monthPays){
  const total = monthPays.reduce((n, p) => n + (p.amount || 0), 0);
  const aldia = athletes.filter(a => membership(a).key === "aldia").length;
  $("#athStats").innerHTML = `
    <span><b>${athletes.length}</b> deportistas</span>
    <span><b>${aldia}</b> al día</span>
    <span><b>${S.money(total)}</b> cobrado este mes</span>`;
}

/* ---------- Lista ---------- */
function renderList(){
  const q = norm($("#athSearch").value.trim());
  const list = athletes.filter(a => {
    if (filter !== "todos" && membership(a).key !== filter) return false;
    if (!q) return true;
    return norm([fullName(a), a.email, a.telefono, a.rut, a.uid].join(" ")).includes(q)
      || String(a.telefono || "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~");
  });
  if (!athletes.length) {
    $("#athRows").innerHTML = '<p class="adm-empty">Todavía no hay deportistas registrados. Comparte el enlace <b>/cuenta</b> para que creen su cuenta.</p>';
    return;
  }
  $("#athRows").innerHTML = list.length ? list.map(a => {
    const m = membership(a);
    return `<div class="adm-row">
      <div class="adm-row-main">
        <b>${esc(fullName(a) || a.email)}</b>
        <span>${esc([a.email, a.telefono, a.plan && "Plan " + a.plan].filter(Boolean).join(" · "))}</span>
      </div>
      <span class="adm-tag ${m.key === "aldia" ? "on" : m.key === "vencida" || m.key === "inactivo" ? "warn" : ""}">${esc(m.label)}</span>
      <div class="adm-row-actions"><button class="btn small ghost" type="button" data-open="${esc(a.uid)}">Ver ficha</button></div>
    </div>`;
  }).join("") : '<p class="adm-empty">Nadie coincide con la búsqueda.</p>';
}

$("#athSearch").addEventListener("input", renderList);
$("#athFilters").addEventListener("click", e => {
  const b = e.target.closest("[data-f]"); if (!b) return;
  filter = b.dataset.f;
  $$("#athFilters [data-f]").forEach(x => x.setAttribute("aria-pressed", x === b));
  renderList();
});
$("#athRows").addEventListener("click", e => {
  const b = e.target.closest("[data-open]");
  if (b) openDetail(athletes.find(a => a.uid === b.dataset.open));
});

/* ---------- Ficha ---------- */
const F = {
  nombre: $("#aNombre"), apellido: $("#aApellido"), telefono: $("#aTel"), rut: $("#aRut"),
  nacimiento: $("#aNac"), emergenciaNombre: $("#aEmNombre"), emergenciaTelefono: $("#aEmTel")
};

const planOptions = (selected, empty) =>
  `<option value="">${empty}</option>` + plans.map(p =>
    `<option value="${esc(p.name)}"${p.name === selected ? " selected" : ""}>${esc(p.name)}${p.price ? " · " + S.money(p.price) : ""}</option>`).join("")
  + (selected && !plans.some(p => p.name === selected) ? `<option selected>${esc(selected)}</option>` : "");

function openDetail(a){
  current = a;
  $("#athList").hidden = true;
  $("#athDetail").hidden = false;
  paintHeader();

  // Membresía
  $("#mPlan").innerHTML = planOptions(a.plan || "", "Sin plan");
  $("#mUntil").value = a.vigenteHasta || "";
  $("#mActive").checked = a.activo !== false;
  $("#memErr").textContent = "";

  // Pago nuevo: plan y monto sugeridos según su plan actual
  $("#yPlan").innerHTML = planOptions(a.plan || "", "Sin plan");
  $("#yDate").value = today();
  $("#yNote").value = "";
  $("#yExtend").checked = true;
  $("#yMonths").value = "1";
  suggestAmount();
  $("#payErr").textContent = "";

  // Datos personales
  Object.entries(F).forEach(([k, el]) => { el.value = a[k] || ""; });
  const mine = new Set(a.disciplinas || []);
  $("#aDisc").innerHTML = [...new Set([...DISCIPLINES, ...mine])].map(d =>
    `<button type="button" aria-pressed="${mine.has(d)}" data-disc="${esc(d)}">${esc(d)}</button>`).join("");
  $("#athErr").textContent = "";

  loadPayments();
  window.scrollTo({ top: 0 });
}

function paintHeader(){
  const a = current, m = membership(a);
  $("#athName").textContent = fullName(a) || a.email;
  $("#athMeta").textContent = [a.email, a.telefono, a.rut, `UID ${a.uid}`].filter(Boolean).join(" · ");
  $("#athStatus").innerHTML = `<span class="adm-tag ${m.key === "aldia" ? "on" : m.key === "vencida" || m.key === "inactivo" ? "warn" : ""}">${esc(m.label)}</span>`;
}

function closeDetail(){
  current = null;
  $("#athDetail").hidden = true;
  $("#athList").hidden = false;
}

$("[data-ath-back]").addEventListener("click", () => { closeDetail(); renderList(); });

$("#aDisc").addEventListener("click", e => {
  const b = e.target.closest("[data-disc]");
  if (b) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
});

// Guarda cambios en la ficha y en la lista local
async function saveAthlete(changes){
  await fs.updateDoc(fs.doc(db, "athletes", current.uid), { ...changes, updatedAt: fs.serverTimestamp() });
  Object.assign(current, changes);
  paintHeader();
}

$("#memForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true; $("#memErr").textContent = "";
  try {
    await saveAthlete({ plan: $("#mPlan").value, vigenteHasta: $("#mUntil").value, activo: $("#mActive").checked });
    toast("Membresía guardada");
  } catch (err) { $("#memErr").textContent = saveError(err); }
  finally { btn.disabled = false; }
});

$("#athForm").addEventListener("submit", async e => {
  e.preventDefault();
  const data = Object.fromEntries(Object.entries(F).map(([k, el]) => [k, el.value.trim()]));
  data.disciplinas = $$("#aDisc [aria-pressed=true]").map(b => b.dataset.disc);
  if (!data.nombre || !data.apellido) { $("#athErr").textContent = "Nombre y apellido son obligatorios."; return; }
  const clean = Object.fromEntries(PROFILE_FIELDS.map(k => [k, data[k] ?? ""]));
  const btn = e.submitter; btn.disabled = true; $("#athErr").textContent = "";
  try {
    await saveAthlete(clean);
    toast("Datos guardados");
  } catch (err) { $("#athErr").textContent = saveError(err); }
  finally { btn.disabled = false; }
});

$("#athDelete").addEventListener("click", async () => {
  if (!confirm(`¿Borrar la ficha de ${fullName(current) || current.email}? Sus pagos se conservan.`)) return;
  try {
    await fs.deleteDoc(fs.doc(db, "athletes", current.uid));
    athletes = athletes.filter(a => a !== current);
    closeDetail();
    renderList();
    toast("Ficha borrada");
  } catch (err) { alert(saveError(err)); }
});

/* ---------- Pagos ---------- */
function suggestAmount(){
  const p = plans.find(x => x.name === $("#yPlan").value);
  $("#yAmount").value = p?.price ? p.price.toLocaleString(S.config.currency?.locale || "es-CL") : "";
  previewUntil();
}

// Nueva fecha de vencimiento: desde hoy si estaba vencida, o desde su vencimiento si sigue al día
function newUntil(){
  const base = current?.vigenteHasta && current.vigenteHasta >= today() ? current.vigenteHasta : today();
  return addMonths(base, +$("#yMonths").value);
}
function previewUntil(){
  $("#yMonths").disabled = !$("#yExtend").checked;
  $("#yUntil").textContent = $("#yExtend").checked ? `Quedará al día hasta el ${fmtDate(newUntil())}` : "";
}
$("#yPlan").addEventListener("change", suggestAmount);
$("#yExtend").addEventListener("change", previewUntil);
$("#yMonths").addEventListener("change", previewUntil);

$("#payForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#payErr");
  const amount = parseAmount($("#yAmount").value);
  const date = $("#yDate").value;
  if (!amount) { err.textContent = "Escribe el monto, por ejemplo 45.000."; $("#yAmount").focus(); return; }
  if (!date) { err.textContent = "Falta la fecha."; return; }

  const payment = {
    uid: current.uid,
    athleteName: fullName(current),
    amount, date,
    method: $("#yMethod").value,
    planName: $("#yPlan").value,
    note: $("#yNote").value.trim(),
    createdAt: fs.serverTimestamp()
  };
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(fs.collection(db, "payments")), payment);
  let changes = null;
  if ($("#yExtend").checked) {
    changes = { vigenteHasta: newUntil(), activo: true, ...(payment.planName ? { plan: payment.planName } : {}) };
    batch.update(fs.doc(db, "athletes", current.uid), { ...changes, updatedAt: fs.serverTimestamp() });
  }
  const btn = e.submitter; btn.disabled = true; err.textContent = "";
  try {
    await batch.commit();
    if (changes) {
      Object.assign(current, changes);
      paintHeader();
      $("#mUntil").value = current.vigenteHasta;
      $("#mPlan").innerHTML = planOptions(current.plan || "", "Sin plan");
      $("#mActive").checked = true;
    }
    $("#yNote").value = "";
    previewUntil();
    loadPayments();
    toast(`Pago de ${S.money(amount)} registrado`);
  } catch (e2) { err.textContent = saveError(e2); }
  finally { btn.disabled = false; }
});

async function loadPayments(){
  const box = $("#athPays");
  const uid = current.uid;
  box.innerHTML = '<p class="adm-loading">Cargando pagos…</p>';
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, "payments"), fs.where("uid", "==", uid)));
    if (current?.uid !== uid) return;
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => b.date.localeCompare(a.date));
    box.innerHTML = list.length ? `<ul class="adm-pays">${list.map(p => `<li>
        <div><b>${S.money(p.amount)}</b><span>${esc([METHODS[p.method], p.planName && "Plan " + p.planName].filter(Boolean).join(" · "))}</span>${p.note ? `<small>${esc(p.note)}</small>` : ""}</div>
        <div class="adm-pay-side">${fmtDate(p.date)}<button class="adm-link adm-danger-link" type="button" data-pay-del="${esc(p.id)}">Borrar</button></div>
      </li>`).join("")}</ul>` : '<p class="adm-empty">Sin pagos registrados.</p>';
  } catch (e) {
    console.warn(e);
    box.innerHTML = `<p class="err">${esc(saveError(e))}</p>`;
  }
}

$("#athPays").addEventListener("click", async e => {
  const b = e.target.closest("[data-pay-del]"); if (!b) return;
  if (!confirm("¿Borrar este pago? La fecha de vencimiento de la membresía no cambia; ajústala a mano si hace falta.")) return;
  try {
    await fs.deleteDoc(fs.doc(db, "payments", b.dataset.payDel));
    loadPayments();
    toast("Pago borrado");
  } catch (err) { alert(saveError(err)); }
});

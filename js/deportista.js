/* ==========================================================
   Kizuna · Panel del deportista (deportista.html)
   Misma estructura que el panel de administración (js/admin.js): vistas de carga,
   entrada y panel; pestañas arriba; listas en filas. Entra con el correo y la clave
   que creó con el enlace del correo (Firebase Auth) y habla con /api/deportista.
   Secciones: Resumen (contadores) · Próximas (reagendar, cancelar) · Historial (calendario mensual: al tocar un día se abre el detalle) · Mi perfil (datos, contacto de emergencia y ficha médica).
   ========================================================== */
import { SDK, app as fbApp } from "./firebase.js";
import { infoTip } from "./admin-info.js";

const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } = await import(`${SDK}/firebase-auth.js`);

const auth = getAuth(fbApp);
auth.languageCode = "es";

const $ = (s, r = document) => r.querySelector(s);
const SITE = window.SITE_CONFIG || {};
const locale = (SITE.currency && SITE.currency.locale) || "es-CL";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dayLabel = date => new Date(date + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
const monthLabel = ym => new Date(ym + "-01T12:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" });
const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: (SITE.booking && SITE.booking.timeZone) || "America/Santiago" });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const toast = msg => {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3000);
};

const MEDICAL = !!((window.SITE_CONFIG || {}).features || {}).medicalRecord;   // ficha médica en pausa (site.config.js → features)
const RANKS = !!((window.SITE_CONFIG || {}).features || {}).athleteRanks;   // tarjeta «Mis grados» en pausa (site.config.js → features)
const TABS = [["sum", "Resumen"], ["next", "Próximas"], ["me", "Mi perfil"]];
let data = null;
let tab = "sum";
let month = todayStr().slice(0, 7);
let calDay = "";
let survey = null;          // reserva cuya encuesta se está respondiendo
const SURVEY_DAYS = 7;      // plazo para responder la encuesta de una clase
const SURVEY_LEAD_MIN = 20; // se habilita 20 minutos antes de que termine la clase
let openPanel = null;       // { id, kind: "cancel" | "reschedule" }

const api = async (body) => {
  const token = await auth.currentUser.getIdToken();
  const r = await fetch("/api/deportista", body
    ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) }
    : { headers: { Authorization: "Bearer " + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "No se pudo completar. Intenta de nuevo."), { status: r.status });
  return j;
};

function authError(e) {
  const map = {
    "auth/invalid-credential": "Correo o clave incorrectos.",
    "auth/invalid-email": "Revisa el correo.",
    "auth/missing-password": "Escribe tu clave.",
    "auth/user-disabled": "Tu cuenta está desactivada. Escríbenos.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet."
  };
  return map[e.code] || "No se pudo entrar. Intenta otra vez.";
}

/* ---------- Vistas ---------- */
const views = ["vLoading", "vLogin", "vDenied", "vApp"];
const show = id => views.forEach(v => $("#" + v).hidden = v !== id);

/* ---------- Sesión ---------- */
onAuthStateChanged(auth, async user => {
  $("#logout").hidden = !user;
  $("#who").hidden = !user;
  data = null;
  try { user ? localStorage.setItem("tn_athlete", "1") : localStorage.removeItem("tn_athlete"); } catch (e) {}
  if (!user) { show("vLogin"); return; }
  $("#who").textContent = user.email;
  show("vLoading");
  await load();
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  $("#lErr").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#lEmail").value.trim(), $("#lPass").value);
    $("#lPass").value = "";
  } catch (err) {
    $("#lErr").textContent = authError(err);
  } finally { btn.disabled = false; }
});

// El correo de restablecer sale del servidor (diseño de la escuela y enlace de vuelta a este panel)
const askReset = email => fetch("/api/clave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });

$("#forgot").addEventListener("click", async () => {
  const email = $("#lEmail").value.trim();
  if (!email) { $("#lErr").textContent = "Escribe tu correo arriba y vuelve a presionar."; return; }
  $("#lErr").textContent = "";
  try {
    await askReset(email);
    toast("Si tu cuenta existe, te enviamos un correo para crear una clave nueva");
  } catch (ex) { $("#lErr").textContent = "Sin conexión. Revisa tu internet."; }
});

const logout = () => signOut(auth);
$("#logout").addEventListener("click", logout);
$("#deniedOut").addEventListener("click", logout);

async function load() {
  try {
    data = await api();
    show("vApp");
    render();
  } catch (ex) {
    if (ex.status === 403) { $("#deniedMsg").textContent = ex.message; show("vDenied"); return; }
    show("vApp");
    $("#tabs").innerHTML = "";
    $("#body").innerHTML = `<p class="err">${esc(ex.message)}</p><button class="btn small" type="button" data-reload>Reintentar</button>`;
  }
}

/* ---------- Dibujo ---------- */
const counters = (title, list) => `<div class="adm-cfg"><h3>${title}</h3>${list.length
  ? list.map(c => `<div class="ath-stat"><b>${c.count}</b><span>${esc(c.name)}</span></div>`).join("")
  : '<p class="adm-help adm-cfg-empty">Aún sin clases tomadas</p>'}</div>`;

const shortDate = iso => iso ? new Date(iso + "T12:00:00").toLocaleDateString(locale, { month: "short", year: "numeric" }) : "";

function attendanceCard() {
  const a = data.attendance || { total: 0, last90: 0 };
  return `<div class="adm-cfg"><h3>Asistencias</h3>
    <div class="ath-stat"><b>${a.total}</b><span>${a.total === 1 ? "clase asistida" : "clases asistidas"}</span></div>
    <div class="ath-stat"><b>${a.last90}</b><span>en los últimos 90 días</span></div></div>`;
}

function ranksCard() {
  const list = Object.entries(data.ranks || {});
  return `<div class="adm-cfg"><h3>Mis grados</h3>${list.length
    ? list.map(([d, r]) => `<div class="ath-stat ath-rank"><b>${esc(r.grade)}</b><span>${esc(d)}${r.since ? " · desde " + esc(shortDate(r.since)) : ""}<small>${r.count} ${r.count === 1 ? "clase asistida" : "clases asistidas"} desde este grado</small></span></div>`).join("")
    : '<p class="adm-help adm-cfg-empty">Tu instructor registrará tu grado en cada disciplina.</p>'}</div>`;
}

function summary() {
  const s = data.summary;
  return `<div class="adm-bar"><h2>Mi resumen</h2></div>
    ${infoTip("Las disciplinas y los clubes salen solos de tus reservas: cuentan las confirmadas cuya clase ya pasó. Las clases que cancelas o cambias no suman. «Asistencias» es distinto: son las clases a las que realmente llegaste (las registras respondiendo la encuesta, o las marca tu instructor), y son las que cuentan para tus grados.")}
    <div class="adm-cfg-grid ath-sum">
      <div class="adm-cfg"><h3>Clases</h3>
        <div class="ath-stat"><b>${s.taken}</b><span>${s.taken === 1 ? "tomada" : "tomadas"}</span></div>
        <div class="ath-stat"><b>${s.upcoming}</b><span>${s.upcoming === 1 ? "próxima" : "próximas"}</span></div></div>
      ${attendanceCard()}${RANKS ? ranksCard() : ""}${counters("Por club", s.clubs)}${counters("Por disciplina", s.disciplines)}${counters("Por tipo", s.types)}
    </div>
    ${viewCal()}`;   // el historial va debajo de los contadores
}

// Avisos arriba de todas las secciones hasta que los datos y la ficha estén completos
function notices() {
  const todo = [];
  if (!data.profile.complete) todo.push("tus datos de contacto (necesarios para reservar)");
  if (MEDICAL && !data.medical) todo.push("tu ficha médica");
  const pend = tab !== "sum" ? pendingSurveys().length : 0;
  if (!todo.length && !pend) return "";
  if (tab === "me" && !pend) return "";
  return `<div class="ath-notice" role="note"><span>${[todo.length ? `Falta completar ${todo.join(" y ")}.` : "", pend ? `Tienes ${pend} ${pend === 1 ? "clase por registrar" : "clases por registrar"}: responde la encuesta.` : ""].filter(Boolean).join(" ")}</span>
    <button class="btn small" type="button" data-go="${todo.length ? "me" : "sum"}">${todo.length ? "Completar" : "Ver"}</button></div>`;
}

function viewProfile() {
  const p = data.profile, m = data.medical || {};
  const f = (id, name, label, val, extra = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${name}" value="${esc(val)}" ${extra}></div>`;
  const t = (name, label, val, max) => `<div class="field"><label>${label}</label><textarea name="${name}" rows="2" maxlength="${max}">${esc(val || "")}</textarea></div>`;
  return `<form class="adm-editor ath-form" data-profile novalidate>
      <div class="adm-bar"><h2>Mis datos</h2><div class="adm-actions"><button class="btn" type="submit">Guardar</button></div></div>
      ${infoTip("Tu nombre y tu teléfono se usan al reservar. En las listas de inscritos los demás ven tu apodo, o tu nombre con la inicial de tu apellido. Tu correo es tu usuario y no se cambia desde aquí.")}
      <div class="row2">${f("pName", "name", "Nombre y apellido", p.name, 'maxlength="80" required')}${f("pNick", "nickname", "Apodo (opcional)", p.nickname, 'maxlength="30"')}</div>
      <div class="row2">${f("pPhone", "phone", "Teléfono", p.phone, 'type="tel" inputmode="tel" placeholder="+56 9 1234 5678" required')}
        <div class="field"><label>Correo</label><input value="${esc(p.email)}" readonly></div></div>
      <div class="row2">${f("pEmN", "emergencyName", "Contacto de emergencia", p.emergencyName, 'maxlength="80" placeholder="Nombre"')}
        ${f("pEmP", "emergencyPhone", "Teléfono de emergencia", p.emergencyPhone, 'type="tel" inputmode="tel" placeholder="+56 9 1234 5678"')}</div>
      <div class="err" data-err role="alert"></div>
    </form>
    ${MEDICAL ? medicalForm(m) : ""}`;
}

function medicalForm(m) {
  const f = (id, name, label, val, extra = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${name}" value="${esc(val)}" ${extra}></div>`;
  const t = (name, label, val, max) => `<div class="field"><label>${label}</label><textarea name="${name}" rows="2" maxlength="${max}">${esc(val || "")}</textarea></div>`;
  return `<form class="adm-editor ath-form" data-medical novalidate>
      <div class="adm-bar"><h2>Ficha médica</h2><div class="adm-actions"><button class="btn" type="submit">Guardar ficha</button></div></div>
      ${infoTip("Es información sensible: solo el equipo de la escuela la ve, y únicamente para actuar en una emergencia. Puedes actualizarla cuando quieras.")}
      ${t("conditions", "Condiciones médicas (asma, diabetes, problemas cardíacos…)", m.conditions, 500)}
      ${t("injuries", "Lesiones actuales o recientes", m.injuries, 500)}
      <div class="row2">${t("allergies", "Alergias", m.allergies, 300)}${t("medications", "Medicamentos que usas", m.medications, 300)}</div>
      <div class="row2">${f("mBlood", "bloodType", "Grupo sanguíneo (opcional)", m.bloodType, 'maxlength="8" placeholder="O+"')}
        ${f("mIns", "insurance", "Previsión o seguro (Fonasa, Isapre…)", m.insurance, 'maxlength="80"')}</div>
      <label class="check"><input type="checkbox" name="consent"${m.consentAt ? " checked" : ""}> Declaro que estos datos son verdaderos y autorizo a la escuela a usarlos para atenderme en caso de emergencia. Sé que también debo avisar a mi instructor de cualquier cambio.</label>
      ${m.updatedAt ? `<small class="adm-help">Última actualización: ${esc(new Date(m.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }))}</small>` : ""}
      <div class="err" data-err role="alert"></div>
    </form>`;
}

// Clases que están por terminar (20 min antes) o ya terminaron, sin asistencia registrada y dentro del plazo: se registran respondiendo la encuesta
const canSurvey = b => b.status === "confirmed" && b.attended === null && !!b.endAt
  && new Date(b.endAt).getTime() - SURVEY_LEAD_MIN * 60000 <= Date.now() && Date.now() - new Date(b.endAt) <= SURVEY_DAYS * 86400000;
const pendingSurveys = () => data.bookings.filter(canSurvey).sort((a, b) => b.startAt.localeCompare(a.startAt));

function surveyModal() {
  const b = data.bookings.find(x => x.id === survey);
  if (!b) return "";
  return `<div class="adm-modal">
    <div class="adm-modal-bg" data-close-survey></div>
    <section class="adm-detail" role="dialog" aria-modal="true" aria-label="Encuesta de la clase" tabindex="-1">
      <div class="adm-detail-head">
        <h3 class="adm-detail-title">${esc(b.classLabel)}</h3>
        <button class="btn small ghost" type="button" data-close-survey>Cerrar</button>
      </div>
      <p class="adm-help">${esc(cap(dayLabel(b.date)))} · ${esc(b.start)}–${esc(b.end)}</p>
      <form class="ath-survey" data-survey-form data-id="${esc(b.id)}" novalidate>
        <fieldset class="field"><legend>¿Qué tan cansado quedaste con el entrenamiento?</legend>
          <div class="ath-scale">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<label><input type="radio" name="fatigue" value="${n}"><span>${n}</span></label>`).join("")}</div>
          <div class="ath-scale-ends"><span>1 · Muy suave</span><span>10 · Agotado</span></div></fieldset>
        <div class="field"><label for="svComment">Comentarios (opcional)</label>
          <textarea id="svComment" name="comment" rows="3" maxlength="500" placeholder="¿Cómo te sentiste? ¿Algo que quieras contarle a tu instructor?"></textarea></div>
        <p class="adm-help">Al responder queda registrado que asististe a esta clase.</p>
        <div class="err" data-err role="alert"></div>
        <button class="btn" type="submit">Registrar mi asistencia</button>
      </form>
    </section>
  </div>`;
}

const upcoming = () => data.bookings.filter(b => b.status === "confirmed" && b.canChange).sort((a, b) => a.startAt.localeCompare(b.startAt));

const reasonField = label => `<div class="field"><label>${label}</label>
  <textarea name="reason" rows="2" maxlength="300" required placeholder="Cuéntanos brevemente por qué"></textarea></div>`;

function panelFor(b) {
  if (!openPanel || openPanel.id !== b.id) return "";
  if (openPanel.kind === "cancel") {
    return `<form class="ath-sub" data-change="cancel" data-id="${esc(b.id)}" novalidate>${reasonField("Motivo de la cancelación")}
      <div class="err" data-err role="alert"></div><button class="btn small" type="submit">Confirmar cancelación</button></form>`;
  }
  const opts = data.sessions.filter(s => s.classId === b.classId && s.key !== b.sessionKey);
  if (!opts.length) return '<p class="adm-help ath-sub">No hay otras horas disponibles para esta clase en los próximos días.</p>';
  return `<form class="ath-sub" data-change="reschedule" data-id="${esc(b.id)}" novalidate>
    <div class="field"><label>Nueva hora</label><div class="rv-options">${opts.map(s => `<label class="rv-opt${s.full || s.mine ? " is-full" : ""}">
      <input type="radio" name="newSessionKey" value="${esc(s.key)}"${s.full || s.mine ? " disabled" : ""}>
      <span><b>${esc(cap(dayLabel(s.date)))} · ${esc(s.start)}–${esc(s.end)}</b> · ${s.mine ? "Ya inscrito" : s.full ? "Completa" : `${s.capacity - s.taken} cupos`}</span></label>`).join("")}</div></div>
    ${reasonField("Motivo del cambio")}
    <div class="err" data-err role="alert"></div><button class="btn small" type="submit">Confirmar nueva hora</button></form>`;
}

function viewNext() {
  const list = upcoming();
  return `<div class="adm-bar"><h2>Próximas clases</h2></div>
    ${infoTip("Reagendar te cambia a otra hora de la misma clase; cancelar libera tu cupo. En ambos casos el motivo es obligatorio: nos ayuda a organizar los cupos.")}
    ${list.length ? `<div class="adm-rows">${list.map(b => `<div class="ath-block"><div class="adm-row">
      <div class="adm-row-main"><b>${esc(b.classLabel)}</b><span>${esc(cap(dayLabel(b.date)))} · ${esc(b.start)}–${esc(b.end)}</span></div>
      <div class="adm-row-actions">
        <button class="btn small ghost" type="button" data-panel="reschedule" data-id="${esc(b.id)}" aria-pressed="${!!openPanel && openPanel.id === b.id && openPanel.kind === "reschedule"}">Reagendar</button>
        <button class="btn small ghost adm-danger" type="button" data-panel="cancel" data-id="${esc(b.id)}" aria-pressed="${!!openPanel && openPanel.id === b.id && openPanel.kind === "cancel"}">Cancelar</button>
      </div></div>${panelFor(b)}</div>`).join("")}</div>`
      : '<p class="adm-empty">No tienes clases próximas. Reserva una desde <a href="index.html#horario" style="color:var(--gold)">el horario del sitio</a>.</p>'}`;
}

const TONES = ["oro", "bronce", "cobre", "marino", "acero", "plata", "crema", "linea"];   // mismos colores que js/schedule.js
const STATUS = { confirmed: "Tomada", cancelled: "Cancelada" };

// Detalle de un día: las clases que tomó (o canceló) ese día, encima del calendario
function dayDetail(date, list) {
  return `<div class="adm-modal">
    <div class="adm-modal-bg" data-close-day></div>
    <section class="adm-detail" role="dialog" aria-modal="true" aria-label="Clases del ${esc(date)}" tabindex="-1">
      <div class="adm-detail-head">
        <h3 class="adm-detail-title">${esc(cap(dayLabel(date)))}</h3>
        <button class="btn small ghost" type="button" data-close-day>Cerrar</button>
      </div>
      <div class="ath-blocks">${list.map(b => {
        const status = b.status === "confirmed" ? (b.canChange ? "Próxima" : b.attended === true ? "Asistió" : b.attended === false ? "Faltó" : "Sin registro") : STATUS[b.status] || "Cambiada";
        const meta = [b.club, b.discipline, b.type].filter(Boolean).join(" · ");
        const ask = canSurvey(b) ? `<button class="btn small ath-block-btn" type="button" data-survey="${esc(b.id)}">Responder encuesta</button>` : "";
        // Mismo diseño que el bloque de la clase en el horario del sitio (color de la disciplina, diseño del tipo y franja del club)
        return `<div class="sch-class ath-class t-${TONES.includes(b.tone) ? b.tone : "oro"} ty-${Number.isInteger(b.design) && b.design >= 0 && b.design <= 10 ? b.design : 0}${TONES.includes(b.clubTone) ? " s-" + b.clubTone : ""}${b.status === "confirmed" && b.attended !== false ? "" : " is-off"}">
          <span class="sch-name">${esc(b.classLabel)}</span>
          <span class="sch-time">${esc(b.start)}–${esc(b.end)}</span>
          <span class="sch-spots ath-status">${esc(status)}</span>
          ${meta ? `<span class="sch-note">${esc(meta)}</span>` : ""}
          ${b.fatigue ? `<span class="sch-note">Cansancio: <b>${b.fatigue}/10</b>${b.comment ? ` · “${esc(b.comment)}”` : ""}</span>` : ""}
          ${b.cancelReason ? `<span class="sch-note">Motivo: ${esc(b.cancelReason)}</span>` : ""}
          ${ask}
        </div>`;
      }).join("")}</div>
    </section>
  </div>`;
}

function viewCal() {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = {};
  data.bookings.forEach(b => (byDate[b.date] = byDate[b.date] || []).push(b));
  const today = todayStr();
  const cells = [...Array(lead).fill('<span class="ath-cell is-blank"></span>')];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const list = byDate[date] || [];
    const kept = list.filter(b => b.status === "confirmed").length;
    const todo = list.filter(canSurvey).length;   // clases sin encuesta respondida
    const done = list.filter(b => b.status === "confirmed" && b.attended !== null).length;   // clases ya registradas (encuesta respondida o marcadas por el equipo)
    const cls = `ath-cell${kept ? " has" : list.length ? " is-off" : ""}${todo ? " is-todo" : ""}${date === today ? " is-today" : ""}`;
    cells.push(list.length
      ? `<button type="button" class="${cls}" data-day="${date}" aria-label="${esc(dayLabel(date))}: ${list.length} ${list.length === 1 ? "clase" : "clases"}${todo ? `, encuesta respondida en ${done} de ${kept}` : ""}"><span>${d}</span><i>${todo ? `${done}/${kept}` : kept || list.length}</i></button>`
      : `<span class="${cls}"><span>${d}</span></span>`);
  }
  const cal = data.calendar;
  return `<div class="adm-bar ath-hist"><h2>Mi historial</h2></div>
    ${infoTip("Toca un día marcado para ver el detalle de las clases que tomaste, tienes o cancelaste ese día. Los días en rojo tienen clases por registrar: toca el día y responde la encuesta, que se habilita " + SURVEY_LEAD_MIN + " minutos antes de que termine la clase. Suscribe tu calendario una sola vez y tus reservas aparecen, cambian y se quitan solas cuando reagendas o cancelas.")}
    <div class="ath-month"><button class="btn small ghost" type="button" data-month="-1" aria-label="Mes anterior">←</button>
      <b>${esc(monthLabel(month))}</b><button class="btn small ghost" type="button" data-month="1" aria-label="Mes siguiente">→</button></div>
    <div class="ath-grid">${["L", "M", "X", "J", "V", "S", "D"].map(d => `<span class="ath-dow">${d}</span>`).join("")}${cells.join("")}</div>
    ${pendingSurveys().length ? '<p class="ath-legend"><i class="ath-dot"></i> Rojo: tienes clases por registrar. Toca el día y responde la encuesta.</p>' : ""}
    ${calDay && byDate[calDay] ? dayDetail(calDay, byDate[calDay].sort((a, b) => a.startAt.localeCompare(b.startAt))) : ""}
    <div class="adm-bar ath-sync"><h2>Suscribir mi calendario</h2></div>
    <div class="adm-actions ath-sync-btns"><a class="btn" href="${esc(cal.google)}" target="_blank" rel="noopener">Google Calendar</a>
      <a class="btn ghost" href="${esc(cal.webcal)}">Apple / Outlook</a>
      <button class="btn ghost" type="button" data-copy="${esc(cal.ics)}">Copiar enlace</button></div>`;
}

function render() {
  const view = { sum: summary, next: viewNext, me: viewProfile }[tab];
  const n = upcoming().length;
  $("#hello").textContent = "Hola, " + (data.profile.name.split(" ")[0] || "deportista");
  $("#tabs").innerHTML = TABS.map(([k, name]) =>
    `<button type="button" role="tab" aria-pressed="${k === tab}" data-tab="${k}">${name}${k === "next" && n ? ` (${n})` : ""}</button>`).join("");
  document.body.classList.toggle("adm-modal-open", (tab === "sum" && !!calDay) || !!survey);
  $("#body").innerHTML = `${notices()}${view()}${survey ? surveyModal() : ""}
    <div class="ath-foot"><button class="adm-link" type="button" data-newpass>Cambiar mi clave</button></div>`;
}

/* ---------- Eventos ---------- */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !data) return;
  if (survey) { survey = null; render(); } else if (calDay) { calDay = ""; render(); }
});

$("#tabs").addEventListener("click", e => {
  const tb = e.target.closest("[data-tab]");
  if (!tb) return;
  tab = tb.dataset.tab; openPanel = null; calDay = ""; render();
});

$("#body").addEventListener("click", async e => {
  const t = e.target;
  if (t.closest("[data-reload]")) { load(); return; }
  const sv = t.closest("[data-survey]");
  if (sv) { survey = sv.dataset.survey; calDay = ""; render(); return; }
  if (t.closest("[data-close-survey]")) { survey = null; render(); return; }
  const go = t.closest("[data-go]");
  if (go) { tab = go.dataset.go; openPanel = null; calDay = ""; render(); window.scrollTo({ top: 0 }); return; }
  if (t.closest("[data-newpass]")) {
    try { await askReset(data.profile.email); toast("Te enviamos un correo a " + data.profile.email + " para cambiar tu clave"); }
    catch (ex) { toast("Sin conexión. Revisa tu internet."); }
    return;
  }
  const mo = t.closest("[data-month]");
  if (mo) { const [y, m] = month.split("-").map(Number); month = new Date(Date.UTC(y, m - 1 + Number(mo.dataset.month), 1)).toISOString().slice(0, 7); calDay = ""; render(); return; }
  const dy = t.closest("[data-day]");
  if (dy) { calDay = dy.dataset.day; render(); return; }
  if (t.closest("[data-close-day]")) { calDay = ""; render(); return; }
  const cp = t.closest("[data-copy]");
  if (cp) { navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast("Enlace copiado")); return; }
  const pn = t.closest("[data-panel]");
  if (pn) { const same = openPanel && openPanel.id === pn.dataset.id && openPanel.kind === pn.dataset.panel; openPanel = same ? null : { id: pn.dataset.id, kind: pn.dataset.panel }; render(); return; }
});

$("#body").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const err = form.querySelector("[data-err]"), btn = form.querySelector("[type=submit]");
  err.textContent = ""; btn.disabled = true;
  try {
    if (form.matches("[data-profile]")) {
      const v = n => form.elements[n].value;
      await api({ action: "profile", name: v("name"), nickname: v("nickname"), phone: v("phone"), emergencyName: v("emergencyName"), emergencyPhone: v("emergencyPhone") });
      toast("Datos guardados");
    } else if (form.matches("[data-survey-form]")) {
      const pick = form.querySelector("input[name=fatigue]:checked");
      if (!pick) { err.textContent = "Elige un número del 1 al 10."; btn.disabled = false; return; }
      await api({ action: "survey", id: form.dataset.id, fatigue: Number(pick.value), comment: form.elements.comment.value });
      survey = null;
      toast("Asistencia registrada. ¡Gracias!");
    } else if (form.matches("[data-medical]")) {
      const v = n => form.elements[n].value;
      await api({ action: "medical", conditions: v("conditions"), injuries: v("injuries"), allergies: v("allergies"), medications: v("medications"),
        bloodType: v("bloodType"), insurance: v("insurance"), consent: form.elements.consent.checked });
      toast("Ficha médica guardada");
    } else {
      const reason = form.elements.reason.value.trim();
      if (reason.length < 3) { err.textContent = "Cuéntanos el motivo (es obligatorio)."; btn.disabled = false; return; }
      const body = { action: form.dataset.change, id: form.dataset.id, reason };
      if (body.action === "reschedule") {
        const pick = form.querySelector("input[name=newSessionKey]:checked");
        if (!pick) { err.textContent = "Elige la nueva hora."; btn.disabled = false; return; }
        body.newSessionKey = pick.value;
      }
      await api(body);
      openPanel = null;
      toast(body.action === "cancel" ? "Clase cancelada" : "Clase reagendada");
    }
    await load();
  } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
});

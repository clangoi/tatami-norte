/* ==========================================================
   Kizuna · Panel del deportista (deportista.html)
   Entra con el correo y la clave que creó con el enlace del correo
   (Firebase Auth) y habla con /api/deportista. Secciones:
   Agendar · Próximas (reagendar, cancelar) · Calendario · Historial.
   ========================================================== */
import { SDK, app as fbApp } from "./firebase.js";

const {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} = await import(`${SDK}/firebase-auth.js`);

const auth = getAuth(fbApp);
auth.languageCode = "es";

const root = document.getElementById("app");
const SITE = window.SITE_CONFIG || {};
const locale = (SITE.currency && SITE.currency.locale) || "es-CL";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dayLabel = date => new Date(date + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
const monthLabel = ym => new Date(ym + "-01T12:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" });
const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: (SITE.booking && SITE.booking.timeZone) || "America/Santiago" });
const toast = msg => {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3000);
};

const TABS = [["book", "Agendar"], ["next", "Próximas"], ["cal", "Calendario"], ["past", "Historial"]];
let data = null;
let tab = "book";
let month = todayStr().slice(0, 7);
let calDay = "";
let openPanel = null;       // { id, kind: "cancel" | "reschedule" }
let filter = { club: "", discipline: "" };

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

/* ---------- Entrar ---------- */
function renderLogin(msg = "") {
  root.innerHTML = `<form class="rv-form ath-login" data-login novalidate>
    <h3 class="ath-h">Entrar a mi panel</h3>
    <p class="rv-help">Tu cuenta la crea la escuela con el correo con el que te inscribes. Recibes un correo con el enlace para crear tu clave.</p>
    <div class="field"><label for="lEmail">Correo</label><input id="lEmail" name="email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="lPass">Clave</label><input id="lPass" name="pass" type="password" autocomplete="current-password" required></div>
    <div class="err" data-err role="alert">${esc(msg)}</div>
    <button class="btn block" type="submit">Entrar</button>
    <button class="rv-back" type="button" data-forgot>Olvidé mi clave</button>
  </form>`;
}

root.addEventListener("submit", async e => {
  if (!e.target.matches("[data-login]")) return;
  e.preventDefault();
  const f = e.target.elements, err = e.target.querySelector("[data-err]"), btn = e.target.querySelector("[type=submit]");
  err.textContent = ""; btn.disabled = true;
  try { await signInWithEmailAndPassword(auth, f.email.value.trim(), f.pass.value); }
  catch (ex) { err.textContent = authError(ex); btn.disabled = false; }
});

root.addEventListener("click", async e => {
  if (!e.target.closest("[data-forgot]")) return;
  const email = root.querySelector("#lEmail").value.trim();
  const err = root.querySelector("[data-err]");
  if (!email) { err.textContent = "Escribe tu correo arriba y vuelve a presionar."; return; }
  try {
    await sendPasswordResetEmail(auth, email, { url: location.origin + "/deportista" });
    err.textContent = "";
    toast("Si tu cuenta existe, te enviamos un correo para cambiar tu clave");
  } catch (ex) { err.textContent = authError(ex); }
});

/* ---------- Datos ---------- */
async function load() {
  try {
    data = await api();
    render();
  } catch (ex) {
    if (ex.status === 403) {
      root.innerHTML = `<div class="rv-done"><div class="eyebrow">Sin acceso</div><p>${esc(ex.message)}</p>
        <div class="rv-actions"><button class="btn small ghost" type="button" data-logout>Salir</button></div></div>`;
    } else {
      root.innerHTML = `<div class="rv-done"><div class="eyebrow">No se pudo cargar</div><p>${esc(ex.message)}</p>
        <div class="rv-actions"><button class="btn small" type="button" data-reload>Reintentar</button></div></div>`;
    }
  }
}

/* ---------- Dibujo ---------- */
const counters = (title, list) => `<div class="ath-count"><h4>${title}</h4>${list.length
  ? list.map(c => `<div class="ath-stat"><b>${c.count}</b><span>${esc(c.name)}</span></div>`).join("")
  : '<span class="rv-help">Aún sin clases</span>'}</div>`;

function header() {
  const s = data.summary;
  return `<div class="ath-top">
    <div><div class="eyebrow">Hola</div><h3 class="ath-h">${esc(data.profile.name.split(" ")[0] || "Deportista")}</h3>
      <p class="rv-help">${esc(data.profile.email)}</p></div>
    <button class="btn small ghost" type="button" data-logout>Salir</button>
  </div>
  <div class="ath-totals">
    <div class="ath-stat big"><b>${s.taken}</b><span>${s.taken === 1 ? "clase tomada" : "clases tomadas"}</span></div>
    <div class="ath-stat big"><b>${s.upcoming}</b><span>${s.upcoming === 1 ? "próxima" : "próximas"}</span></div>
  </div>
  <div class="ath-counts">${counters("Por club", s.clubs)}${counters("Por disciplina", s.disciplines)}${counters("Por tipo", s.types)}</div>`;
}

function profileForm() {
  return `<form class="rv-subform ath-profile" data-profile novalidate>
    <h4 class="ath-h2">Completa tus datos</h4>
    <p class="rv-help">Los necesitamos para reservar por ti. Los demás verán solo tu nombre y la inicial de tu apellido.</p>
    <div class="field"><label for="pName">Nombre y apellido</label><input id="pName" name="name" maxlength="80" value="${esc(data.profile.name)}" required></div>
    <div class="field"><label for="pPhone">Teléfono</label><input id="pPhone" name="phone" type="tel" inputmode="tel" placeholder="+56 9 1234 5678" value="${esc(data.profile.phone)}" required></div>
    <div class="err" data-err role="alert"></div>
    <button class="btn" type="submit">Guardar</button>
  </form>`;
}

const upcoming = () => data.bookings.filter(b => b.status === "confirmed" && b.canChange).sort((a, b) => a.startAt.localeCompare(b.startAt));
const history = () => data.bookings.filter(b => !(b.status === "confirmed" && b.canChange));

function viewBook() {
  const clubs = [...new Set(data.sessions.map(s => s.club).filter(Boolean))].sort();
  const discs = [...new Set(data.sessions.map(s => s.discipline).filter(Boolean))].sort();
  const list = data.sessions.filter(s => (!filter.club || s.club === filter.club) && (!filter.discipline || s.discipline === filter.discipline));
  const byDate = {};
  list.forEach(s => (byDate[s.date] = byDate[s.date] || []).push(s));
  const sel = (name, label, opts) => `<label>${label}<select data-filter="${name}"><option value="">Todos</option>${opts.map(o => `<option${filter[name] === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  return `<div class="ath-filters">${clubs.length > 1 ? sel("club", "Club", clubs) : ""}${discs.length > 1 ? sel("discipline", "Disciplina", discs) : ""}</div>
    ${Object.keys(byDate).length ? Object.entries(byDate).map(([date, items]) => `<div class="ath-day"><h5>${esc(dayLabel(date))}</h5>
      ${items.map(s => `<div class="ath-item">
        <div><b>${esc(s.classLabel)}</b><span>${esc(s.start)}–${esc(s.end)} · ${s.full ? "Completa" : `${s.capacity - s.taken} cupos`}</span></div>
        ${s.mine ? '<span class="ath-tag">Inscrito</span>'
          : `<button class="btn small" type="button" data-book="${esc(s.key)}"${s.full ? " disabled" : ""}>${s.full ? "Completa" : "Reservar"}</button>`}
      </div>`).join("")}</div>`).join("") : '<p class="rv-help">No hay clases disponibles con esos filtros en los próximos días.</p>'}`;
}

const reasonField = label => `<div class="field"><label>${label}</label>
  <textarea name="reason" rows="2" maxlength="300" required placeholder="Cuéntanos brevemente por qué"></textarea></div>`;

function panelFor(b) {
  if (!openPanel || openPanel.id !== b.id) return "";
  if (openPanel.kind === "cancel") {
    return `<form class="rv-subform" data-change="cancel" data-id="${esc(b.id)}" novalidate>${reasonField("Motivo de la cancelación")}
      <div class="err" data-err role="alert"></div><button class="btn small" type="submit">Confirmar cancelación</button></form>`;
  }
  const opts = data.sessions.filter(s => s.classId === b.classId && s.key !== b.sessionKey);
  if (!opts.length) return '<p class="rv-help">No hay otras horas disponibles para esta clase en los próximos días.</p>';
  return `<form class="rv-subform" data-change="reschedule" data-id="${esc(b.id)}" novalidate>
    <div class="field"><label>Nueva hora</label><div class="rv-options">${opts.map(s => `<label class="rv-opt${s.full || s.mine ? " is-full" : ""}">
      <input type="radio" name="newSessionKey" value="${esc(s.key)}"${s.full || s.mine ? " disabled" : ""}>
      <span><b>${esc(dayLabel(s.date))} · ${esc(s.start)}–${esc(s.end)}</b> · ${s.mine ? "Ya inscrito" : s.full ? "Completa" : `${s.capacity - s.taken} cupos`}</span></label>`).join("")}</div></div>
    ${reasonField("Motivo del cambio")}
    <div class="err" data-err role="alert"></div><button class="btn small" type="submit">Confirmar nueva hora</button></form>`;
}

function viewNext() {
  const list = upcoming();
  if (!list.length) return '<p class="rv-help">No tienes clases próximas. Ve a «Agendar» para reservar una.</p>';
  return list.map(b => `<div class="ath-card">
    <div class="ath-item"><div><b>${esc(b.classLabel)}</b><span>${esc(dayLabel(b.date))} · ${esc(b.start)}–${esc(b.end)}</span></div>
      <div class="ath-actions">
        <button class="btn small ghost" type="button" data-panel="reschedule" data-id="${esc(b.id)}" aria-pressed="${!!openPanel && openPanel.id === b.id && openPanel.kind === "reschedule"}">Reagendar</button>
        <button class="btn small ghost" type="button" data-panel="cancel" data-id="${esc(b.id)}" aria-pressed="${!!openPanel && openPanel.id === b.id && openPanel.kind === "cancel"}">Cancelar</button>
      </div></div>${panelFor(b)}</div>`).join("");
}

function viewCal() {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = {};
  data.bookings.filter(b => b.status === "confirmed").forEach(b => (byDate[b.date] = byDate[b.date] || []).push(b));
  const today = todayStr();
  const cells = [...Array(lead).fill('<span class="ath-cell is-blank"></span>')];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const n = (byDate[date] || []).length;
    cells.push(`<button type="button" class="ath-cell${n ? " has" : ""}${date === today ? " is-today" : ""}${date === calDay ? " is-sel" : ""}" data-day="${date}"><span>${d}</span>${n ? `<i>${n}</i>` : ""}</button>`);
  }
  const sel = calDay ? (byDate[calDay] || []) : [];
  const cal = data.calendar;
  return `<div class="ath-month"><button class="btn small ghost" type="button" data-month="-1" aria-label="Mes anterior">←</button>
      <b>${esc(monthLabel(month))}</b><button class="btn small ghost" type="button" data-month="1" aria-label="Mes siguiente">→</button></div>
    <div class="ath-grid">${["L", "M", "X", "J", "V", "S", "D"].map(d => `<span class="ath-dow">${d}</span>`).join("")}${cells.join("")}</div>
    ${calDay ? `<div class="ath-day"><h5>${esc(dayLabel(calDay))}</h5>${sel.length ? sel.map(b => `<div class="ath-item"><div><b>${esc(b.classLabel)}</b><span>${esc(b.start)}–${esc(b.end)}${b.canChange ? "" : " · Tomada"}</span></div></div>`).join("") : '<p class="rv-help">Sin clases ese día.</p>'}</div>` : ""}
    <div class="ath-sync"><h4 class="ath-h2">Llévalas a tu calendario</h4>
      <p class="rv-help">Suscribe tu calendario una sola vez y tus reservas aparecen, cambian y se quitan solas cuando agendas, reagendas o cancelas.</p>
      <div class="rv-actions"><a class="btn small" href="${esc(cal.google)}" target="_blank" rel="noopener">Google Calendar</a>
        <a class="btn small ghost" href="${esc(cal.webcal)}">Apple / Outlook</a>
        <button class="btn small ghost" type="button" data-copy="${esc(cal.ics)}">Copiar enlace</button></div></div>`;
}

function viewPast() {
  const list = history().sort((a, b) => b.startAt.localeCompare(a.startAt));
  if (!list.length) return '<p class="rv-help">Aquí verás las clases que vayas tomando.</p>';
  const tag = b => b.status === "cancelled" ? "Cancelada" : b.status === "confirmed" ? "Tomada" : "Cambiada";
  return list.map(b => `<div class="ath-item${b.status === "confirmed" ? "" : " is-off"}"><div><b>${esc(b.classLabel)}</b>
    <span>${esc(dayLabel(b.date))} · ${esc(b.start)}${b.cancelReason ? ` · ${esc(b.cancelReason)}` : ""}</span></div><span class="ath-tag">${tag(b)}</span></div>`).join("");
}

function render() {
  const view = { book: viewBook, next: viewNext, cal: viewCal, past: viewPast }[tab];
  const n = upcoming().length;
  document.getElementById("title").textContent = "Mi panel";
  root.innerHTML = `<div class="ath-wrap">${header()}
    ${data.profile.complete ? "" : profileForm()}
    <div class="filters ath-tabs" role="tablist" aria-label="Secciones">${TABS.map(([k, n2]) =>
      `<button type="button" role="tab" aria-pressed="${k === tab}" data-tab="${k}">${n2}${k === "next" && n ? ` (${n})` : ""}</button>`).join("")}</div>
    <div class="ath-body">${view()}</div></div>`;
}

/* ---------- Eventos ---------- */
root.addEventListener("click", async e => {
  const t = e.target;
  if (t.closest("[data-logout]")) { signOut(auth); return; }
  if (t.closest("[data-reload]")) { load(); return; }
  const tb = t.closest("[data-tab]");
  if (tb) { tab = tb.dataset.tab; openPanel = null; render(); return; }
  const mo = t.closest("[data-month]");
  if (mo) { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(mo.dataset.month), 1)); month = d.toISOString().slice(0, 7); calDay = ""; render(); return; }
  const dy = t.closest("[data-day]");
  if (dy) { calDay = calDay === dy.dataset.day ? "" : dy.dataset.day; render(); return; }
  const cp = t.closest("[data-copy]");
  if (cp) { navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast("Enlace copiado")); return; }
  const pn = t.closest("[data-panel]");
  if (pn) { const same = openPanel && openPanel.id === pn.dataset.id && openPanel.kind === pn.dataset.panel; openPanel = same ? null : { id: pn.dataset.id, kind: pn.dataset.panel }; render(); return; }
  const bk = t.closest("[data-book]");
  if (bk) {
    if (!data.profile.complete) { toast("Completa tus datos para poder reservar"); return; }
    bk.disabled = true; bk.textContent = "Reservando…";
    try {
      const res = await api({ action: "book", sessionKey: bk.dataset.book });
      toast("Clase reservada" + (res.emailSent ? ": te enviamos la confirmación" : ""));
    } catch (ex) { toast(ex.message); }
    await load();
  }
});

root.addEventListener("change", e => {
  const f = e.target.closest("[data-filter]");
  if (f) { filter[f.dataset.filter] = f.value; render(); }
});

root.addEventListener("submit", async e => {
  const form = e.target;
  if (form.matches("[data-login]")) return;
  e.preventDefault();
  const err = form.querySelector("[data-err]"), btn = form.querySelector("[type=submit]");
  err.textContent = ""; btn.disabled = true;
  try {
    if (form.matches("[data-profile]")) {
      await api({ action: "profile", name: form.elements.name.value, phone: form.elements.phone.value });
      toast("Datos guardados");
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

onAuthStateChanged(auth, user => {
  data = null;
  if (!user) { renderLogin(); return; }
  root.innerHTML = '<p class="cal-loading">Cargando tu panel…</p>';
  load();
});

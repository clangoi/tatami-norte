/* ==========================================================
   Kizuna · Panel del deportista (deportista.html)
   Misma estructura que el panel de administración (js/admin.js): vistas de carga,
   entrada y panel; pestañas arriba; listas en filas. Entra con el correo y la clave
   que creó con el enlace del correo (Firebase Auth) y habla con /api/deportista.
   Secciones: Resumen (contadores) · Agendar · Próximas (reagendar, cancelar) · Calendario · Historial.
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

const TABS = [["sum", "Resumen"], ["book", "Agendar"], ["next", "Próximas"], ["cal", "Calendario"], ["past", "Historial"]];
let data = null;
let tab = "sum";
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

function summary() {
  const s = data.summary;
  return `<div class="adm-bar"><h2>Mi resumen</h2></div>
    ${infoTip("Las disciplinas y los clubes salen solos de las clases que has tomado: cuentan las reservas confirmadas cuya clase ya pasó. Las clases que cancelas o cambias no suman.")}
    <div class="adm-cfg-grid ath-sum">
      <div class="adm-cfg"><h3>Clases</h3>
        <div class="ath-stat"><b>${s.taken}</b><span>${s.taken === 1 ? "tomada" : "tomadas"}</span></div>
        <div class="ath-stat"><b>${s.upcoming}</b><span>${s.upcoming === 1 ? "próxima" : "próximas"}</span></div></div>
      ${counters("Por club", s.clubs)}${counters("Por disciplina", s.disciplines)}${counters("Por tipo", s.types)}
    </div>`;
}

function profileForm() {
  return `<form class="adm-editor ath-profile" data-profile novalidate>
    <div class="adm-bar"><h2>Completa tus datos</h2><div class="adm-actions"><button class="btn" type="submit">Guardar</button></div></div>
    <p class="adm-help adm-note">Los necesitamos para reservar por ti. Los demás verán solo tu nombre y la inicial de tu apellido.</p>
    <div class="row2">
      <div class="field"><label for="pName">Nombre y apellido</label><input id="pName" name="name" maxlength="80" value="${esc(data.profile.name)}" required></div>
      <div class="field"><label for="pPhone">Teléfono</label><input id="pPhone" name="phone" type="tel" inputmode="tel" placeholder="+56 9 1234 5678" value="${esc(data.profile.phone)}" required></div>
    </div>
    <div class="err" data-err role="alert"></div>
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
  return `<div class="adm-bar"><h2>Agendar una clase</h2></div>
    ${infoTip("Las clases de esta semana y la próxima. Un toque en «Reservar» y listo: usamos tus datos guardados y te enviamos la confirmación con la invitación para tu calendario.")}
    ${clubs.length > 1 || discs.length > 1 ? `<div class="adm-toolbar">${clubs.length > 1 ? sel("club", "Club", clubs) : ""}${discs.length > 1 ? sel("discipline", "Disciplina", discs) : ""}</div>` : ""}
    ${Object.keys(byDate).length ? Object.entries(byDate).map(([date, items]) => `<h3 class="adm-day">${esc(cap(dayLabel(date)))}</h3>
      <div class="adm-rows">${items.map(s => `<div class="adm-row">
        <div class="adm-row-main"><b>${esc(s.classLabel)}</b><span>${esc(s.start)}–${esc(s.end)} · ${s.full ? "Completa" : `${s.capacity - s.taken} ${s.capacity - s.taken === 1 ? "cupo" : "cupos"}`}</span></div>
        ${s.mine ? '<span class="adm-tag on">Inscrito</span>' : s.full ? '<span class="adm-tag">Completa</span>'
          : `<button class="btn small" type="button" data-book="${esc(s.key)}">Reservar</button>`}
      </div>`).join("")}</div>`).join("") : '<p class="adm-empty">No hay clases disponibles con esos filtros en los próximos días.</p>'}`;
}

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
      : '<p class="adm-empty">No tienes clases próximas. Ve a «Agendar» para reservar una.</p>'}`;
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
  return `<div class="adm-bar"><h2>Mi calendario</h2></div>
    ${infoTip("Suscribe tu calendario una sola vez y tus reservas aparecen, cambian y se quitan solas cuando agendas, reagendas o cancelas.")}
    <div class="ath-month"><button class="btn small ghost" type="button" data-month="-1" aria-label="Mes anterior">←</button>
      <b>${esc(monthLabel(month))}</b><button class="btn small ghost" type="button" data-month="1" aria-label="Mes siguiente">→</button></div>
    <div class="ath-grid">${["L", "M", "X", "J", "V", "S", "D"].map(d => `<span class="ath-dow">${d}</span>`).join("")}${cells.join("")}</div>
    ${calDay ? `<h3 class="adm-day">${esc(cap(dayLabel(calDay)))}</h3><div class="adm-rows">${sel.length ? sel.map(b => `<div class="adm-row">
      <div class="adm-row-main"><b>${esc(b.classLabel)}</b><span>${esc(b.start)}–${esc(b.end)}</span></div>
      <span class="adm-tag${b.canChange ? " on" : ""}">${b.canChange ? "Próxima" : "Tomada"}</span></div>`).join("") : '<p class="adm-empty">Sin clases ese día.</p>'}</div>` : ""}
    <div class="adm-bar ath-sync"><h2>Suscribir mi calendario</h2></div>
    <div class="adm-actions ath-sync-btns"><a class="btn" href="${esc(cal.google)}" target="_blank" rel="noopener">Google Calendar</a>
      <a class="btn ghost" href="${esc(cal.webcal)}">Apple / Outlook</a>
      <button class="btn ghost" type="button" data-copy="${esc(cal.ics)}">Copiar enlace</button></div>`;
}

function viewPast() {
  const list = history().sort((a, b) => b.startAt.localeCompare(a.startAt));
  const tag = b => b.status === "cancelled" ? "Cancelada" : b.status === "confirmed" ? "Tomada" : "Cambiada";
  return `<div class="adm-bar"><h2>Historial</h2></div>
    ${list.length ? `<div class="adm-rows">${list.map(b => `<div class="adm-row${b.status === "confirmed" ? "" : " is-fixed"}">
      <div class="adm-row-main"><b>${esc(b.classLabel)}</b><span>${esc(cap(dayLabel(b.date)))} · ${esc(b.start)}${b.cancelReason ? ` · Motivo: ${esc(b.cancelReason)}` : ""}</span></div>
      <span class="adm-tag${b.status === "confirmed" ? " on" : ""}">${tag(b)}</span></div>`).join("")}</div>`
      : '<p class="adm-empty">Aquí verás las clases que vayas tomando.</p>'}`;
}

function render() {
  const view = { sum: summary, book: viewBook, next: viewNext, cal: viewCal, past: viewPast }[tab];
  const n = upcoming().length;
  $("#hello").textContent = "Hola, " + (data.profile.name.split(" ")[0] || "deportista");
  $("#tabs").innerHTML = TABS.map(([k, name]) =>
    `<button type="button" role="tab" aria-pressed="${k === tab}" data-tab="${k}">${name}${k === "next" && n ? ` (${n})` : ""}</button>`).join("");
  $("#body").innerHTML = `${data.profile.complete ? "" : profileForm()}${view()}
    <div class="ath-foot"><button class="adm-link" type="button" data-newpass>Cambiar mi clave</button></div>`;
}

/* ---------- Eventos ---------- */
$("#tabs").addEventListener("click", e => {
  const tb = e.target.closest("[data-tab]");
  if (!tb) return;
  tab = tb.dataset.tab; openPanel = null; render();
});

$("#body").addEventListener("click", async e => {
  const t = e.target;
  if (t.closest("[data-reload]")) { load(); return; }
  if (t.closest("[data-newpass]")) {
    try { await askReset(data.profile.email); toast("Te enviamos un correo a " + data.profile.email + " para cambiar tu clave"); }
    catch (ex) { toast("Sin conexión. Revisa tu internet."); }
    return;
  }
  const mo = t.closest("[data-month]");
  if (mo) { const [y, m] = month.split("-").map(Number); month = new Date(Date.UTC(y, m - 1 + Number(mo.dataset.month), 1)).toISOString().slice(0, 7); calDay = ""; render(); return; }
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

$("#body").addEventListener("change", e => {
  const f = e.target.closest("[data-filter]");
  if (f) { filter[f.dataset.filter] = f.value; render(); }
});

$("#body").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
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

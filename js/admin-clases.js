/* ==========================================================
   Kizuna · Panel → Clases (reservas propias)
   Se carga desde admin.js. Edita en Firestore:
   classes/{id}     tipos de clase (nombre, color, duración y cupo habituales)
   slots/{id}       horario semanal: qué clase, qué día y a qué hora
   closures/{id}    días o clases cerradas (feriados, vacaciones)
   y muestra bookings/{id}: quién está inscrito, quién canceló y quién
   reprogramó, con su motivo. Las reservas las crea el sitio (api/reservar).
   ========================================================== */
import { ICONS, stateIcon, iconBtn } from "./admin-icons.js";

const DAYS = [["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"], ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"], ["domingo", "Domingo"]];
const DAY_BY_DOW = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const TONES = [["oro", "Oro"], ["bronce", "Bronce"], ["cobre", "Cobre"], ["marino", "Marino"], ["acero", "Acero"], ["plata", "Plata"], ["crema", "Crema"], ["linea", "Línea"]];
const WEEKS_BEFORE = 4, WEEKS_AHEAD = 12;   // bloques de semana creados de antemano
const SUBS = [["people", "Inscritos"], ["slots", "Horario semanal"], ["classes", "Clases"], ["closures", "Cierres"]];

export function initClases({ db, fs, esc, toast, saveError }) {
  const root = document.getElementById("classesRoot");
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.booking) || {};
  const TZ = cfg.timeZone || "America/Santiago";
  const DEFAULT_CAP = cfg.defaultCapacity || 15;

  let classes = [], slots = [], closures = [], bookings = [];
  let loaded = false;
  let sub = "people";
  let editing = null;       // { kind: "slot"|"class"|"closure", item|null }
  let classFilter = "";     // Inscritos: id de la clase, "group:judo" / "group:bjj" ("" = todas)
  let weekStart = null;     // lunes de la semana que muestra la vista semanal
  let weeks = [];           // lunes de los bloques de semana (los de WEEKS_*; crecen si se avanza más allá)
  let selectedKey = null;   // clase elegida en la vista semanal

  /* ---------- Fechas ---------- */
  const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
  const addDays = (date, n) => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayKey = date => DAY_BY_DOW[new Date(date + "T12:00:00Z").getUTCDay()];
  const mondayOf = date => addDays(date, -((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7));
  const dayName = key => (DAYS.find(d => d[0] === key) || [, key])[1];
  const longDate = date => new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const shortDate = date => new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
  const hhmm = iso => new Date(iso).toLocaleString("es-CL", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const addMin = (t, m) => { const [h, mi] = t.split(":").map(Number); const x = h * 60 + mi + m; return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

  const classOf = id => classes.find(c => c.id === id);
  const slugify = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  /* ---------- Carga ---------- */
  async function loadBase() {
    const [c, s, x] = await Promise.all(["classes", "slots", "closures"].map(n => fs.getDocs(fs.collection(db, n))));
    classes = c.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    slots = s.docs.map(d => ({ id: d.id, ...d.data() }));
    closures = x.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function loadBookings() {
    // Las reservas de la semana que muestra el horario
    const q = fs.query(fs.collection(db, "bookings"), fs.where("date", ">=", weekStart), fs.where("date", "<=", addDays(weekStart, 6)));
    const snap = await fs.getDocs(q);
    bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function activate() {
    if (!loaded) {
      root.innerHTML = '<p class="adm-loading">Cargando clases…</p>';
      try {
        weekStart = mondayOf(todayStr());
        weeks = Array.from({ length: WEEKS_BEFORE + WEEKS_AHEAD + 1 }, (_, i) => addDays(weekStart, (i - WEEKS_BEFORE) * 7));
        await Promise.all([loadBase(), loadBookings()]);
        loaded = true;
      } catch (e) {
        console.warn(e);
        root.innerHTML = `<p class="err">${esc(saveError(e))}</p>`;
        return;
      }
    }
    render();
  }

  /* ---------- Sesiones (horario semanal + fechas) ---------- */
  // Un horario semanal en una fecha concreta, con sus inscritos ya cargados
  function makeSession(s, date) {
    const key = `${s.id}_${date}`;
    const cls = classOf(s.classId);
    const duration = s.duration || cls.duration || 60;
    const closed = closures.some(c => c.date === date && (!c.slotId || c.slotId === s.id));
    return {
      key, date, slotId: s.id, start: s.start, end: addMin(s.start, duration), label: cls.label, classId: s.classId, tone: cls.tone || "oro",
      capacity: s.capacity || cls.capacity || DEFAULT_CAP, closed, people: bookings.filter(b => b.sessionKey === key)
    };
  }

  function sessionsInRange(from, to) {
    const map = new Map();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      slots.filter(s => s.active !== false && s.day === dayKey(date) && classOf(s.classId)).forEach(s => {
        const x = makeSession(s, date);
        map.set(x.key, { ...x, people: [] });
      });
    }
    // Reservas de clases que ya no están en el horario también se muestran
    bookings.filter(b => b.date >= from && b.date <= to).forEach(b => {
      if (!map.has(b.sessionKey)) {
        map.set(b.sessionKey, { key: b.sessionKey, date: b.date, start: b.start, end: b.end, label: b.classLabel, classId: b.classId, capacity: null, closed: false, orphan: true, people: [] });
      }
      map.get(b.sessionKey).people.push(b);
    });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.label.localeCompare(b.label));
  }

  const waUrl = (b, text) => `https://wa.me/${b.waPhone || String(b.phone).replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  const keyLabel = key => {
    const m = /^(.+)_(\d{4}-\d{2}-\d{2})$/.exec(key || "");
    if (!m) return "otra clase";
    const slot = slots.find(s => s.id === m[1]);
    return `${shortDate(m[2])}${slot ? ` ${slot.start}` : ""}`;
  };

  /* ---------- Inscritos ---------- */
  function personRow(b, session) {
    const by = b.history && b.history.find(h => h.type === "rescheduled-in");
    const hello = `Hola ${String(b.name).split(" ")[0]}, te escribimos de ${(window.SITE_CONFIG || {}).shortName || "la escuela"} por tu clase de ${b.classLabel} del ${longDate(b.date)} a las ${b.start}.`;
    return `<div class="adm-person">
      <div class="adm-person-main">
        <b>${esc(b.name)}</b>${b.nickname ? ` <span class="adm-nick">“${esc(b.nickname)}”</span>` : ""}
        ${by ? `<span class="adm-tag on" title="${esc(by.reason || "")}">Reprogramó desde ${esc(keyLabel(by.from))}</span>` : ""}
        <span>${esc(b.phone)} · ${esc(b.email)}</span>
        ${by && by.reason ? `<span class="adm-reason">Motivo del cambio: ${esc(by.reason)}</span>` : ""}
      </div>
      <div class="adm-row-actions">
        <a class="btn small ghost" href="${esc(waUrl(b, hello))}" target="_blank" rel="noopener">WhatsApp</a>
        ${session.date >= todayStr() ? `<button class="btn small ghost adm-danger" type="button" data-cancel-booking="${esc(b.id)}">Cancelar</button>` : ""}
      </div>
    </div>`;
  }

  function sessionCard(s) {
    const ok = s.people.filter(b => b.status === "confirmed");
    const moved = s.people.filter(b => b.status === "rescheduled");
    const gone = s.people.filter(b => b.status === "cancelled");
    const count = s.capacity ? `${ok.length} / ${s.capacity}` : `${ok.length}`;
    const empty = !s.people.length;
    return `<article class="adm-sess${empty ? " is-empty" : ""}${s.closed ? " is-closed" : ""}">
      <header>
        <div><b>${esc(s.label)}</b><span>${esc(cap1(longDate(s.date)))} · ${esc(s.start)}–${esc(s.end)}</span></div>
        <div class="adm-sess-tags">
          ${s.closed ? '<span class="adm-tag">Cerrada</span>' : ""}
          ${s.orphan ? '<span class="adm-tag" title="Ya no está en el horario semanal">Fuera de horario</span>' : ""}
          <span class="adm-tag${ok.length ? " on" : ""}">${count} inscritos</span>
        </div>
      </header>
      ${s.closed && ok.length ? `<p class="err">Esta clase está cerrada y tiene ${ok.length} inscrito${ok.length > 1 ? "s" : ""}: avísales por WhatsApp.</p>` : ""}
      ${ok.length ? `<div class="adm-group"><h5>Inscritos</h5>${ok.map(b => personRow(b, s)).join("")}</div>` : ""}
      ${moved.length ? `<div class="adm-group"><h5>Reprogramaron (${moved.length})</h5>${moved.map(b => `<div class="adm-person">
        <div class="adm-person-main"><b>${esc(b.name)}</b><span>Pasó a ${esc(keyLabel(b.movedToKey))} · ${esc(hhmm(b.rescheduledAt))}</span>
        <span class="adm-reason">Motivo: ${esc(b.rescheduleReason)}</span></div></div>`).join("")}</div>` : ""}
      ${gone.length ? `<div class="adm-group"><h5>Cancelaron (${gone.length})</h5>${gone.map(b => `<div class="adm-person">
        <div class="adm-person-main"><b>${esc(b.name)}</b><span>${esc(hhmm(b.cancelledAt))}${b.cancelledBy === "admin" ? " · cancelada desde el panel" : ""}</span>
        <span class="adm-reason">Motivo: ${esc(b.cancelReason)}</span></div></div>`).join("")}</div>` : ""}
    </article>`;
  }

  const classSelect = () => {
    const groups = [["judo", "Todo Judo (todas sus clases)"], ["bjj", "Todo BJJ (todas sus clases)"]]
      .filter(([g]) => classes.some(c => groupOf(c) === g));
    return `<label>Tipo de clase
          <select id="rgClass"><option value="">Todas</option>
            ${groups.length ? `<optgroup label="Vista global">${groups.map(([g, n]) => `<option value="group:${g}"${classFilter === "group:" + g ? " selected" : ""}>${n}</option>`).join("")}</optgroup>` : ""}
            <optgroup label="Una clase">${classes.map(c => `<option value="${esc(c.id)}"${c.id === classFilter ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</optgroup>
          </select>
        </label>`;
  };

  const emptyNotice = '<div class="notice adm-seed"><p><strong>Todavía no hay horario.</strong> Crea las clases en la pestaña <b>Clases</b> y sus horarios en <b>Horario semanal</b>; después aparecerán aquí con sus inscritos.</p></div>';
  const feedNote = '<p class="adm-help adm-note">Para ver las clases y sus inscritos en tu calendario (Google, Apple, Outlook), suscríbete a <code>/api/calendario?feed=TU_SECRETO</code>. Ver RESERVAS.md.</p>';

  // La clase elegida en la grilla: si su fecha ya pasó, se muestra su próxima fecha
  function nextOccurrence(key) {
    const m = /^(.+)_(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (!m) return null;
    let date = m[2];
    while (date < todayStr()) date = addDays(date, 7);
    return `${m[1]}_${date}`;
  }

  async function selectClass(key) {
    const target = nextOccurrence(key);
    if (!target) return;
    selectedKey = target;
    const mine = bookings.filter(b => b.sessionKey !== target);
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, "bookings"), fs.where("sessionKey", "==", target)));
      bookings = [...mine, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))];
    } catch (e) { alert(saveError(e)); }
    render();
    const dlg = root.querySelector(".adm-detail");
    if (dlg) dlg.focus({ preventScroll: true });
  }

  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const weekRange = monday => {
    const [, m1, d1] = monday.split("-").map(Number);
    const [, m2, d2] = addDays(monday, 6).split("-").map(Number);
    return m1 === m2 ? `${d1} – ${d2} ${MONTHS[m1 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
  };
  const dayMonth = date => shortDate(date).replace(/^[^,]*,?\s*/, "");

  // Vista global por disciplina: todas las clases de Judo o de BJJ, sea cual sea su tipo
  const groupOf = c => {
    const t = `${c.id} ${c.label}`.toLowerCase();
    return /judo/.test(t) ? "judo" : /bjj|jiu/.test(t) ? "bjj" : "";
  };
  const matchesFilter = s => {
    if (!classFilter) return true;
    if (classFilter.startsWith("group:")) return groupOf(classOf(s.classId) || {}) === classFilter.slice(6);
    return s.classId === classFilter;
  };
  const filterLabel = () => {
    if (!classFilter) return "";
    if (classFilter === "group:judo") return "Todo Judo";
    if (classFilter === "group:bjj") return "Todo BJJ";
    return (classOf(classFilter) || {}).label || "";
  };

  // Horario de la semana, con el mismo formato que el de la portada
  function renderWeek() {
    const from = weekStart, to = addDays(weekStart, 6);
    const list = sessionsInRange(from, to).filter(s => !s.orphan && matchesFilter(s));
    const days = DAYS.filter(([k]) => k !== "domingo" || list.some(s => dayKey(s.date) === "domingo"));
    const dateOf = key => addDays(weekStart, DAYS.findIndex(d => d[0] === key));
    const times = [...new Set(list.map(s => s.start))].sort();
    const today = todayStr();
    const ok = s => s.people.filter(b => b.status === "confirmed").length;
    const total = list.reduce((n, s) => n + ok(s), 0);

    // La clase tocada puede ser de otra fecha (su próxima ocurrencia): se marca la celda de su horario
    const pickedSlot = selectedKey && selectedKey.replace(/_\d{4}-\d{2}-\d{2}$/, "");
    const cell = s => `<a class="sch-class t-${esc(s.tone)}${s.date < today ? " is-past" : ""}${pickedSlot === s.slotId ? " is-selected" : ""}" href="#" data-pick="${esc(s.key)}">
        <span class="sch-name">${esc(s.label)}</span>
        <span class="sch-time">${esc(s.start)}–${esc(s.end)}</span>
        <span class="sch-note">${s.closed ? "Cerrada" : `${ok(s)} / ${s.capacity} inscritos`}</span>
      </a>`;
    const grid = `<div class="sch-grid" style="--days:${days.length}" role="table" aria-label="Horario de la semana">
        <div class="sch-row sch-head" role="row">
          <div class="sch-corner" role="columnheader"></div>
          ${days.map(([k, name]) => `<div class="sch-day${dateOf(k) === today ? " is-today" : ""}" role="columnheader">${name}${dateOf(k) === today ? "<small>Hoy</small>" : ""}<span class="sch-date">${esc(dayMonth(dateOf(k)))}</span></div>`).join("")}
        </div>
        ${times.map(t => `<div class="sch-row" role="row"><div class="sch-hour" role="rowheader">${esc(t)}</div>
          ${days.map(([k]) => `<div class="sch-cell${dateOf(k) === today ? " is-today" : ""}" role="cell">${list.filter(s => s.start === t && s.date === dateOf(k)).map(cell).join("")}</div>`).join("")}</div>`).join("")}
      </div>`;
    const mobile = `<div class="sch-list">${days.map(([k, name]) => {
        const here = list.filter(s => s.date === dateOf(k));
        return `<div class="sch-list-day${dateOf(k) === today ? " is-today" : ""}"><h3>${name}<span class="sch-date">${esc(dayMonth(dateOf(k)))}</span></h3>
          ${here.length ? here.map(cell).join("") : '<p class="sch-rest">Sin clases</p>'}</div>`;
      }).join("")}</div>`;

    // Sección con los detalles de la clase elegida, sobre el horario
    let detail = "";
    if (selectedKey) {
      const m = /^(.+)_(\d{4}-\d{2}-\d{2})$/.exec(selectedKey);
      const slot = slots.find(s => s.id === m[1]);
      if (slot && classOf(slot.classId)) {
        const s = makeSession(slot, m[2]);
        detail = `<div class="adm-modal">
          <div class="adm-modal-bg" data-close-detail></div>
          <section class="adm-detail" role="dialog" aria-modal="true" aria-label="Inscritos de ${esc(s.label)}" tabindex="-1">
            <div class="adm-detail-head">
              <h3 class="adm-detail-title">${esc(s.label)} · ${esc(cap1(longDate(s.date)))}</h3>
              <button class="btn small ghost" type="button" data-close-detail>Cerrar</button>
            </div>
            ${sessionCard(s)}
          </section>
        </div>`;
      }
    }

    return `<div class="adm-toolbar">
        <div class="adm-daynav adm-weeks" role="group" aria-label="Semana">
          <button class="btn small ghost" type="button" data-week="prev" aria-label="Semana anterior">‹</button>
          <div class="adm-weeks-scroll" data-weeks-scroll>${[...weeks].sort().map(w => `<button class="btn small ghost" type="button" data-week-go="${w}" aria-pressed="${w === weekStart}">${esc(weekRange(w))}${w === mondayOf(today) ? "<small>Actual</small>" : ""}</button>`).join("")}</div>
          <button class="btn small ghost" type="button" data-week="after" aria-label="Semana siguiente">›</button>
        </div>
        ${classSelect()}
      </div>
      <p class="sch-range adm-weeklabel">Del ${esc(dayMonth(from))} al ${esc(dayMonth(to))} · ${list.length} clase${list.length === 1 ? "" : "s"} · ${total} inscrito${total === 1 ? "" : "s"}${filterLabel() ? ` · ${esc(filterLabel())}` : ""}</p>
      <p class="adm-help adm-note">Toca una clase para ver quiénes están inscritos, quiénes cancelaron y quiénes reprogramaron. Si su fecha ya pasó, verás su próxima fecha.</p>
      ${list.length ? grid + mobile : '<p class="adm-empty">No hay clases esa semana.</p>'}
      ${detail}`;
  }

  function renderPeople() {
    if (!(classes.length && slots.length)) return emptyNotice;
    return `${renderWeek()}${feedNote}`;
  }

  /* ---------- Horario semanal (bloques, como el de la portada) ----------
     Cada celda es un día y una hora. Al tocarla se agrega una clase (creada antes en
     "Clases", que define cuánto dura); al tocar una clase del horario se edita. */
  const LIMITS_KEY = "tn_sched_limits";
  const VISIBLE_FROM = 15;                  // al abrir se ven las 15:00 a las 22:00
  const hourLabel = h => `${String(h).padStart(2, "0")}:00`;
  let limits = { start: 6, end: 24 };       // horas límite de la grilla (se cambian tocándolas)
  try {
    const l = JSON.parse(localStorage.getItem(LIMITS_KEY) || "null");
    if (l && Number.isInteger(l.start) && Number.isInteger(l.end) && l.start >= 0 && l.end <= 24 && l.start < l.end) limits = l;
  } catch (e) { /* sin almacenamiento: se usan 6 y 24 */ }
  let slotEditor = null;                    // { slot|null, day, hour } mientras la ventana está abierta

  // Los límites se amplían solos si ya hay clases fuera de ellos
  const liveSlots = () => slots.filter(s => classOf(s.classId));

  function schedRange() {
    let start = limits.start, end = limits.end;
    liveSlots().forEach(s => {
      const h = parseInt(s.start, 10);
      if (Number.isInteger(h)) { start = Math.min(start, h); end = Math.max(end, h + 1); }
    });
    return { start, end };
  }

  function renderSlots() {
    // Herramienta de un solo uso: solo aparece mientras no haya ningún horario (ver importFromCal)
    const importBox = !slots.length && cfg.calUsername && (cfg.classes || []).length
      ? `<div class="notice adm-seed"><p><strong>¿Vienes de Cal.com?</strong> Puedo leer los horarios que tienes allá (próximas 3 semanas) y crearlos aquí, junto con las clases que falten. Antes de guardar te muestro lo que encontré. Cal.com no entrega los cupos: quedan los habituales de cada clase.</p>
        <button class="btn small" type="button" id="importCal">Importar horario desde Cal.com</button></div>` : "";
    if (!classes.length && !importBox) return '<div class="notice adm-seed"><p>Primero crea las clases en la pestaña <b>Clases</b>: ahí defines cuánto dura cada una. Después las ubicas aquí en el horario.</p></div>';
    if (!classes.length) return importBox + '<p class="adm-help adm-note">También puedes crear las clases a mano en la pestaña <b>Clases</b>.</p>';

    const { start, end } = schedRange();
    const hours = Array.from({ length: end - start }, (_, i) => start + i);
    const hourOptions = (from, to, sel) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map(h => `<option value="${h}"${h === sel ? " selected" : ""}>${hourLabel(h)}</option>`).join("");

    const chip = s => {
      const c = classOf(s.classId);
      const dur = s.duration || (c && c.duration) || 60;
      return `<button type="button" class="sch-class t-${esc((c && c.tone) || "oro")}${s.active === false ? " is-off" : ""}" data-sched-edit="${esc(s.id)}">
        <span class="sch-name">${esc(c ? c.label : s.classId)}</span>
        <span class="sch-time">${esc(s.start)}–${esc(addMin(s.start, dur))}</span>
        ${s.active === false ? `<span class="adm-chip-off" role="img" aria-label="Oculta" title="Oculta (no se puede reservar)">${ICONS.eyeOff}</span>` : ""}
      </button>`;
    };
    const grid = `<div class="adm-sched-scroll" data-sched-scroll>
      <div class="sch-grid adm-sched-grid" style="--days:7" role="table" aria-label="Horario semanal">
        <div class="sch-row sch-head" role="row"><div class="sch-corner" role="columnheader"></div>${DAYS.map(([, n]) => `<div class="sch-day" role="columnheader">${n}</div>`).join("")}</div>
        ${hours.map((h, i) => `<div class="sch-row" role="row">
          <div class="sch-hour" role="rowheader">${i === 0
            ? `<select class="adm-limit" id="limStart" aria-label="Hora inicial del horario">${hourOptions(0, end - 1, start)}</select>`
            : hourLabel(h)}</div>
          ${DAYS.map(([k, n]) => `<div class="sch-cell adm-sched-cell" role="button" tabindex="0" data-sched-add data-day="${k}" data-hour="${h}" aria-label="Agregar una clase el ${n} desde las ${hourLabel(h)}">
            ${liveSlots().filter(s => s.day === k && parseInt(s.start, 10) === h).sort((a, b) => a.start.localeCompare(b.start)).map(chip).join("")}
          </div>`).join("")}
        </div>`).join("")}
        <div class="sch-row adm-sched-foot" role="row"><div class="sch-hour" role="rowheader"><select class="adm-limit" id="limEnd" aria-label="Hora final del horario">${hourOptions(start + 1, 24, end)}</select></div>
          ${DAYS.map(() => '<div class="sch-cell adm-sched-end"></div>').join("")}</div>
      </div>
    </div>`;

    return `<div class="adm-bar"><h2>Horario semanal</h2></div>
      <p class="adm-help adm-note">Toca un bloque del horario para agregar una clase en ese día y hora, o toca una clase para ajustarla. Cada clase dura lo que defines en <b>Clases</b>. Los extremos (${hourLabel(start)} y ${hourLabel(end)}) se pueden cambiar tocándolos. Para un feriado o una semana sin clase usa <b>Cierres</b>; los cambios valen para las fechas futuras y las reservas ya hechas no se mueven.</p>
      ${importBox}
      ${grid}
      ${slotEditorModal()}`;
  }

  // Ventana para agregar o ajustar una clase del horario
  function slotEditorModal() {
    if (!slotEditor) return "";
    const { slot, day, hour } = slotEditor;
    const x = slot || {};
    const options = classes.filter(c => c.active !== false || c.id === x.classId);
    const cur = classOf(x.classId) || options[0];
    return `<div class="adm-modal">
      <div class="adm-modal-bg" data-close-editor></div>
      <form class="adm-detail adm-slotform" data-form="sched" role="dialog" aria-modal="true" aria-label="${slot ? "Editar clase del horario" : "Agregar clase al horario"}" novalidate>
        <div class="adm-detail-head">
          <h3 class="adm-detail-title">${slot ? "Ajustar clase" : "Agregar al horario"}</h3>
          <button class="btn small ghost" type="button" data-close-editor>Cerrar</button>
        </div>
        <div class="field"><label for="seClass">Clase</label>
          <select id="seClass" name="classId">${options.map(c => `<option value="${esc(c.id)}" data-min="${esc(c.duration || 60)}"${c.id === cur.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
        <div class="field"><label for="seStart">Hora de inicio</label>
          <input id="seStart" name="start" type="time" value="${esc(slot ? slot.start : hourLabel(hour))}" required>
          <small class="adm-help" data-hint></small></div>
        <div class="field"><label id="seDaysLabel">Días en que se repite</label>
          <div class="adm-days" role="group" aria-labelledby="seDaysLabel">${DAYS.map(([k, n]) => {
            const mine = k === (slot ? slot.day : day);
            return `<label class="check"><input type="checkbox" name="days" value="${k}"${mine ? " checked" : ""}${slot && mine ? " disabled" : ""}> ${n}</label>`;
          }).join("")}</div>
          <small class="adm-help">${slot ? "Marca otros días para copiar esta clase a la misma hora." : "Marca más días si esta clase se repite a la misma hora."}</small></div>
        ${slot && slot.duration ? `<label class="check"><input type="checkbox" name="useClassDur"> Usar la duración de la clase (${esc((classOf(slot.classId) || {}).duration || 60)} min) en vez de ${esc(slot.duration)} min</label>` : ""}
        <label class="check"><input type="checkbox" name="active"${x.active === false ? "" : " checked"}> Activa (si no, no se puede reservar)</label>
        <div class="err" data-err role="alert"></div>
        <div class="adm-actions">
          <button class="btn" type="submit">Guardar</button>
          ${slot ? iconBtn("trash", "Borrar de este día", `data-sched-del="${esc(slot.id)}"`) : ""}
        </div>
      </form>
    </div>`;
  }

  // "Termina a las 19:30" según la clase y la hora elegidas
  function editorHint(form) {
    const opt = form.elements.classId.selectedOptions[0];
    const t = form.elements.start.value;
    const hint = form.querySelector("[data-hint]");
    if (!opt || !hint) return;
    const min = Number(opt.dataset.min) || 60;
    hint.textContent = /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? `Dura ${min} min (se define en Clases) · termina a las ${addMin(t, min)}` : `Dura ${min} min (se define en Clases)`;
  }

  function openSchedEditor(next) {
    if (!classes.some(c => c.active !== false)) { alert("Primero crea una clase en la pestaña Clases."); return; }
    slotEditor = next;
    render();
    const form = root.querySelector(".adm-slotform");
    if (form) { editorHint(form); form.querySelector("#seStart").focus({ preventScroll: true }); }
  }

  async function saveSched(form) {
    const f = form.elements;
    const err = form.querySelector("[data-err]");
    const fail = m => { err.textContent = m; };
    err.textContent = "";
    const classId = f.classId.value, start = f.start.value;
    if (!classOf(classId)) return fail("Elige la clase.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return fail("Escribe la hora de inicio.");
    const item = slotEditor.slot;
    const days = [...form.querySelectorAll('input[name="days"]:checked')].map(i => i.value);
    if (item && !days.includes(item.day)) days.push(item.day);
    if (!days.length) return fail("Elige al menos un día.");
    const active = f.active.checked;
    const batch = fs.writeBatch(db);
    let updated = null;
    const created = [];
    if (item) {
      const { id, ...data } = item;
      Object.assign(data, { classId, start, active });
      if (f.useClassDur && f.useClassDur.checked) delete data.duration;
      batch.set(fs.doc(db, "slots", id), data);
      updated = { id, ...data };
    }
    days.filter(d => !item || d !== item.day).forEach(day => {
      if (slots.some(s => s.classId === classId && s.day === day && s.start === start)) return;   // ya existe
      const ref = fs.doc(fs.collection(db, "slots"));
      const data = { classId, day, start, active };
      batch.set(ref, data);
      created.push({ id: ref.id, ...data });
    });
    try {
      await batch.commit();
      slots = slots.map(s => (updated && s.id === updated.id ? updated : s)).concat(created);
      slotEditor = null;
      toast(item ? "Horario actualizado" : `${created.length} horario${created.length === 1 ? "" : "s"} agregado${created.length === 1 ? "" : "s"}`);
      render();
    } catch (e) { console.warn(e); fail(saveError(e)); }
  }

  async function deleteSched(id) {
    const s = slots.find(x => x.id === id);
    if (!s || !confirm("¿Borrar esta clase de este día del horario? Las reservas ya hechas se conservan.")) return;
    slotEditor = null;   // la ventana se cierra sola al confirmar
    render();
    try {
      await fs.deleteDoc(fs.doc(db, "slots", id));
      slots = slots.filter(x => x.id !== id);
      toast("Borrado");
    } catch (e) {
      console.warn(e);
      alert(saveError(e));
    }
    render();
  }

  // Borrar una clase borra también sus horarios; si no, quedarían sueltos en el horario semanal
  async function deleteClass(id) {
    const c = classOf(id);
    if (!c) return;
    const mine = slots.filter(s => s.classId === id);
    const msg = mine.length
      ? `¿Borrar “${c.label}”? También se borrar${mine.length > 1 ? "án sus " + mine.length + " horarios" : "á su horario"} del horario semanal. Las reservas ya hechas se conservan.`
      : `¿Borrar “${c.label}”?`;
    if (!confirm(msg)) return;
    try {
      const batch = fs.writeBatch(db);
      mine.forEach(x => batch.delete(fs.doc(db, "slots", x.id)));
      batch.delete(fs.doc(db, "classes", id));
      await batch.commit();
      slots = slots.filter(x => x.classId !== id);
      classes = classes.filter(x => x.id !== id);
      if (classFilter === id) classFilter = "";
      toast("Clase borrada");
      render();
    } catch (e) { console.warn(e); alert(saveError(e)); }
  }

  /* ---------- Clases ---------- */
  function renderClasses() {
    if (editing && editing.kind === "class") return classForm(editing.item);
    const seed = !classes.length && (cfg.classes || []).length
      ? `<div class="notice adm-seed"><p><strong>Aún no hay clases en el panel.</strong> Puedes cargar las ${cfg.classes.length} que ya tenías en el sitio (con sus colores y páginas) para ajustarlas.</p><button class="btn small" type="button" id="seedClasses">Cargar las clases de siempre</button></div>` : "";
    return `<div class="adm-bar"><h2>Clases</h2><button class="btn" type="button" data-new="class">Nueva clase</button></div>
      <p class="adm-help adm-note">Una clase es una disciplina o formato (Judo, BJJ Gi, Judo Kids…). Su duración y cupo sirven por defecto para todos sus horarios.</p>
      ${seed}
      ${classes.map(c => `<div class="adm-row">
        <div class="adm-row-main"><b>${esc(c.label)}</b><span>${esc(c.duration || 60)} min · ${esc(c.capacity || DEFAULT_CAP)} cupos · ${slots.filter(s => s.classId === c.id).length} horarios</span></div>
        ${stateIcon(c.active !== false, "Activa (se puede reservar)", "Oculta (no aparece en las reservas)")}
        <div class="adm-row-actions">
          ${iconBtn("pencil", "Editar", `data-edit-class="${esc(c.id)}"`)}
          ${iconBtn("trash", "Borrar", `data-del-class="${esc(c.id)}"`)}
        </div></div>`).join("")}`;
  }

  function classForm(c) {
    const x = c || {};
    return `<form class="adm-editor adm-form" data-form="class" novalidate>
      <div class="adm-bar"><h2>${c ? "Editar clase" : "Nueva clase"}</h2>
        <div class="adm-actions"><button class="btn ghost" type="button" data-back>Cancelar</button><button class="btn" type="submit">Guardar</button></div></div>
      <div class="adm-formgrid">
        <div class="field"><label for="cLabel">Nombre</label><input id="cLabel" name="label" maxlength="60" value="${esc(x.label || "")}" required></div>
        <div class="field"><label for="cId">Código</label><input id="cId" name="id" maxlength="40" pattern="[a-z0-9\\-]+" value="${esc(x.id || "")}"${c ? " readonly" : ""} required>
          <small class="adm-help">Solo minúsculas, números y guiones. No se puede cambiar después. Las páginas de Judo y BJJ lo usan para mostrar sus clases.</small></div>
        <div class="field"><label for="cDur">Duración de la clase (minutos)</label><input id="cDur" name="duration" type="number" min="10" max="300" value="${esc(x.duration || 60)}">
          <small class="adm-help">Es lo que dura en el horario semanal: al ubicarla ahí solo eliges la hora de inicio.</small></div>
        <div class="field"><label for="cCap">Cupos habituales</label><input id="cCap" name="capacity" type="number" min="1" max="200" value="${esc(x.capacity || DEFAULT_CAP)}"></div>
        <div class="field"><label for="cTone">Color en el horario</label><select id="cTone" name="tone">${TONES.map(([k, n]) => `<option value="${k}"${k === (x.tone || "oro") ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="field"><label for="cPage">Página de la disciplina</label><input id="cPage" name="page" maxlength="60" value="${esc(x.page || "")}" placeholder="judo.html (opcional)"></div>
        <div class="field"><label for="cOrder">Orden</label><input id="cOrder" name="order" type="number" value="${esc(x.order ?? classes.length + 1)}"></div>
      </div>
      <label class="check"><input type="checkbox" name="active"${x.active === false ? "" : " checked"}> Activa (si no, desaparece de las reservas)</label>
      <div class="err" data-err role="alert"></div>
    </form>`;
  }

  /* ---------- Cierres ---------- */
  function renderClosures() {
    if (editing && editing.kind === "closure") return closureForm();
    const today = todayStr();
    const list = closures.filter(c => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    return `<div class="adm-bar"><h2>Cierres y feriados</h2><button class="btn" type="button" data-new="closure">Nuevo cierre</button></div>
      <p class="adm-help adm-note">Un día o una clase cerrada no se puede reservar. Si ya había inscritos, aparecerán en <b>Inscritos</b> marcados para que les avises.</p>
      ${list.length ? list.map(c => {
        const slot = c.slotId && slots.find(s => s.id === c.slotId);
        const cls = slot && classOf(slot.classId);
        return `<div class="adm-row"><div class="adm-row-main"><b>${esc(cap1(longDate(c.date)))}</b>
          <span>${c.slotId ? esc(`${cls ? cls.label : "Clase"} ${slot ? slot.start : ""}`) : "Todo el día"}${c.reason ? ` · ${esc(c.reason)}` : ""}</span></div>
          <span></span><div class="adm-row-actions">${iconBtn("trash", "Borrar cierre", `data-del-closure="${esc(c.id)}"`)}</div></div>`;
      }).join("") : '<p class="adm-empty">No hay cierres próximos.</p>'}`;
  }

  function closureForm() {
    return `<form class="adm-editor adm-form" data-form="closure" novalidate>
      <div class="adm-bar"><h2>Nuevo cierre</h2>
        <div class="adm-actions"><button class="btn ghost" type="button" data-back>Cancelar</button><button class="btn" type="submit">Guardar</button></div></div>
      <div class="adm-formgrid">
        <div class="field"><label for="xDate">Fecha</label><input id="xDate" name="date" type="date" min="${esc(todayStr())}" required></div>
        <div class="field"><label for="xWhat">Qué se cierra</label><select id="xWhat" name="slotId"><option value="">Todo el día</option>
          ${slots.slice().sort((a, b) => DAYS.findIndex(d => d[0] === a.day) - DAYS.findIndex(d => d[0] === b.day) || a.start.localeCompare(b.start)).map(s => {
            const c = classOf(s.classId);
            return `<option value="${esc(s.id)}">${esc(dayName(s.day))} ${esc(s.start)} · ${esc(c ? c.label : s.classId)} (solo si cae ese día)</option>`;
          }).join("")}</select></div>
        <div class="field"><label for="xReason">Motivo (opcional)</label><input id="xReason" name="reason" maxlength="80" placeholder="Feriado, vacaciones…"></div>
      </div>
      <div class="err" data-err role="alert"></div>
    </form>`;
  }

  /* ---------- Dibujo ---------- */
  function render() {
    const before = root.querySelector("[data-weeks-scroll]");
    const lastScroll = before ? before.scrollLeft : null;
    const sched = root.querySelector("[data-sched-scroll]");
    // Se recuerda qué hora estaba arriba del horario para dejarla ahí aunque cambien las filas
    let anchor = null;
    if (sched) {
      const headH = (sched.querySelector(".sch-corner") || {}).offsetHeight || 0;
      const top = sched.scrollTop + headH;
      const c = [...sched.querySelectorAll('[data-sched-add][data-day="lunes"]')].find(x => x.offsetTop + x.offsetHeight > top + 1);
      if (c) anchor = { hour: c.dataset.hour, delta: top - c.offsetTop };
    }
    root.innerHTML = `<div class="filters adm-subnav" role="tablist" aria-label="Clases">
        ${SUBS.map(([k, n]) => `<button type="button" role="tab" aria-pressed="${k === sub}" data-csub="${k}">${n}</button>`).join("")}
      </div>
      <div>${{ people: renderPeople, slots: renderSlots, classes: renderClasses, closures: renderClosures }[sub]()}</div>`;
    document.body.classList.toggle("adm-modal-open", !!root.querySelector(".adm-modal"));
    const grid = root.querySelector("[data-sched-scroll]");
    if (grid) {
      const headH = (grid.querySelector(".sch-corner") || {}).offsetHeight || 0;
      const at = h => grid.querySelector(`[data-sched-add][data-day="lunes"][data-hour="${h}"]`);
      const kept = anchor && at(anchor.hour);
      if (kept) grid.scrollTop = kept.offsetTop - headH + anchor.delta;
      else {
        // La primera vez se ve de 15:00 a 22:00; con scroll se llega a las horas anteriores y posteriores
        const first = at(Math.max(VISIBLE_FROM, schedRange().start));
        grid.scrollTop = first ? first.offsetTop - headH : 0;
      }
    }
    const strip = root.querySelector("[data-weeks-scroll]");
    const on = strip && strip.querySelector('[aria-pressed="true"]');
    if (on) {
      const target = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
      if (lastScroll == null) { strip.style.scrollBehavior = "auto"; strip.scrollLeft = target; strip.style.scrollBehavior = ""; }
      else {
        strip.style.scrollBehavior = "auto"; strip.scrollLeft = lastScroll; strip.style.scrollBehavior = "";
        requestAnimationFrame(() => { strip.scrollLeft = target; });
      }
    }
  }

  /* ---------- Acciones ---------- */
  const num = v => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };

  async function saveForm(form) {
    const kind = form.dataset.form;
    const f = form.elements;
    const err = form.querySelector("[data-err]");
    const fail = m => { err.textContent = m; };
    err.textContent = "";
    try {
      if (kind === "class") {
        const label = f.label.value.trim();
        const id = editing.item ? editing.item.id : (f.id.value.trim() || slugify(label));
        if (!label) return fail("Escribe el nombre de la clase.");
        if (!/^[a-z0-9-]{1,40}$/.test(id)) return fail("El código solo puede tener minúsculas, números y guiones.");
        if (!editing.item && classOf(id)) return fail("Ya existe una clase con ese código.");
        const data = { label, tone: f.tone.value, page: f.page.value.trim(), order: Number(f.order.value) || 0, active: f.active.checked };
        if (num(f.duration.value)) data.duration = num(f.duration.value);
        if (num(f.capacity.value)) data.capacity = num(f.capacity.value);
        await fs.setDoc(fs.doc(db, "classes", id), data);
        const saved = { id, ...data };
        classes = (classOf(id) ? classes.map(c => (c.id === id ? saved : c)) : [...classes, saved]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      } else {
        const date = f.date.value, slotId = f.slotId.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Elige la fecha.");
        if (slotId) {
          const s = slots.find(x => x.id === slotId);
          if (s && s.day !== dayKey(date)) return fail(`Ese horario es de los ${dayName(s.day).toLowerCase()}, y el ${longDate(date)} no cae ese día.`);
        }
        const id = slotId ? `${slotId}_${date}` : `all_${date}`;
        const data = { date, reason: f.reason.value.trim() };
        if (slotId) data.slotId = slotId;
        await fs.setDoc(fs.doc(db, "closures", id), data);
        closures = [...closures.filter(c => c.id !== id), { id, ...data }];
        // ¿Había gente inscrita?
        const snap = await fs.getDocs(fs.query(fs.collection(db, "bookings"), fs.where("date", "==", date)));
        const hit = snap.docs.map(d => d.data()).filter(b => b.status === "confirmed" && (!slotId || b.slotId === slotId));
        if (hit.length) alert(`Ojo: ${hit.length} persona${hit.length > 1 ? "s" : ""} ya estaba${hit.length > 1 ? "n" : ""} inscrita${hit.length > 1 ? "s" : ""} ese día. Avísales desde la pestaña Inscritos.`);
      }
      editing = null;
      toast("Guardado");
      render();
    } catch (e) { console.warn(e); fail(saveError(e)); }
  }

  async function cancelBooking(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    const reason = (prompt(`Motivo para cancelar la reserva de ${b.name} (obligatorio):`) || "").trim();
    if (reason.length < 3) { if (reason) alert("Escribe un motivo un poco más claro."); return; }
    try {
      const at = new Date().toISOString();
      const patch = {
        status: "cancelled", cancelReason: reason, cancelledAt: at, cancelledBy: "admin",
        history: fs.arrayUnion({ type: "cancelled", at, reason, by: "admin" })
      };
      await fs.updateDoc(fs.doc(db, "bookings", id), patch);
      Object.assign(b, { status: "cancelled", cancelReason: reason, cancelledAt: at, cancelledBy: "admin" });
      toast("Reserva cancelada");
      render();
    } catch (e) { alert(saveError(e)); }
  }

  /* ---------- Importar el horario desde Cal.com (un solo uso) ----------
     Lee la disponibilidad pública de Cal.com de las próximas 3 semanas, la
     reduce a un patrón semanal (clase + día + hora) y crea lo que falte.
     Se puede borrar este bloque y el botón cuando el horario ya esté cargado. */
  async function importFromCal(btn) {
    const calGet = (path, version) => fetch("https://api.cal.com/v2" + path, { headers: { "cal-api-version": version } })
      .then(r => { if (!r.ok) throw new Error("Cal.com respondió " + r.status); return r.json(); });
    const user = cfg.calUsername;
    btn.disabled = true; btn.textContent = "Leyendo Cal.com…";
    try {
      const types = await calGet(`/event-types?username=${encodeURIComponent(user)}`, "2024-06-14");
      const length = {};
      (types.data || []).forEach(t => { length[t.slug] = t.lengthInMinutes || 60; });
      const from = todayStr(), to = addDays(from, 21);
      const found = new Map();   // "clase|día|hora" → minutos
      const baseLen = {};        // duración de la clase = la de su evento principal
      await Promise.all((cfg.classes || []).map(async cls => {
        const evs = (cls.variants && cls.variants.length) ? cls.variants.map(v => v.slug) : [cls.slug];
        baseLen[cls.slug] = Math.max(...evs.map(s => length[s] || 60));
        await Promise.all(evs.map(async ev => {
          const q = `/slots?username=${encodeURIComponent(user)}&eventTypeSlug=${encodeURIComponent(ev)}&start=${from}&end=${to}&timeZone=${encodeURIComponent(TZ)}`;
          const res = await calGet(q, "2024-09-04");
          Object.entries(res.data || {}).forEach(([date, list]) => list.forEach(sl => {
            const key = `${cls.slug}|${dayKey(date)}|${sl.start.slice(11, 16)}`;
            found.set(key, Math.max(found.get(key) || 0, length[ev] || 60));   // dos variantes a la misma hora: la más larga
          }));
        }));
      }));
      if (!found.size) { alert("Cal.com no devolvió horarios en las próximas 3 semanas."); return; }

      const items = [...found].map(([k, min]) => { const [classId, day, start] = k.split("|"); return { classId, day, start, min }; })
        .sort((a, b) => DAYS.findIndex(d => d[0] === a.day) - DAYS.findIndex(d => d[0] === b.day) || a.start.localeCompare(b.start) || a.classId.localeCompare(b.classId));
      const labelOf = id => (cfg.classes.find(c => c.slug === id) || {}).label || id;
      const summary = items.map(i => `${dayName(i.day)} ${i.start}–${addMin(i.start, i.min)} · ${labelOf(i.classId)}`).join("\n");
      if (!confirm(`Encontré ${items.length} horarios semanales:\n\n${summary}\n\n¿Crearlos? Después puedes editarlos uno por uno.`)) return;

      const batch = fs.writeBatch(db);
      (cfg.classes || []).forEach((c, i) => {
        if (classOf(c.slug) || !items.some(x => x.classId === c.slug)) return;
        batch.set(fs.doc(db, "classes", c.slug), { label: c.label, tone: c.tone || "oro", page: c.page || "", order: i + 1, active: true, duration: baseLen[c.slug], capacity: DEFAULT_CAP });
      });
      items.forEach(i => {
        const cls = classOf(i.classId);
        const data = { classId: i.classId, day: i.day, start: i.start, active: true };
        if (i.min !== (cls ? cls.duration : baseLen[i.classId])) data.duration = i.min;
        batch.set(fs.doc(fs.collection(db, "slots")), data);
      });
      await batch.commit();
      await loadBase();
      toast("Horario importado");
      render();
    } catch (e) {
      console.warn(e);
      alert("No se pudo importar: " + (e.code ? saveError(e) : e.message));
    } finally {
      if (btn.isConnected) { btn.disabled = false; btn.textContent = "Importar horario desde Cal.com"; }
    }
  }

  root.addEventListener("click", async e => {
    const t = e.target;
    const csub = t.closest("[data-csub]");
    if (csub) { sub = csub.dataset.csub; editing = null; render(); return; }
    if (t.closest("[data-back]")) { editing = null; render(); return; }
    const nw = t.closest("[data-new]");
    if (nw) { editing = { kind: nw.dataset.new, item: null }; render(); window.scrollTo({ top: 0 }); return; }
    if (t.closest("[data-close-editor]")) { slotEditor = null; render(); return; }
    const sd = t.closest("[data-sched-del]");
    if (sd) return deleteSched(sd.dataset.schedDel);
    const se = t.closest("[data-sched-edit]");
    if (se) { const slot = slots.find(x => x.id === se.dataset.schedEdit); if (slot) openSchedEditor({ slot, day: slot.day, hour: parseInt(slot.start, 10) }); return; }
    const sa = t.closest("[data-sched-add]");
    if (sa) { openSchedEditor({ slot: null, day: sa.dataset.day, hour: Number(sa.dataset.hour) }); return; }
    const ec = t.closest("[data-edit-class]");
    if (ec) { editing = { kind: "class", item: classOf(ec.dataset.editClass) }; render(); window.scrollTo({ top: 0 }); return; }
    const cb = t.closest("[data-cancel-booking]");
    if (cb) return cancelBooking(cb.dataset.cancelBooking);
    if (t.closest("[data-close-detail]")) { selectedKey = null; render(); return; }
    const pk = t.closest("[data-pick]");
    if (pk) { e.preventDefault(); return selectClass(pk.dataset.pick); }
    const wk = t.closest("[data-week], [data-week-go]");
    if (wk) {
      // Cada semana a la que se llega queda como un bloque con sus fechas
      weekStart = wk.dataset.weekGo || addDays(weekStart, wk.dataset.week === "prev" ? -7 : 7);
      if (!weeks.includes(weekStart)) weeks.push(weekStart);
      selectedKey = null;
      root.querySelector(".adm-toolbar").insertAdjacentHTML("afterend", '<p class="adm-loading">Cargando…</p>');
      loadBookings().then(render).catch(err => { root.innerHTML = `<p class="err">${esc(saveError(err))}</p>`; });
      return;
    }
    const del = (attr, coll, what, after) => {
      const b = t.closest(`[${attr}]`);
      if (!b) return false;
      const id = b.getAttribute(attr);
      if (!confirm(what(id))) return true;
      fs.deleteDoc(fs.doc(db, coll, id)).then(() => { after(id); toast("Borrado"); render(); }).catch(err => alert(saveError(err)));
      return true;
    };
    if (del("data-del-closure", "closures", () => "¿Borrar este cierre? Esa clase volverá a poder reservarse.", id => { closures = closures.filter(c => c.id !== id); })) return;
    const dc = t.closest("[data-del-class]");
    if (dc) return deleteClass(dc.dataset.delClass);

    if (t.closest("#importCal")) return importFromCal(t.closest("#importCal"));

    if (t.closest("#seedClasses")) {
      const b = fs.writeBatch(db);
      (cfg.classes || []).forEach((c, i) => {
        const data = { label: c.label, tone: c.tone || "oro", page: c.page || "", order: i + 1, active: true, duration: 60, capacity: DEFAULT_CAP };
        b.set(fs.doc(db, "classes", c.slug), data);
      });
      try { await b.commit(); await loadBase(); toast("Clases cargadas"); render(); } catch (err) { alert(saveError(err)); }
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && root.querySelector(".adm-modal")) { selectedKey = null; slotEditor = null; render(); }
  });

  root.addEventListener("keydown", e => {
    const cell = e.target.closest && e.target.closest("[data-sched-add]");
    if (cell && e.target === cell && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); cell.click(); }
  });

  root.addEventListener("input", e => { if (e.target.form && e.target.form.dataset.form === "sched") editorHint(e.target.form); });

  root.addEventListener("change", e => {
    if (e.target.form && e.target.form.dataset.form === "sched") editorHint(e.target.form);
    if (e.target.id === "limStart" || e.target.id === "limEnd") {
      limits = { start: Number(root.querySelector("#limStart").value), end: Number(root.querySelector("#limEnd").value) };
      try { localStorage.setItem(LIMITS_KEY, JSON.stringify(limits)); } catch (err) { /* sin almacenamiento */ }
      render();
      return;
    }
    if (e.target.id === "rgClass") { classFilter = e.target.value; render(); return; }
  });
  root.addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.dataset.form === "sched") saveSched(e.target); else saveForm(e.target);
  });

  return { activate };
}

/* ==========================================================
   Kizuna · Panel → Clases (reservas propias)
   Se carga desde admin.js. Edita en Firestore:
   classes/{id}     tipos de clase (nombre, color, duración y cupo habituales)
   slots/{id}       horario semanal: qué clase, qué día y a qué hora
   closures/{id}    clases canceladas solo en una fecha (se crean desde el horario semanal)
   y muestra bookings/{id}: quién está inscrito, quién canceló y quién
   reprogramó, con su motivo. Las reservas las crea el sitio (api/reservar).
   ========================================================== */
import { ICONS, stateIcon, iconBtn } from "./admin-icons.js";
import { infoTip } from "./admin-info.js";

const DAYS = [["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"], ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"], ["domingo", "Domingo"]];
const DAY_BY_DOW = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const TONES = [["oro", "Oro"], ["bronce", "Bronce"], ["cobre", "Cobre"], ["marino", "Marino"], ["acero", "Acero"], ["plata", "Plata"], ["crema", "Crema"], ["linea", "Línea"]];
const DESIGNS = 11;   // diseños de bloque: 0 liso (clase sin tipo) y 1 a 10 según el tipo
const SUBS = [["people", "Inscritos"], ["slots", "Horario semanal"], ["classes", "Clases"], ["config", "Configuración"]];

export function initClases({ db, fs, esc, toast, saveError }) {
  const root = document.getElementById("classesRoot");
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.booking) || {};
  const TZ = cfg.timeZone || "America/Santiago";
  const DEFAULT_CAP = cfg.defaultCapacity || 15;

  let classes = [], slots = [], closures = [], bookings = [];
  let loaded = false;
  let sub = "people";
  let editing = null;       // { kind: "class", item|null }
  let filters = { club: "", discipline: "", type: "" };   // Inscritos: filtros por club, disciplina y tipo ("" = todos)
  let weekStart = null;     // lunes de la semana que muestra la vista semanal
  let weeks = [];           // lunes de las semanas que se pueden ver: desde la primera con inscritos hasta la siguiente a la actual
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
  /* Una clase se define por disciplina + tipo (opcional) + club; su nombre es «[disciplina] [tipo] · [Club]».
     El color sale de la disciplina (tone), el diseño del bloque del tipo (design) y la franja lateral del club (clubTone). */
  const norm = s => String(s || "").trim().toLowerCase();
  const partsOf = c => {   // las clases antiguas sacan estos datos de su nombre («BJJ Gi · Kizuna»)
    if (c.discipline || c.club) return { discipline: c.discipline || "", type: c.type || "", club: c.club || "" };
    const [left, ...rest] = String(c.label || "").split(" · ");
    return { discipline: left.trim(), type: "", club: rest.join(" · ").trim() };
  };
  const composeLabel = ({ discipline, type, club }) => `${discipline}${type ? " " + type : ""} · ${club}`;
  const lookCls = c => `t-${c.tone || "oro"} ty-${c.design || 0}${c.clubTone ? " s-" + c.clubTone : ""}`;
  // Configuración: parámetros del horario de cada club (franja), disciplina (color y página) y tipo (diseño del bloque).
  // Se guardan en settings/catalog; cada clase copia los suyos (tone, page, clubTone, design) para que el sitio los lea directo.
  let catalog = { clubs: [], disciplines: [], types: [] };
  let cfgDraft = null;      // copia editable de la configuración mientras se está en esa pestaña
  const DESIGN_NAMES = ["Liso", "Contorno", "Punteado", "Tinte", "Rayado", "Doble borde", "Puntos", "Líneas", "Cuadrícula", "Degradado", "Ajedrez"];
  const uid = () => Math.random().toString(36).slice(2, 8);
  const byName = (list, name) => list.find(i => norm(i.name) === norm(name));
  const cloneCatalog = () => JSON.parse(JSON.stringify(catalog));
  // Lo que le toca a una clase según su disciplina, tipo y club
  function derive(parts) {
    const d = byName(catalog.disciplines, parts.discipline), c = byName(catalog.clubs, parts.club);
    const t = parts.type ? byName(catalog.types, parts.type) : null;
    return { tone: d ? d.tone : "oro", page: d ? d.page || "" : "", clubTone: c ? c.tone : "", design: t ? t.design : 0 };
  }
  // Agrega a la configuración lo que usan unas clases y aún no está (primera vez o clases cargadas)
  function mergeIntoCatalog(cat, items) {
    items.forEach(it => {
      const p = partsOf(it);
      if (p.discipline && !byName(cat.disciplines, p.discipline)) cat.disciplines.push({ id: uid(), name: p.discipline, tone: it.tone || "oro", page: it.page || "" });
      if (p.club && !byName(cat.clubs, p.club)) cat.clubs.push({ id: uid(), name: p.club, tone: it.clubTone || "bronce" });
      if (p.type && !byName(cat.types, p.type)) {
        const used = new Set(cat.types.map(t => t.design));
        let d = it.design || 0;
        if (!d) for (d = 1; d < DESIGNS && used.has(d); d++);
        cat.types.push({ id: uid(), name: p.type, design: Math.min(d, DESIGNS - 1) });
      }
    });
    return cat;
  }
  // Código de la clase: sale solo de su disciplina, tipo y club (judo-no-gi-kizuna)
  const autoCode = parts => slugify(composeLabel(parts));
  const slugify = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  /* ---------- Carga ---------- */
  async function loadBase() {
    const [c, s, x] = await Promise.all(["classes", "slots", "closures"].map(n => fs.getDocs(fs.collection(db, n))));
    classes = c.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    slots = s.docs.map(d => ({ id: d.id, ...d.data() }));
    closures = x.docs.map(d => ({ id: d.id, ...d.data() }));
    // Configuración de clubes, disciplinas y tipos; la primera vez se arma con lo que ya tienen las clases
    let saved = null;
    try { const snap = await fs.getDoc(fs.doc(db, "settings", "catalog")); if (snap.exists()) saved = snap.data(); } catch (e) { console.warn(e); }
    catalog = mergeIntoCatalog({ clubs: [], disciplines: [], types: [], ...(saved || {}) }, classes);
    cfgDraft = null;
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
        // Hacia adelante, lo mismo que se puede reservar en la portada (esta semana y la siguiente);
        // hacia atrás, hasta la semana de la inscripción más antigua
        const oldest = await fs.getDocs(fs.query(fs.collection(db, "bookings"), fs.orderBy("date"), fs.limit(1)));
        const oldestWeek = oldest.docs.length ? mondayOf(oldest.docs[0].data().date) : weekStart;
        const first = oldestWeek < weekStart ? oldestWeek : weekStart;
        const count = Math.round((new Date(addDays(weekStart, 7) + "T12:00:00") - new Date(first + "T12:00:00")) / 604800000) + 1;
        weeks = Array.from({ length: count }, (_, i) => addDays(first, i * 7));
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
      key, date, slotId: s.id, start: s.start, end: addMin(s.start, duration), label: cls.label, classId: s.classId, look: lookCls(cls),
      capacity: s.capacity || cls.capacity || DEFAULT_CAP, closed, people: bookings.filter(b => b.sessionKey === key)
    };
  }

  function sessionsInRange(from, to) {
    const map = new Map();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      slots.filter(s => s.active !== false && s.day === dayKey(date) && classOf(s.classId) && (!s.date || s.date === date)).forEach(s => {
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

  // Filtros por club, disciplina y tipo (se combinan)
  const FILTERS = [["club", "Club"], ["discipline", "Disciplina"], ["type", "Tipo"]];
  const filterValues = f => [...new Set(classes.map(c => partsOf(c)[f]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const classSelect = () => FILTERS.map(([f, name]) => {
    const vals = filterValues(f);
    if (vals.length < (f === "type" ? 1 : 2)) return "";
    return `<label>${name}
          <select data-filter="${f}"><option value="">Todos</option>
            ${vals.map(v => `<option value="${esc(v)}"${norm(v) === norm(filters[f]) ? " selected" : ""}>${esc(v)}</option>`).join("")}
          </select>
        </label>`;
  }).join("");

  const emptyNotice = '<div class="notice adm-seed"><p><strong>Todavía no hay horario.</strong> Crea las clases en la pestaña <b>Clases</b> y sus horarios en <b>Horario semanal</b>; después aparecerán aquí con sus inscritos.</p></div>';
  const feedNote = infoTip(`Para ver las clases y sus inscritos en tu calendario (Google, Apple, Outlook), suscríbete a <code>/api/calendario?feed=TU_SECRETO</code>. Ver RESERVAS.md.`);

  // Al tocar una clase del horario se muestran los inscritos de esa fecha exacta (pasada o futura)
  async function selectClass(key) {
    const target = key;
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

  const matchesFilter = s => {
    const q = partsOf(classOf(s.classId) || {});
    return FILTERS.every(([f]) => !filters[f] || norm(q[f]) === norm(filters[f]));
  };
  const filterLabel = () => FILTERS.map(([f]) => filters[f]).filter(Boolean).join(" · ");

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
    const cell = s => `<a class="sch-class ${esc(s.look)}${s.date < today ? " is-past" : ""}${pickedSlot === s.slotId ? " is-selected" : ""}" href="#" data-pick="${esc(s.key)}">
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
          <button class="btn small ghost" type="button" data-week="prev"${weekStart <= [...weeks].sort()[0] ? " disabled" : ""} aria-label="Semana anterior">‹</button>
          <div class="adm-weeks-scroll" data-weeks-scroll>${[...weeks].sort().map(w => `<button class="btn small ghost" type="button" data-week-go="${w}" aria-pressed="${w === weekStart}">${esc(weekRange(w))}${w === mondayOf(today) ? "<small>Actual</small>" : ""}</button>`).join("")}</div>
          <button class="btn small ghost" type="button" data-week="after"${weekStart >= [...weeks].sort().slice(-1)[0] ? " disabled" : ""} aria-label="Semana siguiente">›</button>
        </div>
        ${classSelect()}
      </div>
      <p class="sch-range adm-weeklabel">Del ${esc(dayMonth(from))} al ${esc(dayMonth(to))} · ${list.length} clase${list.length === 1 ? "" : "s"} · ${total} inscrito${total === 1 ? "" : "s"}${filterLabel() ? ` · ${esc(filterLabel())}` : ""}</p>
      ${infoTip(`Toca una clase para ver quiénes están inscritos, quiénes cancelaron y quiénes reprogramaron en esa fecha, aunque ya haya pasado.`)}
      ${list.length ? grid + mobile : '<p class="adm-empty">No hay clases esa semana.</p>'}
      ${detail}`;
  }

  function renderPeople() {
    if (!(classes.length && slots.length)) return emptyNotice;
    return `${renderWeek()}${feedNote}`;
  }

  /* ---------- Horario semanal (calendario por bloques) ----------
     Cada día es una columna y cada hora una fila de cuatro intervalos de 15 minutos. Una clase se dibuja
     como un bloque que ocupa justo lo que dura: de 17:30 a 18:30 cubre la mitad de la fila de las 17:00 y la
     mitad de la de las 18:00. Las horas que no caen en un intervalo de 15 minutos se aproximan al siguiente.
     Al tocar un lugar vacío se agrega una clase (creada antes en "Clases", que define cuánto dura);
     al tocar una clase se ajusta. */
  const LIMITS_KEY = "tn_sched_limits_v2";
  const hourLabel = h => `${String(h).padStart(2, "0")}:00`;
  const MIN_HOUR = 6, MAX_HOUR = 24;              // al desplazarse, el horario no baja de las 06:00 ni pasa de las 24:00
  const DEFAULT_LIMITS = { start: 6, end: 22 };   // sin clases ni límites elegidos, el horario se ve de 06:00 a 22:00
  let limits = null;                              // horas de los extremos si se cambiaron tocándolas; si no, salen de las clases
  try {
    const l = JSON.parse(localStorage.getItem(LIMITS_KEY) || "null");
    if (l && Number.isInteger(l.start) && Number.isInteger(l.end) && l.start >= 0 && l.end <= 24 && l.start < l.end) limits = l;
  } catch (e) { /* sin almacenamiento: se usan los de por defecto */ }
  let slotEditor = null;                          // { slot|null, day, hour, minute } mientras la ventana está abierta

  // Modo borrador: lo que se arrastra se acumula aquí y solo se guarda con "Guardar cambios".
  // Se olvida al cambiar de pestaña. Cada entrada: id del horario → { day, start } nuevos.
  const draft = new Map();
  const effective = sl => (draft.has(sl.id) ? { ...sl, ...draft.get(sl.id) } : sl);
  // Las clases únicas que ya pasaron no se muestran
  const liveSlots = () => slots.filter(sl => classOf(sl.classId) && (!sl.date || sl.date >= todayStr())).map(effective);
  // Fecha de la clase en la semana actual (o su fecha, si es única) y si esa fecha está cancelada
  const weekDateOf = sl => sl.date || addDays(mondayOf(todayStr()), DAYS.findIndex(d => d[0] === sl.day));
  const closedOn = (sl, date) => closures.some(c => c.date === date && (!c.slotId || c.slotId === sl.id));

  // Tramo que se dibuja de una clase, en minutos del día: su hora y duración exactas
  function spanOfSlot(s) {
    const [h, m] = String(s.start).split(":").map(Number);
    const a = h * 60 + m;
    const dur = (s.duration || (classOf(s.classId) || {}).duration || 60);
    return [a, Math.min(24 * 60, a + dur)];
  }

  // Los extremos se amplían solos si ya hay clases fuera de ellos
  // Sin límites elegidos, van de la clase más temprana a la más tarde
  function schedRange() {
    let start = limits ? limits.start : 24, end = limits ? limits.end : 0;
    liveSlots().forEach(s => {
      const [a, b] = spanOfSlot(s);
      start = Math.min(start, Math.floor(a / 60));
      end = Math.max(end, Math.ceil(b / 60));
    });
    if (start >= end) ({ start, end } = DEFAULT_LIMITS);
    return { start, end: Math.min(24, end) };
  }

  // Reparte en carriles las clases que se pisan (solo pasa con datos antiguos) para que no se tapen
  function layoutDay(items) {
    const out = [];
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const ends = [];
      cluster.forEach(it => {
        let lane = ends.findIndex(e => e <= it.a);
        if (lane < 0) { lane = ends.length; ends.push(it.b); } else ends[lane] = it.b;
        it.lane = lane;
      });
      cluster.forEach(it => { it.lanes = ends.length; });
      out.push(...cluster);
      cluster = [];
    };
    items.sort((x, y) => x.a - y.a || x.b - y.b).forEach(it => {
      if (cluster.length && it.a >= clusterEnd) { flush(); clusterEnd = -1; }
      clusterEnd = Math.max(clusterEnd, it.b);
      cluster.push(it);
    });
    if (cluster.length) flush();
    return out;
  }

  function renderSlots() {
    if (!classes.length) return '<div class="notice adm-seed"><p>Primero crea las clases en la pestaña <b>Clases</b>: ahí defines cuánto dura cada una. Después las ubicas aquí en el horario.</p></div>';

    const { start, end } = schedRange();
    const hours = Array.from({ length: end - start }, (_, i) => start + i);
    const hourOptions = (from, to, sel) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map(h => `<option value="${h}"${h === sel ? " selected" : ""}>${hourLabel(h)}</option>`).join("");
    const hm = min => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

    const block = it => {
      const s = it.slot, c = classOf(s.classId);
      const top = (it.a - start * 60) / 60, height = (it.b - it.a) / 60;
      const w = 100 / it.lanes;
      return `<button type="button" draggable="false" class="sch-class adm-block ${esc(lookCls(c || {}))}${s.active === false ? " is-off" : ""}${closedOn(s, weekDateOf(s)) ? " is-closed" : ""}${s.date ? " is-once" : ""}${draft.has(s.id) ? " is-draft" : ""}${it.b - it.a <= 30 ? " is-short" : ""}"
        data-sched-edit="${esc(s.id)}" style="top:calc(var(--hour-h) * ${top} + 1px);height:calc(var(--hour-h) * ${height} - 2px);left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px)">
        <span class="sch-name">${esc(c ? c.label : s.classId)}</span>
        <span class="sch-time">${hm(it.a)}–${hm(it.b)}${s.date ? ` · única ${dayMonth(s.date)}` : ""}</span>
        ${s.active === false || closedOn(s, weekDateOf(s)) ? `<span class="adm-chip-off" role="img" aria-label="${s.active === false ? "Oculta" : "Cancelada esta semana"}" title="${s.active === false ? "Oculta (no se puede reservar)" : "Cancelada esta semana (solo esa fecha)"}">${ICONS.eyeOff}</span>` : ""}
      </button>`;
    };

    // Día cerrado en borrador: todas sus clases ocultas por el cierre
    const dayClosed = k => {
      const day = liveSlots().filter(s => s.day === k);
      return day.length > 0 && day.every(s => s.active === false) && day.some(s => (draft.get(s.id) || {}).active === false);
    };

    const column = ([k, n]) => {
      const items = layoutDay(liveSlots().filter(s => s.day === k).map(s => { const [a, b] = spanOfSlot(s); return { slot: s, a, b }; }));
      return `<div class="adm-cal-col${dayClosed(k) ? " is-day-closed" : ""}" role="group" aria-label="${n}">
        ${hours.map(h => `<div class="adm-sched-cell" role="button" tabindex="0" data-sched-add data-day="${k}" data-hour="${h}" aria-label="Agregar una clase el ${n} desde las ${hourLabel(h)}"></div>`).join("")}
        ${items.map(block).join("")}
      </div>`;
    };

    const grid = `<div class="adm-sched-scroll" data-sched-scroll>
      <div class="adm-cal" style="--hour-h:64px">
        <div class="adm-cal-head"><div></div>${DAYS.map(([k, n]) => {
          const closed = dayClosed(k);
          return `<div class="adm-cal-day${closed ? " is-day-closed" : ""}"><button type="button" class="adm-day-btn${closed ? " is-draft" : ""}" data-day-toggle="${k}" aria-pressed="${closed}" title="${closed ? "Quitar el cierre de este día" : "Cerrar todo el día (deja sus clases ocultas en borrador)"}">${n}${closed ? '<span class="adm-day-tag">Borrador</span>' : ""}</button></div>`;
        }).join("")}</div>
        <div class="adm-cal-body">
          <div class="adm-cal-hours">${hours.map((h, i) => `<div class="adm-cal-hour">${i === 0
            ? `<select class="adm-limit" id="limStart" aria-label="Hora inicial del horario">${hourOptions(Math.min(MIN_HOUR, start), end - 1, start)}</select>`
            : hourLabel(h)}</div>`).join("")}</div>
          ${DAYS.map(column).join("")}
        </div>
        <div class="adm-cal-foot"><div><select class="adm-limit" id="limEnd" aria-label="Hora final del horario">${hourOptions(start + 1, 24, end)}</select></div></div>
      </div>
    </div>`;

    return `<div class="adm-bar"><h2>Horario semanal</h2></div>
      ${infoTip(`Toca el lugar del horario donde empieza la clase (cada hora tiene cuatro intervalos de 15 minutos) o toca una clase para ajustarla; ahí también puedes cancelarla solo una semana. Arrástrala a otro lugar para moverla de 15 en 15 minutos: queda en <b>borrador</b> hasta que presiones Guardar. Toca el nombre de un día para cerrarlo completo (también en borrador); tócalo otra vez para reabrirlo. Desplaza el horario hacia arriba o hacia abajo para ver horas más temprano o más tarde (de las 06:00 a las 24:00), o cambia las horas de los extremos (${hourLabel(start)} y ${hourLabel(end)}) tocándolas. Cada clase dura lo que defines en <b>Clases</b>. Los cambios valen para las fechas futuras y las reservas ya hechas no se mueven.`)}
      <p class="err adm-sched-msg" data-sched-msg role="alert" hidden></p>
      ${draft.size ? `<div class="adm-draft" role="status">
        <span class="adm-draft-badge">Modo borrador</span>
        <span>${draft.size === 1 ? "1 clase modificada" : `${draft.size} clases modificadas`}: los cambios <b>no están guardados</b> hasta que presiones Guardar. Si cambias de pestaña se descartan.</span>
        <span class="adm-draft-actions">
          <button class="btn small" type="button" data-draft-save>Guardar</button>
          <button class="btn small ghost" type="button" data-draft-discard>Descartar</button>
        </span>
      </div>` : ""}
      ${grid}
      ${slotEditorModal()}`;
  }

  // Próxima fecha (desde hoy) que cae en ese día de la semana
  const nextDateOfDay = day => {
    let d = todayStr();
    while (dayKey(d) !== day) d = addDays(d, 1);
    return d;
  };

  // ¿La ventana está trabajando con una clase única (una sola fecha)?
  function isOnce(form) {
    const radios = form && form.elements.freq;
    if (radios && radios.value) return radios.value === "once";
    return !!(slotEditor && slotEditor.slot && slotEditor.slot.date);
  }

  // Sección "quitar la clase": al tocar el tacho se pregunta cómo (solo esta semana o de la planificación)
  function removeBoxHtml() {
    const ed = slotEditor;
    if (!ed || !ed.slot) return "";
    const slot = ed.slot, once = !!slot.date;
    const wd = weekDateOf(slot), closed = closedOn(slot, wd), past = wd < todayStr();
    const when = esc(cap1(longDate(wd)));
    const note = closed
      ? `<p class="adm-removed-note"><span class="adm-removed-ico">${ICONS.eyeOff}</span><span>Cancelada: ${when}. Queda inactiva solo ese día.</span>
          <button type="button" class="btn small ghost" data-reopen-week>Reactivar</button></p>` : "";
    if (!ed.ask) return note + `<div class="adm-remove-row">${iconBtn("trash", once ? "Borrar clase única" : "Quitar esta clase", "data-sched-remove")}</div>`;
    const people = ed.count == null ? "" : (ed.count ? ` Tiene ${ed.count} inscrito${ed.count > 1 ? "s" : ""} en esa fecha: avísales.` : " No tiene inscritos en esa fecha.");
    return note + `<div class="adm-remove-ask" role="group" aria-label="Cómo quitar la clase">
        <p><b>¿Cancelar la clase solo en la semana actual o quitarla de la planificación semanal?</b></p>
        <button type="button" class="btn small" data-remove-week${closed || past ? " disabled" : ""}>Solo esta semana · ${when}</button>
        <small>${past ? "Esa fecha ya pasó." : closed ? "Ya está cancelada esa fecha." : `Queda inactiva solo ese día; las demás semanas siguen igual.${people}`}</small>
        <button type="button" class="btn small ghost adm-danger" data-remove-plan>De la planificación semanal</button>
        <small>Se quita de todas las semanas. Las reservas ya hechas se conservan.</small>
        <button type="button" class="rv-back" data-remove-back>Volver</button>
      </div>`;
  }

  const refreshRemoveBox = () => {
    const box = root.querySelector("[data-remove-box]");
    if (box) box.innerHTML = removeBoxHtml();
  };

  // Ventana para agregar o ajustar una clase del horario
  function slotEditorModal() {
    if (!slotEditor) return "";
    const { slot, day, hour, minute = 0 } = slotEditor;
    const x = slot || {};
    const once = !!x.date;
    const options = classes.filter(c => c.active !== false || c.id === x.classId);
    const cur = classOf(x.classId) || options[0];
    const today = todayStr();
    const startVal = slot ? slot.start : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const summary = slot
      ? `<p class="adm-help adm-slot-summary">${esc(cur ? cur.label : slot.classId)} · ${esc(dayName(slot.day))} ${esc(slot.start)}–${esc(addMin(slot.start, minutesOf(slot)))} · ${once ? `clase única del ${esc(longDate(slot.date))}` : "se repite cada semana"}</p>` : "";
    return `<div class="adm-modal">
      <div class="adm-modal-bg" data-close-editor></div>
      <form class="adm-detail adm-slotform" data-form="sched" role="dialog" aria-modal="true" aria-label="${slot ? "Detalles de la clase del horario" : "Agregar clase al horario"}" novalidate>
        <div class="adm-detail-head">
          <h3 class="adm-detail-title">${slot ? "Detalles de la clase" : "Agregar al horario"}</h3>
          <button class="btn small ghost" type="button" data-close-editor>Cerrar</button>
        </div>
        ${summary}
        <div class="field"><label for="seClass">Clase</label>
          <select id="seClass" name="classId">${options.map(c => `<option value="${esc(c.id)}" data-min="${esc(c.duration || 60)}"${c.id === cur.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
        ${slot ? "" : `<div class="field"><label id="seFreqLabel">¿Es una clase única o se repite cada semana?</label>
          <div class="adm-days" role="radiogroup" aria-labelledby="seFreqLabel">
            <label class="check"><input type="radio" name="freq" value="weekly" checked> Recurrente: se repite cada semana</label>
            <label class="check"><input type="radio" name="freq" value="once"> Única: solo una fecha</label>
          </div></div>`}
        <div class="field" data-once-only${once ? "" : " hidden"}><label for="seDate">Fecha de la clase única</label>
          <input id="seDate" name="date" type="date" min="${esc(today)}" value="${esc(x.date || nextDateOfDay(day || x.day || "lunes"))}"></div>
        <div class="field"><label for="seStart">Hora de inicio</label>
          <input id="seStart" name="start" type="time" value="${esc(startVal)}" required>
          <small class="adm-help" data-hint></small></div>
        <div class="field" data-weekly-only${once ? " hidden" : ""}><label id="seDaysLabel">Días en que se repite</label>
          <div class="adm-days" role="group" aria-labelledby="seDaysLabel">${DAYS.map(([k, n]) => {
            const mine = k === (slot ? slot.day : day);
            return `<label class="check"><input type="checkbox" name="days" value="${k}"${mine ? " checked" : ""}${slot && mine ? " disabled" : ""}> ${n}</label>`;
          }).join("")}</div>
          <small class="adm-help">${slot ? "Marca otros días para copiar esta clase a la misma hora." : "Marca más días si esta clase se repite a la misma hora."}</small></div>
        ${slot && slot.duration ? `<label class="check"><input type="checkbox" name="useClassDur"> Usar la duración de la clase (${esc((classOf(slot.classId) || {}).duration || 60)} min) en vez de ${esc(slot.duration)} min</label>` : ""}
        <label class="check"><input type="checkbox" name="active"${x.active === false ? "" : " checked"}> Activa (si no, no se puede reservar)</label>
        <div class="err" data-err role="alert"></div>
        <div class="adm-actions"><button class="btn" type="submit">Guardar</button></div>
        ${slot ? `<div class="adm-remove" data-remove-box>${removeBoxHtml()}</div>` : ""}
      </form>
    </div>`;
  }

  /* ---- Solapes ----
     Cada clase ocupa desde su hora de inicio hasta que cumple su duración. Se compara en minutos
     de la semana (lunes 00:00 = 0), así también se detecta una clase que pasa de medianoche. */
  const WEEK_MIN = 7 * 1440;
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const spanOf = (day, start, min) => { const a = DAYS.findIndex(d => d[0] === day) * 1440 + toMin(start); return [a, a + min]; };
  const minutesOf = sl => sl.duration || (classOf(sl.classId) || {}).duration || 60;

  // Mensajes de cada choque con el resto del horario (solo cuentan las clases activas).
  // date: si se pasa, es una clase única de esa fecha; solo choca con las recurrentes de ese día y con
  // otras únicas de la misma fecha. Una recurrente nueva choca también con las únicas que aún no pasan.
  function findOverlaps({ days, start, minutes, excludeId, date }) {
    const found = [];
    const today = todayStr();
    days.forEach(day => {
      const [a, b] = spanOf(day, start, minutes);
      liveSlots()
        .filter(o => o.active !== false && o.id !== excludeId && (date ? (!o.date || o.date === date) : (!o.date || o.date >= today)))
        .forEach(o => {
          const len = minutesOf(o);
          const [c, d] = spanOf(o.day, o.start, len);
          if (![0, WEEK_MIN, -WEEK_MIN].some(k => a < d + k && c + k < b)) return;
          const name = (classOf(o.classId) || {}).label || o.classId;
          found.push(`El ${dayName(day).toLowerCase()} ${start}–${addMin(start, minutes)} se solapa con «${name}» (${dayName(o.day).toLowerCase()} ${o.start}–${addMin(o.start, len)}${o.date ? `, única del ${dayMonth(o.date)}` : ""}).`);
        });
    });
    return [...new Set(found)];
  }

  // Choques de lo que hay escrito en la ventana (vacío si todo está bien o aún falta algún dato)
  function formOverlaps(form) {
    const f = form.elements;
    const cls = classOf(f.classId.value), start = f.start.value;
    if (!cls || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !f.active.checked) return [];
    const item = slotEditor && slotEditor.slot;
    let days, date;
    if (isOnce(form)) {
      date = f.date.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayStr()) return [];
      days = [dayKey(date)];
    } else {
      days = [...form.querySelectorAll('input[name="days"]:checked')].map(i => i.value);
      if (item && !days.includes(item.day)) days.push(item.day);
    }
    // Un horario con duración propia la conserva mientras no se cambie de clase ni se pida usar la de la clase
    const keepOwn = item && item.duration && item.classId === cls.id && !(f.useClassDur && f.useClassDur.checked);
    return findOverlaps({ days, start, minutes: keepOwn ? item.duration : (cls.duration || 60), excludeId: item && item.id, date });
  }

  // Según sea recurrente o única, se muestran los días o la fecha
  function syncFreq(form) {
    const once = isOnce(form);
    form.querySelectorAll("[data-once-only]").forEach(el => { el.hidden = !once; });
    form.querySelectorAll("[data-weekly-only]").forEach(el => { el.hidden = once; });
  }

  // "Termina a las 19:30" según la clase y la hora elegidas; avisa en vivo si se solapa
  function editorHint(form) {
    syncFreq(form);
    const clash = formOverlaps(form);
    const errBox = form.querySelector("[data-err]");
    if (errBox) errBox.textContent = clash.length ? clash.join("\n") : "";
    const opt = form.elements.classId.selectedOptions[0];
    const t = form.elements.start.value;
    const hint = form.querySelector("[data-hint]");
    if (!opt || !hint) return;
    const min = Number(opt.dataset.min) || 60;
    hint.textContent = /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
      ? `Dura ${min} min (se define en Clases) · termina a las ${addMin(t, min)}`
      : `Dura ${min} min (se define en Clases)`;
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
    const once = isOnce(form);
    const active = f.active.checked;

    // Clase única: una sola fecha; el día de la semana sale de la fecha
    let onceDate = null;
    if (once) {
      onceDate = f.date.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(onceDate)) return fail("Elige la fecha de la clase única.");
      if (onceDate < todayStr()) return fail("La fecha de una clase única no puede ser anterior a hoy.");
    }
    const days = once ? [dayKey(onceDate)] : [...form.querySelectorAll('input[name="days"]:checked')].map(i => i.value);
    if (!once && item && !days.includes(item.day)) days.push(item.day);
    if (!days.length) return fail("Elige al menos un día.");

    const clash = formOverlaps(form);
    if (clash.length) return fail(["No se puede guardar: la clase se solapa con otra del horario.", ...clash].join("\n"));
    const batch = fs.writeBatch(db);
    let updated = null;
    const created = [];
    if (item) {
      const { id, ...data } = item;
      Object.assign(data, { classId, start, active });
      if (once) Object.assign(data, { day: days[0], date: onceDate });
      if (f.useClassDur && f.useClassDur.checked) delete data.duration;
      batch.set(fs.doc(db, "slots", id), data);
      updated = { id, ...data };
    }
    // Copias en otros días (solo recurrentes); una clase única nueva crea una sola
    const targets = once ? (item ? [] : days) : days.filter(d => !item || d !== item.day);
    targets.forEach(day => {
      if (!once && slots.some(s => !s.date && s.classId === classId && s.day === day && s.start === start)) return;   // ya existe
      const ref = fs.doc(fs.collection(db, "slots"));
      const data = { classId, day, start, active };
      if (once) data.date = onceDate;
      batch.set(ref, data);
      created.push({ id: ref.id, ...data });
    });
    try {
      await batch.commit();
      slots = slots.map(s => (updated && s.id === updated.id ? updated : s)).concat(created);
      if (updated) draft.delete(updated.id);
      slotEditor = null;
      toast(item ? "Horario actualizado" : once ? "Clase única agregada" : `${created.length} horario${created.length === 1 ? "" : "s"} agregado${created.length === 1 ? "" : "s"}`);
      render();
    } catch (e) { console.warn(e); fail(saveError(e)); }
  }

  /* ---- Quitar una clase del horario ---- */
  function openRemove() {
    const sl = slotEditor && slotEditor.slot;
    if (!sl) return;
    if (sl.date) { deleteSched(sl.id); return; }   // una clase única solo tiene una fecha: se borra directo
    slotEditor.ask = true;
    slotEditor.count = null;
    refreshRemoveBox();
    loadCount(sl);
  }

  function closeRemove() {
    if (!slotEditor) return;
    slotEditor.ask = false;
    refreshRemoveBox();
  }

  // Cuántos inscritos tiene la clase en la fecha que se cancelaría
  async function loadCount(sl) {
    const ed = slotEditor;
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, "bookings"), fs.where("sessionKey", "==", `${sl.id}_${weekDateOf(sl)}`)));
      if (slotEditor !== ed) return;
      ed.count = snap.docs.filter(d => d.data().status === "confirmed").length;
      refreshRemoveBox();
    } catch (e) { console.warn(e); }
  }

  // Cancelar solo la semana actual: la clase queda inactiva únicamente esa fecha (se guarda como un cierre)
  async function cancelWeek() {
    const sl = slotEditor && slotEditor.slot;
    if (!sl) return;
    const wd = weekDateOf(sl);
    const label = (classOf(sl.classId) || {}).label || "la clase";
    const people = slotEditor.count ? ` Tiene ${slotEditor.count} inscrito${slotEditor.count > 1 ? "s" : ""}: avísales.` : "";
    if (!confirm(`¿Cancelar «${label}» el ${longDate(wd)}? Solo esa fecha queda inactiva; las demás semanas no cambian.${people}`)) return;
    const id = `${sl.id}_${wd}`;
    const data = { date: wd, slotId: sl.id, reason: "Cancelada desde el horario semanal" };
    slotEditor = null;      // la ventana se cierra sola al confirmar
    render();
    try {
      await fs.setDoc(fs.doc(db, "closures", id), data);
      closures = [...closures.filter(c => c.id !== id), { id, ...data }];
      toast(`Cancelada solo el ${longDate(wd)}`);
    } catch (e) { console.warn(e); alert(saveError(e)); }
    render();
  }

  async function reopenWeek() {
    const sl = slotEditor && slotEditor.slot;
    if (!sl) return;
    const wd = weekDateOf(sl);
    if (!confirm(`¿Reactivar la clase el ${longDate(wd)}? Volverá a poder reservarse.`)) return;
    const ids = closures.filter(c => c.date === wd && c.slotId === sl.id).map(c => c.id);
    slotEditor = null;
    render();
    try {
      await Promise.all(ids.map(id => fs.deleteDoc(fs.doc(db, "closures", id))));
      closures = closures.filter(c => !ids.includes(c.id));
      toast("Clase reactivada");
    } catch (e) { console.warn(e); alert(saveError(e)); }
    render();
  }

  async function deleteSched(id) {
    const s = slots.find(x => x.id === id);
    if (!s) return;
    const msg = s.date
      ? "¿Borrar esta clase única? Las reservas ya hechas se conservan."
      : "¿Quitar esta clase de la planificación semanal? Se borra de todas las semanas. Las reservas ya hechas se conservan.";
    if (!confirm(msg)) return;
    slotEditor = null;   // la ventana se cierra sola al confirmar
    render();
    try {
      await fs.deleteDoc(fs.doc(db, "slots", id));
      slots = slots.filter(x => x.id !== id);
      draft.delete(id);
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
      toast("Clase borrada");
      render();
    } catch (e) { console.warn(e); alert(saveError(e)); }
  }

  /* ---------- Mover una clase arrastrándola ----------
     Se agarra una clase del horario y se suelta en otro bloque (día y hora). Dentro de cada bloque
     de una hora hay cuatro posiciones, de 15 en 15 minutos, según la altura donde se suelta.
     Usa eventos de puntero, así que sirve con mouse, lápiz y dedo. Un clic sin mover sigue abriendo
     la ventana de ajuste. */
  const STEP = 15;
  const DRAG_FROM = 6;                 // píxeles que hay que mover para que cuente como arrastre
  let drag = null;
  let swallowClick = false;
  let msgTimer = null;
  const pad2 = n => String(n).padStart(2, "0");
  const clock = min => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

  function showSchedMsg(text) {
    const box = root.querySelector("[data-sched-msg]");
    if (!box) { alert(text); return; }
    box.textContent = text;
    box.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { box.hidden = true; }, 9000);
  }

  // Bloque y cuarto de hora bajo el puntero (null si no hay ninguno)
  function dropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest("[data-sched-add]");
    if (!cell || !root.contains(cell)) return null;
    const r = cell.getBoundingClientRect();
    const quarter = Math.min(3, Math.max(0, Math.floor(((y - r.top) / r.height) * (60 / STEP))));
    return { cell, quarter, day: cell.dataset.day, minutes: Number(cell.dataset.hour) * 60 + quarter * STEP };
  }

  // Nueva fecha de una clase única al moverla a otro día (se queda en su misma semana)
  const shiftedDate = (slot, day) => {
    const cur = effective(slot);
    return cur.date ? addDays(cur.date, DAYS.findIndex(d => d[0] === day) - DAYS.findIndex(d => d[0] === cur.day)) : undefined;
  };

  const clashOf = (slot, t) => effective(slot).active === false ? [] :
    findOverlaps({ days: [t.day], start: clock(t.minutes), minutes: minutesOf(slot), excludeId: slot.id, date: shiftedDate(slot, t.day) });

  function paintDrop(t) {
    root.querySelectorAll(".adm-drop-line").forEach(n => n.remove());
    root.querySelectorAll(".adm-sched-cell.is-drop").forEach(n => n.classList.remove("is-drop"));
    if (!t) return;
    t.cell.classList.add("is-drop");
    const line = document.createElement("div");
    const bad = clashOf(drag.slot, t).length > 0;
    line.className = "adm-drop-line" + (bad ? " is-bad" : "");
    line.style.top = `${t.quarter * (100 / (60 / STEP))}%`;
    const tag = document.createElement("span");
    tag.textContent = `${clock(t.minutes)}${bad ? " · se solapa" : ""}`;
    line.append(tag);
    t.cell.append(line);
  }

  function endDrag() {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", cancelDrag);
    if (drag && drag.ghost) drag.ghost.remove();
    if (drag && drag.chip) drag.chip.classList.remove("is-dragging");
    document.body.classList.remove("adm-dragging");
    paintDrop(null);
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_FROM) return;
      drag.active = true;
      const w = drag.chip.getBoundingClientRect().width;
      drag.ghost = drag.chip.cloneNode(true);
      drag.ghost.classList.add("adm-drag-ghost");
      drag.ghost.removeAttribute("data-sched-edit");
      drag.ghost.style.width = `${w}px`;
      document.body.append(drag.ghost);
      drag.chip.classList.add("is-dragging");
      document.body.classList.add("adm-dragging");
    }
    e.preventDefault();
    const g = drag.ghost;
    g.style.left = `${e.clientX - g.offsetWidth / 2}px`;
    g.style.top = `${e.clientY - 18}px`;

    // Si se acerca al borde de la pantalla, la página se desplaza sola
    if (e.clientY < 56) window.scrollBy(0, -16);
    else if (e.clientY > window.innerHeight - 56) window.scrollBy(0, 16);

    drag.target = dropTarget(e.clientX, e.clientY);
    paintDrop(drag.target);
    const time = g.querySelector(".sch-time");
    if (time) {
      time.textContent = drag.target
        ? `${dayName(drag.target.day)} ${clock(drag.target.minutes)}–${addMin(clock(drag.target.minutes), minutesOf(drag.slot))}`
        : "Suelta sobre un bloque";
    }
  }

  function cancelDrag() { endDrag(); drag = null; }

  function onDragEnd(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const moved = drag.active;
    const { slot } = drag;
    const t = moved ? dropTarget(e.clientX, e.clientY) : null;
    endDrag();
    drag = null;
    if (!moved) return;                      // fue un clic: lo atiende el manejador de clics
    swallowClick = true;                     // y un arrastre no debe abrir la ventana de ajuste
    setTimeout(() => { swallowClick = false; }, 60);
    if (t) moveSlot(slot, t);
  }

  // Soltar una clase en otro lugar la deja en borrador; no se guarda todavía
  function moveSlot(slot, t) {
    const start = clock(t.minutes);
    const cur = effective(slot);
    const date = shiftedDate(slot, t.day);
    if (t.day === cur.day && start === cur.start) return;
    if (date && date < todayStr()) {
      showSchedMsg("No se puede mover: una clase única no puede quedar en una fecha que ya pasó.");
      return;
    }
    // Una clase oculta por el cierre de un día se reactiva si se mueve a un día que no está cerrado
    const wasClosed = (draft.get(slot.id) || {}).active === false;
    const others = liveSlots().filter(s => s.day === t.day && s.id !== slot.id);
    const reactivate = wasClosed && t.day !== cur.day && !(others.length && others.every(s => s.active === false));
    const clash = cur.active === false && !reactivate ? [] :
      findOverlaps({ days: [t.day], start, minutes: minutesOf(slot), excludeId: slot.id, date });
    if (clash.length) {
      showSchedMsg(["No se puede mover: la clase se solapa con otra del horario.", ...clash].join("\n"));
      return;
    }
    const hidden = wasClosed && !reactivate ? { active: false } : {};   // conserva el cierre del día
    if (t.day === slot.day && start === slot.start) setDraft(slot.id, hidden);   // volvió a su lugar original
    else setDraft(slot.id, { ...(date ? { day: t.day, start, date } : { day: t.day, start }), ...hidden });
    render();
  }

  const setDraft = (id, change) => { if (Object.keys(change).length) draft.set(id, change); else draft.delete(id); };

  // Deja la clase activa u oculta en el borrador (sin entrada si coincide con lo guardado)
  function setActive(slot, on) {
    const rest = { ...(draft.get(slot.id) || {}) };
    delete rest.active;
    if ((slot.active !== false) !== on) rest.active = on;
    setDraft(slot.id, rest);
  }

  // Tocar el nombre del día: si todas están activas, las oculta (cierre del día, en borrador);
  // si alguna está oculta, intenta reactivarlas, salvo las que se solapen con una activa.
  function toggleDay(key) {
    const day = liveSlots().filter(s => s.day === key);
    if (!day.length) { showSchedMsg(`El ${dayName(key).toLowerCase()} no tiene clases para cerrar.`); return; }
    const hiddenOnes = day.filter(s => s.active === false);
    if (!hiddenOnes.length) {
      day.forEach(s => setActive(slots.find(x => x.id === s.id), false));
      render();
      return;
    }
    const kept = [];
    hiddenOnes.sort((x, y) => x.start.localeCompare(y.start)).forEach(s => {
      const clash = findOverlaps({ days: [s.day], start: s.start, minutes: minutesOf(s), excludeId: s.id, date: s.date });
      if (clash.length) kept.push({ s, clash });
      else setActive(slots.find(x => x.id === s.id), true);
    });
    render();
    if (kept.length) {
      const name = s => (classOf(s.classId) || {}).label || s.classId;
      showSchedMsg([`Se reactivó el ${dayName(key).toLowerCase()}, pero ${kept.length === 1 ? "esta clase sigue desactivada" : "estas clases siguen desactivadas"} porque se solapan con otra activa:`,
        ...kept.map(k => `«${name(k.s)}» ${k.s.start}–${addMin(k.s.start, minutesOf(k.s))}: ${k.clash[0].replace(/^El [^ ]+ [\d:–]+ se solapa con /, "se solapa con ")}`)].join("\n"));
    }
  }

  function discardDraft() {
    if (!draft.size) return;
    draft.clear();
    render();
  }

  async function saveDraft() {
    const ids = [...draft.keys()];
    if (!ids.length) return;
    const btn = root.querySelector("[data-draft-save]");
    if (btn) btn.disabled = true;
    try {
      const batch = fs.writeBatch(db);
      ids.forEach(id => batch.update(fs.doc(db, "slots", id), draft.get(id)));
      await batch.commit();
      ids.forEach(id => { const sl = slots.find(x => x.id === id); if (sl) Object.assign(sl, draft.get(id)); });
      draft.clear();
      toast(ids.length === 1 ? "Cambio guardado" : `${ids.length} cambios guardados`);
    } catch (e) {
      console.warn(e);
      alert(saveError(e));       // el borrador se conserva para reintentar
    }
    render();
  }

  // El navegador no debe iniciar su propio arrastre (que cancela los eventos de puntero)
  root.addEventListener("dragstart", e => { if (e.target.closest && e.target.closest("[data-sched-edit]")) e.preventDefault(); });

  // Al desplazar el horario más allá de su borde se suma una hora (de las 06:00 a las 24:00)
  let wheelLock = 0;
  root.addEventListener("wheel", e => {
    const sc = e.target.closest && e.target.closest("[data-sched-scroll]");
    if (!sc || drag || slotEditor || !e.deltaY) return;
    const up = e.deltaY < 0;
    const edge = up ? sc.scrollTop <= 0 : sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    const { start, end } = schedRange();
    if (!edge || (up ? start <= MIN_HOUR : end >= MAX_HOUR)) return;
    e.preventDefault();
    if (Date.now() - wheelLock < 90) return;
    wheelLock = Date.now();
    const top = sc.scrollTop, hourH = sc.querySelector(".adm-cal-hour").offsetHeight;
    limits = { start: up ? start - 1 : start, end: up ? end : end + 1 };
    render();
    const now = root.querySelector("[data-sched-scroll]");
    if (now) now.scrollTop = up ? top + hourH : top;
  }, { passive: false });

  root.addEventListener("pointerdown", e => {
    if (e.target.closest("[data-draft-save], [data-draft-discard]")) return;
    if (e.button !== 0 || !e.isPrimary || slotEditor) return;
    const chip = e.target.closest("[data-sched-edit]");
    const slot = chip && slots.find(x => x.id === chip.dataset.schedEdit);
    if (!slot) return;
    drag = { slot, chip, x0: e.clientX, y0: e.clientY, pid: e.pointerId, active: false, ghost: null, target: null };
    window.addEventListener("pointermove", onDragMove, { passive: false });
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", cancelDrag);
  });

  root.addEventListener("click", e => {
    if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; }
  }, true);

  /* ---------- Clases ---------- */
  function renderClasses() {
    if (editing && editing.kind === "class") return classForm(editing.item);
    const seed = !classes.length && (cfg.classes || []).length
      ? `<div class="notice adm-seed"><p><strong>Aún no hay clases en el panel.</strong> Puedes cargar las ${cfg.classes.length} que ya tenías en el sitio (con sus colores y páginas) para ajustarlas.</p><button class="btn small" type="button" id="seedClasses">Cargar las clases de siempre</button></div>` : "";
    return `<div class="adm-bar"><h2>Clases</h2><button class="btn" type="button" data-new="class">Nueva clase</button></div>
      ${infoTip(`Una clase es una disciplina o formato (Judo, BJJ Gi, Judo Kids…). Su duración y cupo sirven por defecto para todos sus horarios.`)}
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
    const p = c ? partsOf(c) : { discipline: "", type: "", club: "" };
    const ready = catalog.disciplines.length && catalog.clubs.length;
    if (!ready) return `<div class="adm-editor"><div class="adm-bar"><h2>Nueva clase</h2><div class="adm-actions"><button class="btn ghost" type="button" data-back>Volver</button></div></div>
      <div class="notice adm-seed"><p>Antes de crear una clase agrega al menos un <b>club</b> y una <b>disciplina</b> en <b>Configuración</b>: ahí se define el color, el diseño y la franja de cada una.</p>
      <button class="btn small" type="button" data-csub="config">Ir a Configuración</button></div></div>`;
    const opts = (list, sel) => list.map(i => `<option value="${esc(i.name)}"${norm(i.name) === norm(sel) ? " selected" : ""}>${esc(i.name)}</option>`).join("");
    const known = (list, v) => !v || byName(list, v) ? "" : `<option value="${esc(v)}" selected>${esc(v)} (ya no está en Configuración)</option>`;
    const look = derive(p);
    const label = p.discipline && p.club ? composeLabel(p) : "Disciplina · Club";
    return `<form class="adm-editor adm-form" data-form="class" novalidate>
      <div class="adm-bar"><h2>${c ? "Editar clase" : "Nueva clase"}</h2>
        <div class="adm-actions"><button class="btn ghost" type="button" data-back>Cancelar</button><button class="btn" type="submit">Guardar</button></div></div>
      <div class="adm-formgrid">
        <div class="field"><label for="cDisc">Disciplina</label><select id="cDisc" name="discipline" required><option value="">Elige…</option>${known(catalog.disciplines, p.discipline)}${opts(catalog.disciplines, p.discipline)}</select></div>
        <div class="field"><label for="cType">Tipo <small>(opcional)</small></label><select id="cType" name="type"><option value="">Sin tipo</option>${known(catalog.types, p.type)}${opts(catalog.types, p.type)}</select></div>
        <div class="field"><label for="cClub">Club</label><select id="cClub" name="club" required><option value="">Elige…</option>${known(catalog.clubs, p.club)}${opts(catalog.clubs, p.club)}</select>
          <small class="adm-help">Las opciones se administran en <a href="#" data-csub="config">Configuración</a>.</small></div>
        <div class="field"><label>Nombre de la clase</label><output class="adm-classname" data-classname>${esc(label)}</output>
          <small class="adm-help">Se arma solo: disciplina, tipo y club.</small></div>
        <div class="field"><label>Código</label><output class="adm-classcode" data-classcode>${esc(c ? x.id : (p.discipline && p.club ? autoCode(p) : "—"))}</output>
          <small class="adm-help">Se genera solo con la disciplina, el tipo y el club, y no cambia después.</small></div>
        <div class="field"><label>Así se ve en el horario</label><div class="adm-classpreview"><div class="sch-class ${esc(lookCls({ ...look, tone: look.tone }))}" data-classpreview><span class="sch-name">${esc(label)}</span><span class="sch-time">19:00–20:00</span></div></div></div>
        <div class="field"><label for="cDur">Duración de la clase (minutos)</label><input id="cDur" name="duration" type="number" min="10" max="300" value="${esc(x.duration || 60)}">
          <small class="adm-help">Es lo que dura en el horario semanal: al ubicarla ahí solo eliges la hora de inicio.</small></div>
        <div class="field"><label for="cCap">Cupos habituales</label><input id="cCap" name="capacity" type="number" min="1" max="200" value="${esc(x.capacity || DEFAULT_CAP)}"></div>
        <div class="field"><label for="cOrder">Orden</label><input id="cOrder" name="order" type="number" value="${esc(x.order ?? classes.length + 1)}"></div>
      </div>
      <label class="check"><input type="checkbox" name="active"${x.active === false ? "" : " checked"}> Activa (si no, desaparece de las reservas)</label>
      <div class="err" data-err role="alert"></div>
    </form>`;
  }

  /* ---------- Configuración ---------- */
  const toneOptions = sel => TONES.filter(([k]) => k !== "linea").map(([k, n]) => `<option value="${k}"${k === sel ? " selected" : ""}>${n}</option>`).join("");
  const designOptions = sel => DESIGN_NAMES.slice(1).map((n, i) => `<option value="${i + 1}"${i + 1 === sel ? " selected" : ""}>${n}</option>`).join("");

  function renderConfig() {
    if (!cfgDraft) cfgDraft = cloneCatalog();
    const dirty = JSON.stringify(cfgDraft) !== JSON.stringify(catalog);
    const sw = (cls) => `<span class="sch-class adm-cfg-sw ${cls}" aria-hidden="true"></span>`;
    const section = (key, title, help, rows, add) => `<section class="adm-cfg" data-sec="${key}">
        <h3>${title}</h3><p class="adm-help">${help}</p>
        ${rows.length ? rows.join("") : '<p class="adm-help adm-cfg-empty">Todavía no hay ninguno.</p>'}
        <button class="btn small ghost" type="button" data-cfg-add="${key}">${add}</button>
      </section>`;
    const row = (id, swatch, fields) => `<div class="adm-cfg-row" data-id="${esc(id)}">${swatch}${fields}
        ${iconBtn("trash", "Quitar", `data-cfg-del="${esc(id)}"`)}</div>`;
    const nameField = (v, ph) => `<input data-f="name" maxlength="30" value="${esc(v)}" placeholder="${ph}" aria-label="Nombre">`;
    const clubs = cfgDraft.clubs.map(c => row(c.id, sw(`t-marino ty-0 s-${c.tone}`),
      `${nameField(c.name, "Kizuna, Núcleo…")}<select data-f="tone" aria-label="Color de la franja">${toneOptions(c.tone)}</select>`));
    const discs = cfgDraft.disciplines.map(d => row(d.id, sw(`t-${d.tone} ty-0`),
      `${nameField(d.name, "Judo, BJJ, Físico…")}<select data-f="tone" aria-label="Color">${toneOptions(d.tone)}</select>
       <input data-f="page" maxlength="60" value="${esc(d.page || "")}" placeholder="judo.html (opcional)" aria-label="Página de la disciplina" list="dlPages">`));
    const types = cfgDraft.types.map(t => row(t.id, sw(`t-oro ty-${t.design}`),
      `${nameField(t.name, "Gi, No-Gi, Kids…")}<select data-f="design" aria-label="Diseño del bloque">${designOptions(t.design)}</select>`));
    return `<form data-form="config" novalidate>
      <div class="adm-bar"><h2>Configuración</h2>
        <div class="adm-actions"><button class="btn ghost" type="button" data-cfg-discard${dirty ? "" : " disabled"}>Descartar</button><button class="btn" type="submit">Guardar</button></div></div>
      ${infoTip(`Aquí defines lo que usa el horario de cada clase. Al crear una clase solo eliges su <b>disciplina</b>, su <b>tipo</b> (opcional) y su <b>club</b>: el color sale de la disciplina, el diseño del bloque del tipo y la franja lateral del club. La <b>página</b> de la disciplina es donde se muestran sus clases (por ejemplo <code>judo.html</code>). Si cambias algo aquí, se actualizan todas las clases que lo usan. El código de cada clase se arma solo con estos tres datos.`)}
      <datalist id="dlPages"><option value="judo.html"><option value="bjj.html"><option value="bjj.html#no-gi"></datalist>
      <div class="adm-cfg-grid">
        ${section("clubs", "Clubes", "Quién imparte la clase. Su color es la franja lateral del bloque.", clubs, "Agregar club")}
        ${section("disciplines", "Disciplinas", "Su color pinta el bloque y su página es donde se listan sus clases.", discs, "Agregar disciplina")}
        ${section("types", "Tipos", "Cada tipo tiene su propio diseño de bloque. Una clase puede no tener tipo.", types, "Agregar tipo")}
      </div>
      <div class="err" data-err role="alert"></div>
    </form>
    ${waSection()}`;
  }

  /* Mensaje de WhatsApp: el texto del recordatorio que envía scripts/wsp (ver WHATSAPP.md) */
  const WA_DEFAULT = "Hola {nombre} 👋, te recordamos tu clase de *{clase}* {dia} a las *{hora}* ({cuando}) en {escuela}.\nLlega 10 minutos antes. ¡Te esperamos! 🥋\n\n¿No puedes venir? Cámbiala o cancélala aquí para liberar tu cupo: {enlace}";
  const WA_FIELDS = [["{nombre}", "primer nombre de la persona"], ["{clase}", "nombre de la clase"], ["{dia}", "hoy o mañana"], ["{hora}", "hora de inicio"], ["{cuando}", "«en unas 4 horas»"], ["{escuela}", "nombre corto de la escuela"], ["{enlace}", "enlace para cambiar o cancelar"]];
  const waRender = text => {
    const sample = { nombre: "Camila", clase: "Judo · Kizuna", dia: "hoy", hora: "19:00", cuando: "en unas 4 horas", escuela: (window.SITE_CONFIG && (window.SITE_CONFIG.shortName || window.SITE_CONFIG.name)) || "la escuela", enlace: "https://tu-sitio.cl/reserva?t=…" };
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in sample ? sample[k] : m));
  };
  function waSection() {
    const text = catalog.waTemplate || WA_DEFAULT;
    return `<section class="adm-cfg adm-wa">
      <h3>Mensaje de WhatsApp</h3>
      <p class="adm-help">Texto del recordatorio que se envía por WhatsApp 4 horas antes de cada clase. Puedes usar estos datos escribiéndolos entre llaves; se reemplazan solos al enviar.</p>
      <ul class="adm-wa-fields">${WA_FIELDS.map(([k, d]) => `<li><code>${k}</code> ${esc(d)}</li>`).join("")}</ul>
      <textarea id="waTemplate" rows="8" maxlength="1000" aria-label="Texto del mensaje">${esc(text)}</textarea>
      <div class="adm-wa-preview"><span class="adm-help">Así lo recibirá la persona (con datos de ejemplo):</span><div class="adm-wa-bubble" data-wa-preview>${esc(waRender(text))}</div></div>
      <div class="adm-actions"><button class="btn ghost small" type="button" data-wa-reset>Restaurar texto original</button><button class="btn small" type="button" data-wa-save>Guardar mensaje</button></div>
      <div class="err" data-wa-err role="alert"></div>
    </section>`;
  }
  async function saveWa() {
    const box = root.querySelector("#waTemplate"), err = root.querySelector("[data-wa-err]");
    const text = box.value.replace(/\r\n/g, "\n").trim();
    err.textContent = "";
    if (text.length < 10) return void (err.textContent = "Escribe el mensaje (al menos unas palabras).");
    try {
      await fs.setDoc(fs.doc(db, "settings", "catalog"), { waTemplate: text }, { merge: true });
      catalog.waTemplate = text;
      if (cfgDraft) cfgDraft.waTemplate = text;
      toast("Mensaje guardado: se usa en el próximo envío");
    } catch (e) { console.warn(e); err.textContent = saveError(e); }
  }

  // Pasa lo escrito en el formulario a la copia editable
  function readConfig() {
    const form = root.querySelector('[data-form="config"]');
    if (!form || !cfgDraft) return;
    form.querySelectorAll(".adm-cfg-row").forEach(rw => {
      const sec = rw.closest("[data-sec]").dataset.sec;
      const item = cfgDraft[sec].find(i => i.id === rw.dataset.id);
      if (!item) return;
      rw.querySelectorAll("[data-f]").forEach(el => { item[el.dataset.f] = el.dataset.f === "design" ? Number(el.value) : el.value; });
    });
  }

  const usesOf = (sec, name) => classes.filter(c => {
    const p = partsOf(c);
    return norm({ clubs: p.club, disciplines: p.discipline, types: p.type }[sec]) === norm(name);
  });

  async function saveConfig(form) {
    const err = form.querySelector("[data-err]");
    const fail = m => { err.textContent = m; };
    err.textContent = "";
    readConfig();
    const next = cloneCatalogOf(cfgDraft);
    const labels = { clubs: "club", disciplines: "disciplina", types: "tipo" };
    for (const sec of Object.keys(labels)) {
      const seen = new Set();
      for (const it of next[sec]) {
        if (!it.name) return fail(`Hay un ${labels[sec]} sin nombre.`);
        if (seen.has(norm(it.name))) return fail(`El ${labels[sec]} «${it.name}» está repetido.`);
        seen.add(norm(it.name));
        if (sec === "disciplines" && it.page && !/^[A-Za-z0-9_\-\/.]+(#[A-Za-z0-9_-]+)?$/.test(it.page)) return fail(`La página de «${it.name}» no es válida (por ejemplo judo.html).`);
      }
    }
    // Cada clase toma los valores nuevos de su disciplina, tipo y club (también si cambió el nombre de alguno)
    const patches = new Map();
    classes.forEach(k => {
      const p = partsOf(k);
      const od = byName(catalog.disciplines, p.discipline), oc = byName(catalog.clubs, p.club), ot = p.type ? byName(catalog.types, p.type) : null;
      const nd = od && next.disciplines.find(i => i.id === od.id), nc = oc && next.clubs.find(i => i.id === oc.id), nt = ot && next.types.find(i => i.id === ot.id);
      if (!nd || !nc || (p.type && !nt)) return;       // clases con datos que no están en la configuración: se dejan como están
      const parts = { discipline: nd.name, type: nt ? nt.name : "", club: nc.name };
      const want = { label: composeLabel(parts), discipline: parts.discipline, club: parts.club, tone: nd.tone, page: nd.page || "", clubTone: nc.tone, design: nt ? nt.design : 0 };
      if (nt) want.type = nt.name;
      const patch = {};
      Object.entries(want).forEach(([key, v]) => { if (k[key] !== v) patch[key] = v; });
      if (Object.keys(patch).length) patches.set(k.id, patch);
    });
    const tooLong = [...patches.values()].find(pt => pt.label && pt.label.length > 60);
    if (tooLong) return fail(`Un nombre de clase quedaría de más de 60 caracteres («${tooLong.label}»). Acorta algún nombre.`);
    try {
      const ids = [...patches.keys()], chunks = [];
      for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400));
      if (!chunks.length) chunks.push([]);
      for (const [n, chunk] of chunks.entries()) {
        const b = fs.writeBatch(db);
        if (n === 0) b.set(fs.doc(db, "settings", "catalog"), next);
        chunk.forEach(id => b.update(fs.doc(db, "classes", id), patches.get(id)));
        await b.commit();
      }
      catalog = next;
      classes = classes.map(c => (patches.has(c.id) ? { ...c, ...patches.get(c.id) } : c));
      cfgDraft = null;
      toast(patches.size ? `Configuración guardada · ${patches.size} clase${patches.size === 1 ? "" : "s"} actualizada${patches.size === 1 ? "" : "s"}` : "Configuración guardada");
      render();
    } catch (e) { console.warn(e); fail(saveError(e)); }
  }
  const cloneCatalogOf = c => JSON.parse(JSON.stringify(c, (k, v) => (typeof v === "string" && ["name", "page"].includes(k) ? v.trim() : v)));

  /* ---------- Dibujo ---------- */
  function render() {
    const before = root.querySelector("[data-weeks-scroll]");
    const lastScroll = before ? before.scrollLeft : null;
    const sched = root.querySelector("[data-sched-scroll]");
    root.innerHTML = `<div class="filters adm-subnav" role="tablist" aria-label="Clases">
        ${SUBS.map(([k, n]) => `<button type="button" role="tab" aria-pressed="${k === sub}" data-csub="${k}">${n}</button>`).join("")}
      </div>
      <div>${{ people: renderPeople, slots: renderSlots, classes: renderClasses, config: renderConfig }[sub]()}</div>`;
    document.body.classList.toggle("adm-modal-open", !!root.querySelector(".adm-modal"));
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
        const parts = { discipline: f.discipline.value.trim(), type: f.type.value.trim(), club: f.club.value.trim() };
        if (!parts.discipline) return fail("Elige la disciplina.");
        if (!parts.club) return fail("Elige el club.");
        const label = composeLabel(parts);
        if (label.length > 60) return fail("El nombre (disciplina, tipo y club) no puede pasar de 60 caracteres.");
        const id = editing.item ? editing.item.id : autoCode(parts);
        if (!/^[a-z0-9-]{1,40}$/.test(id)) return fail("El nombre de la clase es demasiado largo para generar su código. Acorta la disciplina, el tipo o el club.");
        if (!editing.item && classOf(id)) return fail("Ya existe una clase con esa disciplina, tipo y club.");
        const data = { label, discipline: parts.discipline, club: parts.club, ...derive(parts), order: Number(f.order.value) || 0, active: f.active.checked };
        if (parts.type) data.type = parts.type;
        if (num(f.duration.value)) data.duration = num(f.duration.value);
        if (num(f.capacity.value)) data.capacity = num(f.capacity.value);
        await fs.setDoc(fs.doc(db, "classes", id), data);
        const saved = { id, ...data };
        classes = (classOf(id) ? classes.map(c => (c.id === id ? saved : c)) : [...classes, saved]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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

  root.addEventListener("submit", e => { if (e.target.dataset.form === "config") { e.preventDefault(); saveConfig(e.target); } });

  root.addEventListener("click", async e => {
    const t = e.target;
    const csub = t.closest("[data-csub]");
    if (csub) { e.preventDefault(); sub = csub.dataset.csub; editing = null; draft.clear(); slotEditor = null; render(); return; }
    if (t.closest("[data-wa-save]")) return saveWa();
    if (t.closest("[data-wa-reset]")) { const box = root.querySelector("#waTemplate"); box.value = WA_DEFAULT; root.querySelector("[data-wa-preview]").textContent = waRender(WA_DEFAULT); return; }
    const cfgAdd = t.closest("[data-cfg-add]");
    if (cfgAdd) {
      readConfig();
      const sec = cfgAdd.dataset.cfgAdd;
      cfgDraft[sec].push({ clubs: { id: uid(), name: "", tone: "bronce" }, disciplines: { id: uid(), name: "", tone: "oro", page: "" }, types: { id: uid(), name: "", design: 1 } }[sec]);
      render();
      const rows = root.querySelectorAll('[data-sec="' + sec + '"] .adm-cfg-row [data-f="name"]');
      if (rows.length) rows[rows.length - 1].focus();
      return;
    }
    const cfgDel = t.closest("[data-cfg-del]");
    if (cfgDel) {
      readConfig();
      const sec = cfgDel.closest("[data-sec]").dataset.sec, id = cfgDel.dataset.cfgDel;
      const orig = catalog[sec].find(i => i.id === id);
      const n = orig ? usesOf(sec, orig.name).length : 0;
      if (n) { alert(`No se puede quitar «${orig.name}»: la usan ${n} clase${n === 1 ? "" : "s"}. Cámbialas o bórralas primero.`); return; }
      cfgDraft[sec] = cfgDraft[sec].filter(i => i.id !== id);
      render();
      return;
    }
    if (t.closest("[data-cfg-discard]")) { cfgDraft = null; render(); return; }
    const dt = t.closest("[data-day-toggle]");
    if (dt) return toggleDay(dt.dataset.dayToggle);
    if (t.closest("[data-draft-save]")) return saveDraft();
    if (t.closest("[data-draft-discard]")) return discardDraft();
    if (t.closest("[data-back]")) { editing = null; render(); return; }
    const nw = t.closest("[data-new]");
    if (nw) { editing = { kind: nw.dataset.new, item: null }; render(); window.scrollTo({ top: 0 }); return; }
    if (t.closest("[data-close-editor]")) { slotEditor = null; render(); return; }
    if (t.closest("[data-sched-remove]")) return openRemove();
    if (t.closest("[data-remove-back]")) return closeRemove();
    if (t.closest("[data-remove-week]")) return cancelWeek();
    if (t.closest("[data-remove-plan]")) return deleteSched(slotEditor.slot.id);
    if (t.closest("[data-reopen-week]")) return reopenWeek();
    const se = t.closest("[data-sched-edit]");
    if (se) { const slot = slots.find(x => x.id === se.dataset.schedEdit); if (slot) { const cur = effective(slot); openSchedEditor({ slot: cur, day: cur.day, hour: parseInt(cur.start, 10) }); } return; }
    const sa = t.closest("[data-sched-add]");
    if (sa) {
      const r = sa.getBoundingClientRect();
      const quarter = e.detail === 0 ? 0 : Math.min(3, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * 4)));   // con teclado, a la hora en punto
      openSchedEditor({ slot: null, day: sa.dataset.day, hour: Number(sa.dataset.hour), minute: quarter * 15 });
      return;
    }
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
      const target = wk.dataset.weekGo || addDays(weekStart, wk.dataset.week === "prev" ? -7 : 7);
      if (!weeks.includes(target)) return;   // solo hay semanas con inscritos y hasta la siguiente a la actual
      weekStart = target;
      selectedKey = null;
      root.querySelector(".adm-toolbar").insertAdjacentHTML("afterend", '<p class="adm-loading">Cargando…</p>');
      loadBookings().then(render).catch(err => { root.innerHTML = `<p class="err">${esc(saveError(err))}</p>`; });
      return;
    }
    const dc = t.closest("[data-del-class]");
    if (dc) return deleteClass(dc.dataset.delClass);


    if (t.closest("#seedClasses")) {
      const b = fs.writeBatch(db);
      const cat = cloneCatalog();
      const seedItems = (cfg.classes || []).map(c => ({ ...c, label: composeLabel({ discipline: c.discipline || c.label, type: c.type || "", club: c.club || "" }) }));
      mergeIntoCatalog(cat, seedItems);
      catalog = cat;
      b.set(fs.doc(db, "settings", "catalog"), cat);
      (cfg.classes || []).forEach((c, i) => {
        const parts = { discipline: c.discipline || c.label, type: c.type || "", club: c.club || "" };
        const data = { label: composeLabel(parts), discipline: parts.discipline, club: parts.club, ...derive(parts), order: i + 1, active: true, duration: 60, capacity: DEFAULT_CAP };
        if (parts.type) data.type = parts.type;
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

  // Formulario de clase: el nombre y la vista previa se arman mientras se escribe, y una disciplina o club ya usado trae su color
  function syncClassForm(form) {
    const f = form.elements;
    const parts = { discipline: f.discipline.value.trim(), type: f.type.value.trim(), club: f.club.value.trim() };
    const label = parts.discipline && parts.club ? composeLabel(parts) : "Disciplina · Club";
    form.querySelector("[data-classname]").textContent = label;
    if (!(editing && editing.item)) form.querySelector("[data-classcode]").textContent = parts.discipline && parts.club ? autoCode(parts) : "—";
    const box = form.querySelector("[data-classpreview]");
    box.className = "sch-class " + lookCls(derive(parts));
    box.querySelector(".sch-name").textContent = label;
  }
  root.addEventListener("input", e => {
    if (e.target.id === "waTemplate") { root.querySelector("[data-wa-preview]").textContent = waRender(e.target.value); return; }
    const form = e.target.form;
    if (!form) return;
    if (form.dataset.form === "sched") editorHint(form);
    if (form.dataset.form === "class") syncClassForm(form);
  });
  root.addEventListener("change", e => {
    const form = e.target.form;
    if (!form) return;
    if (form.dataset.form === "class") syncClassForm(form);
    if (form.dataset.form === "config") { readConfig(); render(); }   // al cambiar un color o diseño se actualiza la muestra
  });

  root.addEventListener("change", e => {
    if (e.target.form && e.target.form.dataset.form === "sched") editorHint(e.target.form);
    if (e.target.id === "limStart" || e.target.id === "limEnd") {
      limits = { start: Number(root.querySelector("#limStart").value), end: Number(root.querySelector("#limEnd").value) };
      try { localStorage.setItem(LIMITS_KEY, JSON.stringify(limits)); } catch (err) { /* sin almacenamiento */ }
      render();
      return;
    }
    if (e.target.dataset.filter) { filters[e.target.dataset.filter] = e.target.value; render(); return; }
  });
  root.addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.dataset.form === "sched") saveSched(e.target); else saveForm(e.target);
  });

  // Al salir de la pestaña Clases se olvida el borrador y lo que estaba abierto
  const reset = () => { draft.clear(); slotEditor = null; selectedKey = null; };

  return { activate, reset };
}

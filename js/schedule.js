/* ==========================================================
   Kizuna · Horario semanal
   Dibuja la semana en cada [data-schedule]. Los datos salen de
   site.config.js → schedule:
     source "cal"  → lo que ofrece Cal.com en los próximos 7 días (por defecto).
                     Cada día muestra su fecha; si cambias un horario en Cal.com,
                     la página lo refleja en cuanto esa semana entra en la ventana.
     source "json" → archivo en schedule.url (formato en HORARIO.md)

   <div data-schedule></div>                          todas las clases
   <div data-schedule data-filter="judo"></div>       solo algunas (claves separadas por coma)
   data-book: sección de reservas a la que lleva cada clase
              (por defecto "#reservas"); se abre la pestaña de esa clase.
   ========================================================== */
(function(){
  const blocks = document.querySelectorAll("[data-schedule]");
  if (!blocks.length) return;

  const DAYS = [
    ["lunes", "Lunes", "Lun"], ["martes", "Martes", "Mar"], ["miercoles", "Miércoles", "Mié"],
    ["jueves", "Jueves", "Jue"], ["viernes", "Viernes", "Vie"], ["sabado", "Sábado", "Sáb"], ["domingo", "Domingo", "Dom"]
  ];
  const TONES = ["oro", "bronce", "cobre", "marino", "acero", "plata", "crema", "linea"];
  const todayKey = DAYS[(new Date().getDay() + 6) % 7][0];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const SITE = window.SITE_CONFIG || {};
  const cfg = SITE.schedule || {};
  const booking = SITE.booking || {};

  /* ---------- Datos desde Cal.com ---------- */
  const API = "https://api.cal.com/v2";
  const TZ = booking.timeZone || "America/Santiago";
  const CACHE_KEY = "tn_schedule_cal_v2";
  const CACHE_MIN = 10;
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const pad = n => String(n).padStart(2, "0");
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayOf = iso => DAYS[(new Date(iso + "T12:00:00").getDay() + 6) % 7][0];
  const shortDate = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };
  const addMin = (hhmm, min) => { const [h, m] = hhmm.split(":").map(Number); const t = h * 60 + m + min; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };
  const calGet = (path, version) => fetch(API + path, { headers: { "cal-api-version": version } })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });

  /* Semana a mostrar: hoy y los 6 días siguientes (un día de cada tipo).
     Si hoy ya no quedan clases, ese día se muestra con la fecha de la
     semana siguiente. Cal.com no entrega horarios que ya pasaron. */
  async function fromCal(){
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && Date.now() - c.t < CACHE_MIN * 60000) return c.data;
    } catch (e) {}

    const user = booking.calUsername;
    const classes = (booking.classes || []).filter(c => c && c.slug);
    if (!user || !classes.length) throw new Error("Sin clases configuradas");

    // Duración de cada evento
    const types = await calGet(`/event-types?username=${encodeURIComponent(user)}`, "2024-06-14").catch(() => ({ data: [] }));
    const length = {};
    (types.data || []).forEach(t => { length[t.slug] = t.lengthInMinutes || 60; });

    // Hoy + 7 días (el octavo sirve de reemplazo para hoy)
    const today = new Date();
    const last = new Date(today); last.setDate(last.getDate() + 7);
    const todayIso = isoDate(today), lastIso = isoDate(last);
    const endQ = new Date(last); endQ.setDate(endQ.getDate() + 1);

    const disciplinas = {};
    const byDate = {};   // "AAAA-MM-DD" → clases de ese día
    await Promise.all(classes.map(async cls => {
      disciplinas[cls.slug] = { nombre: cls.label || cls.slug, tono: cls.tone || "oro", pagina: cls.page || "" };
      const slugs = (cls.variants && cls.variants.length) ? cls.variants.map(v => v.slug) : [cls.slug];
      await Promise.all(slugs.map(async slug => {
        const q = `/slots?username=${encodeURIComponent(user)}&eventTypeSlug=${encodeURIComponent(slug)}` +
                  `&start=${todayIso}&end=${isoDate(endQ)}&timeZone=${encodeURIComponent(TZ)}`;
        const res = await calGet(q, "2024-09-04");
        Object.entries(res.data || {}).forEach(([date, slots]) => {
          if (date < todayIso || date > lastIso) return;
          slots.forEach(sl => {
            const inicio = sl.start.slice(11, 16);
            (byDate[date] = byDate[date] || []).push({ dia: dayOf(date), fecha: date, inicio, fin: addMin(inicio, length[slug] || 60), disciplina: cls.slug, pick: slug });
          });
        });
      }));
    }));

    // Qué fecha representa a cada día de la semana
    const fechas = {};
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      const iso = isoDate(d), dia = dayOf(iso);
      if (i === 7) { if (!(byDate[todayIso] || []).length) fechas[dia] = iso; }
      else fechas[dia] = iso;
    }

    // Clases de esas fechas; dos eventos de la misma clase a la misma hora → queda el más largo
    const found = {};
    Object.entries(fechas).forEach(([dia, iso]) => (byDate[iso] || []).forEach(c => {
      const key = `${dia}|${c.inicio}|${c.disciplina}`;
      if (!found[key] || c.fin > found[key].fin) found[key] = c;
    }));

    const data = { disciplinas, clases: Object.values(found), fechas, hoy: todayIso, nota: cfg.note || "" };
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch (e) {}
    return data;
  }

  function fromJson(){
    return fetch(cfg.url || "data/horario.json", { cache: "no-cache" })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  /* ---------- Dibujo ---------- */
  function render(el, data){
    const disc = data.disciplinas || {};
    const filter = (el.dataset.filter || "").split(",").map(s => s.trim()).filter(Boolean);
    const classes = (data.clases || [])
      .filter(c => disc[c.disciplina] && (!filter.length || filter.includes(c.disciplina)))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const book = el.dataset.book || "#reservas";
    const fechas = data.fechas || {};
    const isToday = k => fechas[k] ? fechas[k] === data.hoy : k === todayKey;
    const dateLabel = k => fechas[k] ? `<span class="sch-date">${shortDate(fechas[k])}</span>` : "";

    if (!classes.length) {
      el.innerHTML = '<p class="sch-empty">No hay clases publicadas en las próximas semanas. Escríbenos para conocer los horarios.</p>';
      return;
    }

    // Días a mostrar: lunes a sábado siempre; domingo solo si tiene clases
    const days = DAYS.filter(([k]) => k !== "domingo" || classes.some(c => c.dia === "domingo"));
    const times = [...new Set(classes.map(c => c.inicio))].sort();
    const used = Object.keys(disc).filter(k => classes.some(c => c.disciplina === k));
    const tone = k => TONES.includes(disc[k]?.tono) ? disc[k].tono : "oro";

    const cell = c => `<a class="sch-class t-${tone(c.disciplina)}" href="${esc(book)}" data-pick="${esc(c.pick || c.disciplina)}" data-disc="${esc(c.disciplina)}">
        <span class="sch-name">${esc(disc[c.disciplina].nombre)}</span>
        <span class="sch-time">${esc(c.inicio)}–${esc(c.fin)}</span>
        ${c.nota ? `<span class="sch-note">${esc(c.nota)}</span>` : ""}
      </a>`;

    // Leyenda / filtro (solo si hay más de una disciplina)
    const legend = used.length > 1 ? `<div class="sch-legend" role="group" aria-label="Filtrar por disciplina">
        <button type="button" class="sch-chip" aria-pressed="true" data-show="">Todas</button>
        ${used.map(k => `<button type="button" class="sch-chip" aria-pressed="false" data-show="${esc(k)}"><i class="sw t-${tone(k)}"></i>${esc(disc[k].nombre)}</button>`).join("")}
      </div>` : "";

    // Vista de grilla (computador): filas por hora, columnas por día
    const grid = `<div class="sch-grid" style="--days:${days.length}" role="table" aria-label="Horario semanal">
        <div class="sch-row sch-head" role="row">
          <div class="sch-corner" role="columnheader"></div>
          ${days.map(([k, , s]) => `<div class="sch-day${isToday(k) ? " is-today" : ""}" role="columnheader">${s}${isToday(k) ? "<small>Hoy</small>" : ""}${dateLabel(k)}</div>`).join("")}
        </div>
        ${times.map(t => `<div class="sch-row" role="row">
          <div class="sch-hour" role="rowheader">${esc(t)}</div>
          ${days.map(([k]) => {
            const here = classes.filter(c => c.dia === k && c.inicio === t);
            return `<div class="sch-cell${isToday(k) ? " is-today" : ""}" role="cell">${here.map(cell).join("")}</div>`;
          }).join("")}
        </div>`).join("")}
      </div>`;

    // Vista de lista (celular): un bloque por día
    const list = `<div class="sch-list">
        ${days.map(([k, name]) => {
          const here = classes.filter(c => c.dia === k);
          return `<div class="sch-list-day${isToday(k) ? " is-today" : ""}">
            <h3>${name}${isToday(k) ? " <small>Hoy</small>" : ""}${dateLabel(k)}</h3>
            ${here.length ? here.map(cell).join("") : '<p class="sch-rest">Sin clases</p>'}
          </div>`;
        }).join("")}
      </div>`;

    const note = data.nota ? `<p class="sch-foot">${esc(data.nota)}</p>` : "";
    const shown = days.map(([k]) => fechas[k]).filter(Boolean).sort();
    const range = shown.length ? `<p class="sch-range">Del ${shortDate(shown[0])} al ${shortDate(shown[shown.length - 1])}</p>` : "";
    el.innerHTML = range + legend + grid + list + note;
  }

  // Un solo manejador por bloque: filtros y clic en una clase
  blocks.forEach(el => el.addEventListener("click", e => {
    const chip = e.target.closest("[data-show]");
    if (chip) {
      el.querySelectorAll("[data-show]").forEach(b => b.setAttribute("aria-pressed", b === chip));
      const k = chip.dataset.show;
      el.querySelectorAll(".sch-class").forEach(a => a.classList.toggle("is-dim", !!k && a.dataset.disc !== k));
      return;
    }
    const a = e.target.closest(".sch-class");
    if (a && window.TNBooking) window.TNBooking.select(a.getAttribute("href"), a.dataset.pick);
  }));

  blocks.forEach(el => { el.innerHTML = '<p class="sch-loading">Cargando horario…</p>'; });
  (cfg.source === "json" ? fromJson() : fromCal())
    .then(data => blocks.forEach(el => render(el, data)))
    .catch(() => blocks.forEach(el => {
      el.innerHTML = '<p class="sch-empty">No pudimos cargar el horario. Revisa las clases disponibles en el calendario de reservas.</p>';
    }));
})();

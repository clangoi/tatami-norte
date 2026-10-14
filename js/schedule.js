/* ==========================================================
   Kizuna · Horario semanal
   Dibuja la semana en cada [data-schedule]. Los datos salen de
   site.config.js → schedule:
     source "own"  → la semana en curso según las clases y horarios del panel (por defecto).
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

  /* ---------- Datos ---------- */
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const pad = n => String(n).padStart(2, "0");
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayOf = iso => DAYS[(new Date(iso + "T12:00:00").getDay() + 6) % 7][0];
  const shortDate = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };
  const addMin = (hhmm, min) => { const [h, m] = hhmm.split(":").map(Number); const t = h * 60 + m + min; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };

  /* Reservas propias: la semana en curso (de lunes a domingo) según /api/clases.
     Los días que ya pasaron se muestran más claros; al empezar otra semana se muestra esa.
     Las clases llenas se marcan. */
  async function fromOwn(){
    const res = await fetch("/api/clases?semana=1").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    const disciplinas = {};
    res.classes.forEach(c => { disciplinas[c.id] = { nombre: c.label, tono: c.tone || "oro", pagina: c.page || "" }; });

    const todayIso = res.today;
    const addDay = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoDate(d); };
    const mondayIso = addDay(todayIso, -((new Date(todayIso + "T12:00:00").getDay() + 6) % 7));
    const byDate = {};
    (res.week || res.sessions).forEach(s => {
      if (!disciplinas[s.classId]) return;
      (byDate[s.date] = byDate[s.date] || []).push({
        dia: dayOf(s.date), fecha: s.date, inicio: s.start, fin: s.end, disciplina: s.classId, pick: s.classId,
        nota: s.full ? "Completa" : ""
      });
    });

    const fechas = {};
    for (let i = 0; i < 7; i++) {
      const iso = addDay(mondayIso, i);
      fechas[dayOf(iso)] = iso;
    }
    const clases = [];
    Object.values(fechas).forEach(iso => clases.push(...(byDate[iso] || [])));
    return { disciplinas, clases, fechas, hoy: todayIso, nota: cfg.note || "" };
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
    const isPast = k => !!fechas[k] && !!data.hoy && fechas[k] < data.hoy;   // día de esta semana que ya pasó
    const pastCls = k => (isPast(k) ? " is-past" : "");
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
          ${days.map(([k, , s]) => `<div class="sch-day${isToday(k) ? " is-today" : ""}${pastCls(k)}" role="columnheader">${s}${isToday(k) ? "<small>Hoy</small>" : ""}${dateLabel(k)}</div>`).join("")}
        </div>
        ${times.map(t => `<div class="sch-row" role="row">
          <div class="sch-hour" role="rowheader">${esc(t)}</div>
          ${days.map(([k]) => {
            const here = classes.filter(c => c.dia === k && c.inicio === t);
            return `<div class="sch-cell${isToday(k) ? " is-today" : ""}${pastCls(k)}" role="cell">${here.map(cell).join("")}</div>`;
          }).join("")}
        </div>`).join("")}
      </div>`;

    // Vista de lista (celular): un bloque por día
    const list = `<div class="sch-list">
        ${days.map(([k, name]) => {
          const here = classes.filter(c => c.dia === k);
          return `<div class="sch-list-day${isToday(k) ? " is-today" : ""}${pastCls(k)}">
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
      // Se pueden elegir varias disciplinas a la vez; "Todas" (o quitar la última) vuelve a mostrar todo
      const k = chip.dataset.show;
      if (!k) el.querySelectorAll("[data-show]").forEach(b => b.setAttribute("aria-pressed", !b.dataset.show));
      else chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") !== "true");
      const picked = [...el.querySelectorAll('[data-show]:not([data-show=""])[aria-pressed="true"]')].map(b => b.dataset.show);
      el.querySelector('[data-show=""]').setAttribute("aria-pressed", !picked.length);
      el.querySelectorAll(".sch-class").forEach(a => {
        const on = picked.includes(a.dataset.disc);
        a.classList.toggle("is-dim", !!picked.length && !on);
        a.classList.toggle("is-hi", on);
      });
      return;
    }
    const a = e.target.closest(".sch-class");
    if (a && window.TNBooking) window.TNBooking.select(a.getAttribute("href"), a.dataset.pick);
  }));

  blocks.forEach(el => { el.innerHTML = '<p class="sch-loading">Cargando horario…</p>'; });
  (cfg.source === "json" ? fromJson() : fromOwn())
    .then(data => blocks.forEach(el => render(el, data)))
    .catch(() => blocks.forEach(el => {
      el.innerHTML = '<p class="sch-empty">No pudimos cargar el horario. Revisa las clases disponibles en el calendario de reservas.</p>';
    }));
})();

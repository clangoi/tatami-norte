/* ==========================================================
   Kizuna · Horario semanal
   Dibuja la semana en cada [data-schedule]. Los datos salen de
   site.config.js → schedule:
     source "own"  → la semana en curso según las clases y horarios del panel (por defecto).
     source "json" → archivo en schedule.url (formato en HORARIO.md)

   <div data-schedule></div>                          todas las clases
   <div data-schedule data-filter="judo"></div>       solo algunas (claves separadas por coma)
   data-filter acepta ids de clase y «page:judo.html» (todas las clases de la disciplina que apunta a esa página,
              según Configuración en el panel).
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
    res.classes.forEach(c => { disciplinas[c.id] = { nombre: c.label, tono: c.tone || "oro", pagina: c.page || "", disciplina: c.discipline, tipo: c.type, club: c.club, franja: c.clubTone, diseno: c.design }; });

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
    return { disciplinas, clases, fechas, dias: res.days, hoy: todayIso, nota: cfg.note || "" };
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
      .filter(c => disc[c.disciplina] && (!filter.length || filter.some(t => t.startsWith("page:") ? String(disc[c.disciplina].pagina || "").split("#")[0] === t.slice(5) : t === c.disciplina)))
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

    // Días a mostrar: los del horario recurrente del panel (y los que tengan alguna clase esta semana).
    // Sin ese dato: lunes a sábado siempre; domingo solo si tiene clases
    const days = DAYS.filter(([k]) => data.dias
      ? data.dias.includes(k) || classes.some(c => c.dia === k)
      : k !== "domingo" || classes.some(c => c.dia === k));
    const times = [...new Set(classes.map(c => c.inicio))].sort();
    const used = Object.keys(disc).filter(k => classes.some(c => c.disciplina === k));
    const tone = k => TONES.includes(disc[k]?.tono) ? disc[k].tono : "oro";
    // Disciplina, tipo y club de cada clase (las antiguas los sacan de su nombre: «BJJ Gi · Kizuna»)
    const facet = k => {
      const d = disc[k] || {};
      if (d.disciplina || d.club) return { disciplina: d.disciplina || "", tipo: d.tipo || "", club: d.club || "" };
      const [left, ...rest] = String(d.nombre || k).split(" · ");
      return { disciplina: left.trim(), tipo: "", club: rest.join(" · ").trim() };
    };
    const design = k => Number.isInteger(disc[k]?.diseno) && disc[k].diseno >= 0 && disc[k].diseno <= 10 ? disc[k].diseno : 0;
    const stripe = k => TONES.includes(disc[k]?.franja) ? ` s-${disc[k].franja}` : "";

    const cell = c => `<a class="sch-class t-${tone(c.disciplina)} ty-${design(c.disciplina)}${stripe(c.disciplina)}" href="${esc(book)}" data-pick="${esc(c.pick || c.disciplina)}" data-disc="${esc(c.disciplina)}" data-f-club="${esc(facet(c.disciplina).club)}" data-f-disciplina="${esc(facet(c.disciplina).disciplina)}" data-f-tipo="${esc(facet(c.disciplina).tipo)}"${isToday(c.dia) ? ` data-today data-start="${esc(c.inicio)}" data-end="${esc(c.fin)}"` : ""}>
        <span class="sch-name">${esc(disc[c.disciplina].nombre)}</span>
        <span class="sch-time">${esc(c.inicio)}–${esc(c.fin)}</span>
        ${c.nota ? `<span class="sch-note">${esc(c.nota)}</span>` : ""}
      </a>`;

    // Filtros por club, disciplina y tipo (se pueden combinar y elegir varios en cada uno)
    const GROUPS = [["club", "Impartido por"], ["disciplina", "Disciplina"], ["tipo", "Tipo"]];
    const groupHtml = ([g, name]) => {
      const vals = [...new Set(used.map(k => facet(k)[g]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
      const untyped = g === "tipo" && used.some(k => !facet(k).tipo);
      if (vals.length < 2 && !(untyped && vals.length)) return "";
      const swatch = v => g === "disciplina" ? `<i class="sw t-${tone(used.find(k => facet(k).disciplina === v))} ty-0"></i>` : "";
      return `<div class="sch-legend-group" role="group" aria-label="Filtrar por ${name.toLowerCase()}">
          <span class="sch-legend-label">${name}</span>
          ${vals.map(v => `<button type="button" class="sch-chip" aria-pressed="false" data-group="${g}" data-val="${esc(v)}">${swatch(v)}${esc(v)}</button>`).join("")}
        </div>`;
    };
    const groups = GROUPS.map(groupHtml).join("");
    const legend = groups ? `<div class="sch-legend" role="group" aria-label="Filtrar el horario">
        <div class="sch-legend-group"><span class="sch-legend-label">Ver</span><button type="button" class="sch-chip" aria-pressed="true" data-all>Todas</button></div>
        ${groups}
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
    const chip = e.target.closest("[data-all], [data-group]");
    if (chip) {
      // Dentro de un grupo se suman las opciones (o); entre grupos se combinan (y). «Todas» limpia todo.
      if (chip.hasAttribute("data-all")) el.querySelectorAll("[data-group]").forEach(b => b.setAttribute("aria-pressed", "false"));
      else chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") !== "true");
      const picked = {};
      el.querySelectorAll('[data-group][aria-pressed="true"]').forEach(b => { (picked[b.dataset.group] = picked[b.dataset.group] || []).push(b.dataset.val); });
      const any = Object.keys(picked).length > 0;
      el.querySelector("[data-all]").setAttribute("aria-pressed", !any);
      el.querySelectorAll(".sch-class").forEach(a => {
        const on = any && Object.entries(picked).every(([g, vals]) => vals.includes(a.dataset["f" + g[0].toUpperCase() + g.slice(1)]));
        a.classList.toggle("is-dim", any && !on);
        a.classList.toggle("is-hi", on);
      });
      return;
    }
    const a = e.target.closest(".sch-class");
    if (a && window.TNBooking) window.TNBooking.select(a.getAttribute("href"), a.dataset.pick);
  }));

  // «Clases de lunes a sábado.» según los días recurrentes del horario: "de martes a jueves" (3 o más seguidos) o "los lunes y viernes"
  function daysPhrase(dias){
    const idx = DAYS.map(d => d[0]).filter(k => dias.includes(k)).map(k => DAYS.findIndex(d => d[0] === k));
    if (!idx.length) return "";
    const name = i => DAYS[i][1].toLowerCase();
    if (idx.length >= 3 && idx[idx.length - 1] - idx[0] === idx.length - 1) return `Clases de ${name(idx[0])} a ${name(idx[idx.length - 1])}.`;
    const plural = i => name(i) + (i >= 5 ? "s" : "");
    const list = idx.map(plural);
    return `Clases los ${list.length > 1 ? list.slice(0, -1).join(", ") + " y " + list[list.length - 1] : list[0]}.`;
  }

  /* Hoy: la clase se va aclarando poco a poco mientras transcurre (de 1 a .65) y queda más clara al terminar (.4);
     la que se está dictando se destaca con «Ahora» */
  const minutesNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: (SITE.booking || {}).timeZone || "America/Santiago", hourCycle: "h23", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    return +p.hour * 60 + +p.minute;
  };
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  function tickNow(){
    const now = minutesNow();
    document.querySelectorAll(".sch-class[data-today]").forEach(a => {
      const start = toMin(a.dataset.start), end = toMin(a.dataset.end);
      const live = now >= start && now < end;
      const done = now >= end ? 1 : Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
      a.style.setProperty("--fade", now >= end ? "0.4" : (1 - 0.35 * done).toFixed(2));
      a.classList.toggle("is-over", now >= end);
      a.classList.toggle("is-live", live);
      const badge = a.querySelector(".sch-live");
      if (live && !badge) a.insertAdjacentHTML("afterbegin", '<span class="sch-live">Ahora</span>');
      if (!live && badge) badge.remove();
    });
  }

  blocks.forEach(el => { el.innerHTML = '<p class="sch-loading">Cargando horario…</p>'; });
  (cfg.source === "json" ? fromJson() : fromOwn())
    .then(data => { blocks.forEach(el => render(el, data));
      if (data.dias && data.dias.length) document.querySelectorAll("[data-schedule-days]").forEach(n => { n.textContent = daysPhrase(data.dias); });
      tickNow(); setInterval(tickNow, 30000); })
    .catch(() => blocks.forEach(el => {
      el.innerHTML = '<p class="sch-empty">No pudimos cargar el horario. Revisa las clases disponibles en el calendario de reservas.</p>';
    }));
})();

/* ==========================================================
   Kizuna · Horario semanal
   Lee el horario (site.config.js → schedule.url, por defecto
   data/horario.json) y lo dibuja en cada [data-schedule].

   <div data-schedule></div>                          todas las clases
   <div data-schedule data-filter="judo"></div>       solo algunas (claves separadas por coma)
   data-book: a dónde lleva cada clase (por defecto "#reservas").
              Si el destino tiene un calendario con pestañas, se abre la de esa clase.

   Formato del archivo: ver HORARIO.md. El panel de admin
   escribirá este mismo formato.
   ========================================================== */
(function(){
  const blocks = document.querySelectorAll("[data-schedule]");
  if (!blocks.length) return;

  const DAYS = [
    ["lunes", "Lunes", "Lun"], ["martes", "Martes", "Mar"], ["miercoles", "Miércoles", "Mié"],
    ["jueves", "Jueves", "Jue"], ["viernes", "Viernes", "Vie"], ["sabado", "Sábado", "Sáb"], ["domingo", "Domingo", "Dom"]
  ];
  const TONES = ["oro", "bronce", "marino", "acero", "linea"];
  const todayKey = DAYS[(new Date().getDay() + 6) % 7][0];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cfg = window.SITE_CONFIG?.schedule || {};
  const url = cfg.url || "data/horario.json";

  function render(el, data){
    const disc = data.disciplinas || {};
    const filter = (el.dataset.filter || "").split(",").map(s => s.trim()).filter(Boolean);
    const classes = (data.clases || [])
      .filter(c => disc[c.disciplina] && (!filter.length || filter.includes(c.disciplina)))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const book = el.dataset.book || "#reservas";

    if (!classes.length) {
      el.innerHTML = '<p class="sch-empty">No hay clases publicadas para esta semana. Escríbenos para conocer los horarios.</p>';
      return;
    }

    // Días a mostrar: lunes a sábado siempre; domingo solo si tiene clases
    const days = DAYS.filter(([k]) => k !== "domingo" || classes.some(c => c.dia === "domingo"));
    const times = [...new Set(classes.map(c => c.inicio))].sort();
    const used = Object.keys(disc).filter(k => classes.some(c => c.disciplina === k));
    const tone = k => TONES.includes(disc[k]?.tono) ? disc[k].tono : "oro";

    const cell = c => `<a class="sch-class t-${tone(c.disciplina)}" href="${esc(book)}" data-pick="${esc(c.disciplina)}" data-disc="${esc(c.disciplina)}">
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
          ${days.map(([k, , s]) => `<div class="sch-day${k === todayKey ? " is-today" : ""}" role="columnheader">${s}${k === todayKey ? "<small>Hoy</small>" : ""}</div>`).join("")}
        </div>
        ${times.map(t => `<div class="sch-row" role="row">
          <div class="sch-hour" role="rowheader">${esc(t)}</div>
          ${days.map(([k]) => {
            const here = classes.filter(c => c.dia === k && c.inicio === t);
            return `<div class="sch-cell${k === todayKey ? " is-today" : ""}" role="cell">${here.map(cell).join("")}</div>`;
          }).join("")}
        </div>`).join("")}
      </div>`;

    // Vista de lista (celular): un bloque por día
    const list = `<div class="sch-list">
        ${days.map(([k, name]) => {
          const here = classes.filter(c => c.dia === k);
          return `<div class="sch-list-day${k === todayKey ? " is-today" : ""}">
            <h3>${name}${k === todayKey ? " <small>Hoy</small>" : ""}</h3>
            ${here.length ? here.map(cell).join("") : '<p class="sch-rest">Sin clases</p>'}
          </div>`;
        }).join("")}
      </div>`;

    const note = data.nota ? `<p class="sch-foot">${esc(data.nota)}</p>` : "";
    el.innerHTML = legend + grid + list + note;

    // Filtro: atenúa las disciplinas no elegidas
    el.addEventListener("click", e => {
      const chip = e.target.closest("[data-show]");
      if (chip) {
        el.querySelectorAll("[data-show]").forEach(b => b.setAttribute("aria-pressed", b === chip));
        const k = chip.dataset.show;
        el.querySelectorAll(".sch-class").forEach(a => a.classList.toggle("is-dim", !!k && a.dataset.disc !== k));
        return;
      }
      // Clic en una clase: abre la pestaña de esa clase en el calendario de destino
      const a = e.target.closest(".sch-class");
      if (a && a.getAttribute("href").startsWith("#")) {
        const tab = document.querySelector(`${a.getAttribute("href")} [data-cal-tabs] [data-slug="${a.dataset.pick}"]`);
        if (tab) tab.click();
      }
    });
  }

  fetch(url, { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => blocks.forEach(el => render(el, data)))
    .catch(() => blocks.forEach(el => {
      el.innerHTML = '<p class="sch-empty">No pudimos cargar el horario. Revisa las clases disponibles en el calendario de reservas.</p>';
    }));
})();

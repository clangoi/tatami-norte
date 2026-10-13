/* ==========================================================
   Kizuna · Reservas propias (reemplaza a Cal.com)
   Se activa con site.config.js → booking.provider: "own".
   Las clases y los horarios se administran en admin.html → Clases;
   las reservas pasan por las funciones de api/ (ver RESERVAS.md).

   Mismo uso que booking.js, así las páginas no cambian:
     TNBooking.mount(seccion)                       todas las clases
     TNBooking.mount(seccion, {slugs:["judo"]})     solo algunas (ids de clase)
     TNBooking.select(seccion, "judo")              abre esa clase
   Expone window.TNBooking.
   ========================================================== */
(function(){
  const SITE = window.SITE_CONFIG || {};
  const cfg = SITE.booking || {};
  if (cfg.provider !== "own") return;

  const API = "/api";
  const STORE_KEY = "tn_bookings";
  const REFRESH_MS = 30000;

  const successHandlers = [];
  const failHandlers = [];
  const roots = [];
  let uid = 0;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const locale = (SITE.currency && SITE.currency.locale) || "es-CL";
  const dayLabel = date => new Date(date + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const manageUrl = id => `reserva?t=${encodeURIComponent(id)}`;

  const api = (path, opts) => fetch(API + path, opts).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || "No se pudo completar. Intenta de nuevo."), { status: r.status });
    return data;
  });

  /* ---- Reservas hechas desde este navegador ("Tus reservas") ---- */
  function readMine(){
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "[]").filter(b => new Date(b.startAt) > new Date());
    } catch (e) { return []; }
  }
  function saveMine(list){ try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {} }
  function rememberBooking(b){
    const list = readMine().filter(x => x.id !== b.id);
    list.push({ id: b.id, title: b.classLabel, date: b.date, start: b.start, startAt: b.startAt });
    list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    saveMine(list);
  }
  function renderMine(root){
    const wrap = root.querySelector("[data-cal-mine]");
    const list = root.querySelector("[data-cal-mine-list]");
    if (!wrap || !list) return;
    const mine = readMine();
    wrap.hidden = !mine.length;
    list.innerHTML = mine.map(b => `<div class="mb">
      <span>${esc(b.title)} · ${esc(dayLabel(b.date))}, ${esc(b.start)}</span>
      <a class="mb-link" href="${esc(manageUrl(b.id))}">Cambiar o cancelar</a>
    </div>`).join("");
  }

  /* ---- Una sección de reservas ---- */
  function createView(root, opts){
    const container = root.querySelector("[data-cal-inline]");
    const tabs = root.querySelector("[data-cal-tabs]");
    const fallback = root.querySelector("[data-cal-fallback]");
    const id = ++uid;

    let data = null;            // { classes, sessions }
    let classId = null;         // pestaña elegida
    let pick = null;            // clase pedida antes de que carguen los datos
    let step = "list";          // list | form | done
    let chosen = null;          // sesión elegida en el formulario
    let sending = false;

    const visibleClasses = () => (data ? data.classes : []).filter(c => !opts.slugs || opts.slugs.includes(c.id));
    const sessionsOf = cid => data.sessions.filter(s => s.classId === cid);

    /* --- pestañas --- */
    function renderTabs(){
      if (!tabs) return;
      const list = visibleClasses();
      tabs.hidden = list.length < 2;
      tabs.replaceChildren(...list.map(c => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = c.label; b.dataset.slug = c.id;
        b.setAttribute("aria-pressed", c.id === classId);
        return b;
      }));
    }

    /* --- lista de horarios --- */
    function renderList(){
      const sessions = sessionsOf(classId);
      if (!sessions.length) {
        container.innerHTML = '<p class="rv-empty">No hay horarios disponibles para esta clase en los próximos días. Escríbenos y te ayudamos.</p>';
        return;
      }
      const byDate = {};
      sessions.forEach(s => (byDate[s.date] = byDate[s.date] || []).push(s));
      container.innerHTML = `<div class="rv-list">${Object.entries(byDate).map(([date, list]) => `
        <section class="rv-day">
          <h4>${esc(dayLabel(date))}</h4>
          ${list.map(s => `
          <article class="rv-session${s.full ? " is-full" : ""}">
            <div class="rv-main">
              <div class="rv-time">${esc(s.start)}–${esc(s.end)}</div>
              <div class="rv-spots">${s.full ? "Clase completa" : `${s.capacity - s.taken} de ${s.capacity} cupos`}</div>
              <button class="btn small" type="button" data-book="${esc(s.key)}"${s.full ? " disabled" : ""}>${s.full ? "Completa" : "Reservar"}</button>
            </div>
            <div class="rv-people">${s.attendees.length
              ? `<span>Inscritos:</span> ${s.attendees.map(n => `<i>${esc(n)}</i>`).join("")}`
              : "<span>Sé la primera persona en inscribirte.</span>"}</div>
          </article>`).join("")}
        </section>`).join("")}</div>`;
    }

    /* --- formulario --- */
    function renderForm(){
      const s = chosen;
      const f = n => `rv${id}-${n}`;
      container.innerHTML = `<form class="rv-form" novalidate>
        <button class="rv-back" type="button" data-back>← Elegir otra hora</button>
        <div class="rv-pick"><b>${esc(s.classLabel)}</b><span>${esc(dayLabel(s.date))} · ${esc(s.start)}–${esc(s.end)}</span></div>
        <div class="field"><label for="${f("name")}">Nombre y apellido</label><input id="${f("name")}" name="name" autocomplete="name" maxlength="80" required></div>
        <div class="field"><label for="${f("nick")}">Apodo <small>(opcional)</small></label><input id="${f("nick")}" name="nickname" maxlength="30" placeholder="Así te verán los demás en la lista">
          <small class="rv-help">Sin apodo, los demás verán tu nombre y la inicial de tu apellido.</small></div>
        <div class="field"><label for="${f("phone")}">Teléfono</label><input id="${f("phone")}" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+56 9 1234 5678" required></div>
        <div class="field"><label for="${f("mail")}">Correo</label><input id="${f("mail")}" name="email" type="email" autocomplete="email" required>
          <small class="rv-help">Ahí te enviamos la confirmación y el enlace para cambiar o cancelar.</small></div>
        <input class="rv-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="err" data-err role="alert"></div>
        <button class="btn block" type="submit">Confirmar reserva</button>
      </form>`;
      container.querySelector("input").focus({ preventScroll: true });
    }

    /* --- confirmación --- */
    function renderDone(res){
      const b = res.booking;
      container.innerHTML = `<div class="rv-done">
        <div class="eyebrow">¡Reserva confirmada!</div>
        <h3>${esc(b.classLabel)}</h3>
        <p class="rv-when">${esc(dayLabel(b.date))} · ${esc(b.start)}–${esc(b.end)}</p>
        <p>${res.emailSent
          ? `Te enviamos la confirmación a <b>${esc(b.email)}</b>, con la invitación para tu calendario.`
          : "No pudimos enviar el correo de confirmación. <b>Guarda este enlace</b> para cambiar o cancelar tu clase."}
          Llega 10 minutos antes.</p>
        <div class="rv-actions">
          <a class="btn small" href="${esc(res.google)}" target="_blank" rel="noopener">Añadir a Google Calendar</a>
          <a class="btn small ghost" href="${esc(res.ics)}">Descargar .ics</a>
          <a class="btn small ghost" href="${esc(manageUrl(b.id))}">Cambiar o cancelar</a>
        </div>
        <button class="rv-back" type="button" data-back>Reservar otra clase</button>
      </div>`;
    }

    function draw(){
      if (!data) return;
      renderTabs();
      if (step === "list") renderList();
    }

    /* --- datos --- */
    async function load(){
      try {
        data = await api("/clases");
      } catch (e) {
        if (!data) {
          container.hidden = true;
          if (fallback) fallback.hidden = false;
          failHandlers.forEach(fn => fn({}, null));
        }
        return;
      }
      const list = visibleClasses();
      if (!list.length) {
        container.hidden = true;
        if (fallback) fallback.hidden = false;
        return;
      }
      if (fallback) fallback.hidden = true;
      container.hidden = false;
      if (!list.some(c => c.id === classId)) classId = list.some(c => c.id === pick) ? pick : list[0].id;
      draw();
    }

    function select(cid){
      pick = cid;
      if (!data) return;
      if (!visibleClasses().some(c => c.id === cid)) return;
      classId = cid;
      step = "list";
      draw();
    }

    /* --- eventos --- */
    tabs && tabs.addEventListener("click", e => {
      const b = e.target.closest("[data-slug]");
      if (b) select(b.dataset.slug);
    });

    container.addEventListener("click", e => {
      const book = e.target.closest("[data-book]");
      if (book) {
        chosen = data.sessions.find(s => s.key === book.dataset.book);
        if (!chosen) return;
        step = "form";
        renderForm();
        return;
      }
      if (e.target.closest("[data-back]")) { step = "list"; draw(); load(); }
    });

    container.addEventListener("submit", async e => {
      e.preventDefault();
      if (sending) return;
      const form = e.target;
      const err = form.querySelector("[data-err]");
      const btn = form.querySelector("[type=submit]");
      const v = n => form.elements[n].value.trim();
      err.textContent = "";
      sending = true; btn.disabled = true; btn.textContent = "Reservando…";
      try {
        const res = await api("/reservar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: chosen.key, name: v("name"), nickname: v("nickname"), phone: v("phone"), email: v("email"), website: v("website") })
        });
        step = "done";
        rememberBooking(res.booking);
        renderDone(res);
        renderMine(root);
        const confirm = root.querySelector("[data-cal-confirm]");
        if (confirm) {
          const d = confirm.querySelector("[data-cal-confirm-date]");
          const t = confirm.querySelector("[data-cal-confirm-text]");
          if (d) d.textContent = `${dayLabel(res.booking.date)}, ${res.booking.start}`;
          if (t) t.textContent = `${res.booking.classLabel} está confirmada. Si necesitas cambiarla o cancelarla, usa el enlace en «Tus reservas». Llega 10 minutos antes.`;
          confirm.hidden = false;
        }
        successHandlers.forEach(fn => fn(res.booking, res.booking.classId));
        load();
      } catch (ex) {
        err.textContent = ex.message;
        if (ex.status === 409) load();   // cupo ocupado: refresca la lista
      } finally {
        sending = false; btn.disabled = false; btn.textContent = "Confirmar reserva";
      }
    });

    // Los inscritos se actualizan solos mientras la lista está a la vista
    setInterval(() => { if (!document.hidden && step === "list") load(); }, REFRESH_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && step === "list") load(); });

    container.innerHTML = '<p class="cal-loading">Cargando horarios…</p>';
    renderMine(root);
    load();
    return { el: root, select };
  }

  window.TNBooking = {
    configured: true,
    mount(root = document, opts = {}){
      if (!root.querySelector("[data-cal-inline]")) return false;
      roots.push(createView(root, opts));
      return true;
    },
    select(target, slug){
      const el = typeof target === "string" ? document.querySelector(target) : target;
      const r = el && roots.find(r => r.el === el || el.contains(r.el) || r.el.contains(el));
      if (r) r.select(slug);
      return !!r;
    },
    onSuccess(fn){ successHandlers.push(fn); },
    onFail(fn){ failHandlers.push(fn); },
    manageUrl
  };
})();

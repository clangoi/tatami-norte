/* ==========================================================
   Kizuna · Reservas propias
   Las clases y los horarios se administran en admin.html → Clases;
   las reservas pasan por las funciones de api/ (ver RESERVAS.md).

   Uso en las páginas:
     TNBooking.mount(seccion)                       todas las clases
     TNBooking.mount(seccion, {slugs:["judo"]})     solo algunas (ids de clase, o "page:judo.html" para las de una página)
     TNBooking.book(clave)                          abre el formulario de esa sesión sobre la página (lo llama el horario al tocar una clase)
   Expone window.TNBooking.
   ========================================================== */
(function(){
  const SITE = window.SITE_CONFIG || {};
  const cfg = SITE.booking || {};

  const API = "/api";
  const STORE_KEY = "tn_bookings";
  const CONTACT_KEY = "tn_contact";
  const REFRESH_MS = 30000;

  const SELF = document.currentScript && document.currentScript.src;   // para cargar js/firebase.js desde cualquier página
  const ATHLETE_FLAG = "tn_athlete";   // lo deja js/deportista.js al entrar; sin él no se carga Firebase en la portada

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
  /* ---- Deportista con sesión iniciada: reserva con los datos de su cuenta, sin formulario ----
     Solo se carga Firebase si en este navegador entró alguna vez al panel de deportista. */
  let athlete = null;          // { name, email, phone, user } cuando hay sesión y datos completos
  const athleteWatchers = [];
  function loadAthlete(){
    let flagged = false;
    try { flagged = !!localStorage.getItem(ATHLETE_FLAG); } catch (e) {}
    if (!flagged || !SELF) return;
    (async () => {
      try {
        const base = new URL("firebase.js", SELF).href;
        const { SDK, app } = await import(base);
        const { getAuth, onAuthStateChanged } = await import(`${SDK}/firebase-auth.js`);
        onAuthStateChanged(getAuth(app), async user => {
          athlete = null;
          if (!user) { try { localStorage.removeItem(ATHLETE_FLAG); } catch (e) {} }
          else {
            try {
              const token = await user.getIdToken();
              const me = await api("/deportista", { headers: { Authorization: "Bearer " + token } });
              if (me.profile.complete) athlete = { name: me.profile.name, email: me.profile.email, phone: me.profile.phone, user };
            } catch (e) { /* sin cuenta activa: se usa el formulario de siempre */ }
          }
          athleteWatchers.forEach(fn => fn());
        });
      } catch (e) { console.warn(e); }
    })();
  }

  /* ---- Datos de contacto recordados en este navegador, para no volver a escribirlos ---- */
  function readContact(){
    try { return JSON.parse(localStorage.getItem(CONTACT_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveContact(c){ try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch (e) {} }
  function renderMine(){
    const wrap = document.querySelector("[data-cal-mine]");
    const list = document.querySelector("[data-cal-mine-list]");
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
    const fallback = root.querySelector("[data-cal-fallback]");
    const id = ++uid;

    let data = null;            // { classes, sessions }
    let pending = null;         // sesión pedida antes de que carguen los datos
    let step = "list";          // list | form | done
    let chosen = null;          // sesión elegida en el formulario
    let sending = false;

    const visibleClasses = () => (data ? data.classes : []).filter(c => !opts.slugs || opts.slugs.some(t => t.startsWith("page:") ? String(c.page || "").split("#")[0] === t.slice(5) : t === c.id));

    /* --- ventana sobre la página --- */
    const showModal = () => { root.hidden = false; document.body.classList.add("modal-open"); root.scrollTop = 0; };
    function closeModal(){
      if (root.hidden) return;
      root.hidden = true;
      document.body.classList.remove("modal-open");
      step = "list";
      load();
    }

    /* --- formulario --- */
    // Con sesión de deportista: solo se muestran los datos con que se inscribe
    function renderAthleteForm(){
      const s = chosen;
      container.innerHTML = `<form class="rv-form" data-athlete novalidate>
        <button class="rv-back" type="button" data-back>← Volver al horario</button>
        <div class="rv-pick"><b>${esc(s.classLabel)}</b><span>${esc(dayLabel(s.date))} · ${esc(s.start)}–${esc(s.end)}</span></div>
        <p class="rv-help">Te inscribes con los datos de tu cuenta de deportista:</p>
        <dl class="rv-who"><dt>Nombre</dt><dd>${esc(athlete.name)}</dd><dt>Teléfono</dt><dd>${esc(athlete.phone)}</dd><dt>Correo</dt><dd>${esc(athlete.email)}</dd></dl>
        <div class="err" data-err role="alert"></div>
        <button class="btn block" type="submit">Confirmar reserva</button>
        <button class="rv-back" type="button" data-other>Reservar con otros datos</button>
        <p class="rv-help">Puedes cambiar tus datos desde <a href="deportista.html" style="color:var(--gold)">Mi panel</a>.</p>
      </form>`;
    }

    let forceForm = false;      // «Reservar con otros datos»
    function renderForm(){
      if (athlete && !forceForm) return renderAthleteForm();
      const s = chosen;
      const f = n => `rv${id}-${n}`;
      const saved = readContact();
      const val = n => esc(saved[n] || "");
      container.innerHTML = `<form class="rv-form" novalidate>
        <button class="rv-back" type="button" data-back>← Volver al horario</button>
        <div class="rv-pick"><b>${esc(s.classLabel)}</b><span>${esc(dayLabel(s.date))} · ${esc(s.start)}–${esc(s.end)}</span></div>
        <div class="field"><label for="${f("name")}">Nombre y apellido</label><input id="${f("name")}" name="name" autocomplete="name" maxlength="80" value="${val("name")}" required>
          <small class="rv-help">Los demás verán tu nombre y la inicial de tu apellido en la lista.</small></div>
        <div class="field"><label for="${f("phone")}">Teléfono</label><input id="${f("phone")}" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+56 9 1234 5678" value="${val("phone")}" required></div>
        <div class="field"><label for="${f("mail")}">Correo</label><input id="${f("mail")}" name="email" type="email" autocomplete="email" value="${val("email")}" required>
          <small class="rv-help">Ahí te enviamos la confirmación y el enlace para cambiar o cancelar.</small></div>
        <input class="rv-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="err" data-err role="alert"></div>
        <button class="btn block" type="submit">Confirmar reserva</button>
        <p class="rv-help">Tu primera clase es gratis: avísanos al llegar y trae agua y sandalias.</p>
      </form>`;
      // con datos guardados no hace falta escribir: queda listo para confirmar
      if (!saved.name) container.querySelector("input").focus({ preventScroll: true });
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
      draw();
      if (pending) { const k = pending; pending = null; open(k); }
    }

    // Abre el formulario de una sesión; false si ya no se puede reservar (terminó o está completa)
    function open(key){
      if (!data) { pending = key; return true; }
      const s = data.sessions.find(x => x.key === key && !x.full && visibleClasses().some(c => c.id === x.classId));
      if (!s) { load(); return false; }
      chosen = s;
      forceForm = false;
      step = "form";
      renderForm();
      showModal();
      return true;
    }

    /* --- eventos --- */
    // «Volver al horario», la ×, fuera de la ventana y Esc la cierran
    root.addEventListener("click", e => {
      if (e.target === root || e.target.closest("[data-close], [data-back]")) closeModal();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

    container.addEventListener("click", e => {
      if (e.target.closest("[data-other]")) { forceForm = true; renderForm(); }
    });

    // Si la sesión del deportista se resuelve con el formulario ya abierto, se cambia a sus datos
    athleteWatchers.push(() => { if (step === "form" && chosen) renderForm(); });

    container.addEventListener("submit", async e => {
      e.preventDefault();
      if (sending) return;
      const form = e.target;
      const err = form.querySelector("[data-err]");
      const btn = form.querySelector("[type=submit]");
      const asAthlete = form.hasAttribute("data-athlete");
      const v = n => form.elements[n].value.trim();
      err.textContent = "";
      sending = true; btn.disabled = true; btn.textContent = "Reservando…";
      try {
        let res;
        if (asAthlete) {
          const token = await athlete.user.getIdToken();
          res = await api("/deportista", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ action: "book", sessionKey: chosen.key })
          });
        } else {
          res = await api("/reservar", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionKey: chosen.key, name: v("name"), phone: v("phone"), email: v("email"), website: v("website") })
          });
        }
        step = "done";
        if (!asAthlete) saveContact({ name: v("name"), phone: v("phone"), email: v("email") });
        rememberBooking(res.booking);
        renderDone(res);
        renderMine();
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
    renderMine();
    load();
    return { el: root, open };
  }

  loadAthlete();

  window.TNBooking = {
    configured: true,
    mount(root = document, opts = {}){
      if (!root.querySelector("[data-cal-inline]")) return false;
      roots.push(createView(root, opts));
      return true;
    },
    book(key){ return !!roots[0] && roots[0].open(key); },
    onSuccess(fn){ successHandlers.push(fn); },
    onFail(fn){ failHandlers.push(fn); },
    manageUrl
  };
})();

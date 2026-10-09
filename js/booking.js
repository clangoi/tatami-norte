/* ==========================================================
   Reservas con Cal.com (calendario en la página)
   Usuario y clases se configuran en site.config.js → booking.
   Uso (ver el marcado completo en index.html → #booking):
     TNBooking.mount(seccion)                     todas las clases
     TNBooking.mount(seccion, {slugs:["judo"]})   solo algunas
     TNBooking.select(seccion, "judo2")           abre esa clase (o variante)
   Una clase puede tener variantes (p. ej. Judo de 1 h y de 1 h 15):
   se muestran como una sola pestaña con un selector de duración.
   Expone window.TNBooking.
   ========================================================== */
(function(){
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.booking) || {};
  const username = (cfg.calUsername || "").trim();
  const origin = cfg.calOrigin || "https://app.cal.com";
  const classes = (cfg.classes || []).filter(c => c && c.slug);
  const configured = username !== "" && classes.length > 0;

  const successHandlers = [];
  const failHandlers = [];
  const mounted = {};          // slug → elemento del calendario ya insertado
  const roots = [];            // secciones montadas: { el, select }
  let loaderReady = false;

  // Todos los eventos de Cal.com de una clase (la propia y sus variantes)
  const slugsOf = c => (c.variants && c.variants.length) ? c.variants.map(v => v.slug) : [c.slug];
  const classOf = (list, slug) => list.find(c => c.slug === slug || slugsOf(c).includes(slug));

  // Colores de la marca dentro del calendario (tema oscuro)
  const UI = {
    theme: "dark",
    hideEventTypeDetails: false,
    layout: "month_view",
    cssVarsPerTheme: {
      dark: {
        "cal-brand": "#D6BD8C",
        "cal-brand-emphasis": "#A98B5E",
        "cal-brand-text": "#1B2338",
        "cal-bg": "#1B2338",
        "cal-bg-muted": "#222c45",
        "cal-bg-subtle": "#222c45",
        "cal-bg-emphasis": "#2b3654",
        "cal-border": "#2b3654",
        "cal-border-subtle": "#2b3654",
        "cal-text": "#F6F2E7",
        "cal-text-emphasis": "#F6F2E7",
        "cal-text-subtle": "#888D95"
      }
    }
  };

  function loadLoader(){
    if (loaderReady) return;
    loaderReady = true;
    // Cargador oficial de Cal.com
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, origin + "/embed/embed.js", "init");
    Cal.config = Cal.config || {};
    Cal.config.forwardQueryParams = true;   // pasa los UTM de la página a Cal.com
  }

  // Un namespace por evento, como en el código de Cal.com
  const nsName = slug => "tn_" + slug.replace(/[^a-z0-9]/gi, "_");

  function mountInline(container, slug){
    loadLoader();
    const ns = nsName(slug);
    const el = document.createElement("div");
    el.className = "cal-frame";
    el.id = "cal-inline-" + ns;
    el.dataset.slug = slug;
    container.appendChild(el);

    Cal("init", ns, { origin });
    Cal.ns[ns]("inline", {
      elementOrSelector: "#" + el.id,
      calLink: `${username}/${slug}`,
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", theme: "dark" }
    });
    Cal.ns[ns]("ui", UI);
    Cal.ns[ns]("on", { action: "bookingSuccessfulV2", callback: e => successHandlers.forEach(fn => fn(e.detail.data || {}, slug)) });
    Cal.ns[ns]("on", { action: "linkFailed", callback: e => failHandlers.forEach(fn => fn(e.detail.data || {}, slug)) });
    mounted[slug] = el;
    return el;
  }

  function show(container, slug){
    Object.values(mounted).forEach(el => { if (container.contains(el)) el.hidden = el.dataset.slug !== slug; });
    if (!mounted[slug]) mountInline(container, slug);
    const loading = container.querySelector(".cal-loading");
    if (loading) loading.remove();
  }

  /* ---- Reservas hechas desde este navegador ----
     Cal.com guarda las reales y envía los correos; aquí solo se recuerdan
     para mostrar "Tus reservas". Se descartan las que ya pasaron. */
  const STORE_KEY = "tn_cal_bookings";
  function readBookings(){
    try {
      const list = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return list.filter(b => new Date(b.endTime || b.startTime) > new Date());
    } catch (e) { return []; }
  }
  function saveBookings(list){ try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {} }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = iso => new Date(iso).toLocaleString((window.SITE_CONFIG?.currency?.locale) || "es-CL",
    { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const manageUrl = uid => `${origin}/booking/${encodeURIComponent(uid)}`;

  function renderMine(root){
    const wrap = root.querySelector("[data-cal-mine]");
    const list = root.querySelector("[data-cal-mine-list]");
    if (!wrap || !list) return;
    const bookings = readBookings();
    wrap.hidden = !bookings.length;
    list.innerHTML = bookings.map(b => `<div class="mb">
      <span>${esc(b.title || "Clase")} · ${esc(fmtDate(b.startTime))}</span>
      <a class="mb-link" href="${esc(manageUrl(b.uid))}" target="_blank" rel="noopener">Cambiar o cancelar</a>
    </div>`).join("");
  }

  function makeButton(label, slug, pressed){
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.slug = slug;
    b.setAttribute("aria-pressed", pressed);
    return b;
  }

  window.TNBooking = {
    configured,
    classes,
    origin,

    /* Arma la sección de reservas dentro de root:
         [data-cal-tabs]        pestañas (se ocultan si hay una sola clase)
         [data-cal-inline]      calendario
         [data-cal-fallback]    aviso si Cal.com no está disponible
         [data-cal-confirm]     confirmación (con [data-cal-confirm-date] y [data-cal-confirm-text])
         [data-cal-mine]        "Tus reservas" (con [data-cal-mine-list])
       opts.slugs: limita las clases a mostrar, por ejemplo ["judo"]. */
    mount(root = document, opts = {}){
      const container = root.querySelector("[data-cal-inline]");
      const tabs = root.querySelector("[data-cal-tabs]");
      const fallback = root.querySelector("[data-cal-fallback]");
      const list = opts.slugs
        ? classes.filter(c => opts.slugs.includes(c.slug) || slugsOf(c).some(s => opts.slugs.includes(s)))
        : classes;

      renderMine(root);
      if (!container || !configured || !list.length) {
        if (container) container.hidden = true;
        if (fallback) fallback.hidden = false;
        return false;
      }

      // Selector de duración (solo para clases con variantes)
      const variantsBar = document.createElement("div");
      variantsBar.className = "filters cal-variants";
      variantsBar.setAttribute("role", "group");
      variantsBar.setAttribute("aria-label", "Duración");
      variantsBar.hidden = true;
      container.parentNode.insertBefore(variantsBar, container);

      const current = {};   // clase → variante elegida
      function select(slug){
        const cls = classOf(list, slug) || list[0];
        const variant = slugsOf(cls).includes(slug) ? slug : (current[cls.slug] || slugsOf(cls)[0]);
        current[cls.slug] = variant;
        if (tabs) tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.slug === cls.slug));
        const vs = cls.variants || [];
        variantsBar.hidden = vs.length < 2;
        variantsBar.replaceChildren(...vs.map(v => makeButton(v.label, v.slug, v.slug === variant)));
        show(container, variant);
      }
      roots.push({ el: root, select });

      if (tabs) {
        tabs.hidden = list.length < 2;
        tabs.replaceChildren(...list.map((c, i) => makeButton(c.label || c.slug, c.slug, i === 0)));
        tabs.addEventListener("click", e => { const b = e.target.closest("[data-slug]"); if (b) select(b.dataset.slug); });
      }
      variantsBar.addEventListener("click", e => { const b = e.target.closest("[data-slug]"); if (b) select(b.dataset.slug); });
      select(list[0].slug);

      successHandlers.push(data => {
        if (!data.uid || !data.startTime) return;
        const bookings = readBookings();
        if (!bookings.some(b => b.uid === data.uid)) {
          bookings.push({ uid: data.uid, title: data.title, startTime: data.startTime, endTime: data.endTime });
          bookings.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
          saveBookings(bookings);
        }
        const confirm = root.querySelector("[data-cal-confirm]");
        if (confirm) {
          const d = confirm.querySelector("[data-cal-confirm-date]");
          const t = confirm.querySelector("[data-cal-confirm-text]");
          if (d) d.textContent = fmtDate(data.startTime);
          if (t) t.textContent = `${data.title || "Tu clase"} está confirmada. Te enviamos los detalles por correo. Llega 10 minutos antes.`;
          confirm.hidden = false;
        }
        renderMine(root);
      });
      failHandlers.push(() => { if (fallback) fallback.hidden = false; });
      return true;
    },

    /* Elige una clase (o una variante) en una sección ya montada.
       target: la sección, un elemento que la contenga o un selector
       (p. ej. "#reservas"). */
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

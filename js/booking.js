/* ==========================================================
   Reservas con Cal.com (calendario en la página)
   Usuario y clases se configuran en site.config.js → booking.
   Uso:
     <div data-cal-tabs></div>      pestañas por clase (opcional)
     <div data-cal-inline></div>    donde va el calendario
     TNBooking.mount()              los llena
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
  const mounted = {};          // slug → true cuando ya se insertó su calendario
  let loaderReady = false;

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

  // Un namespace por clase, como en el código de Cal.com
  const nsName = slug => "tn_" + slug.replace(/[^a-z0-9]/gi, "_");

  function mountInline(container, cls){
    loadLoader();
    const ns = nsName(cls.slug);
    const el = document.createElement("div");
    el.className = "cal-frame";
    el.id = "cal-inline-" + ns;
    el.dataset.slug = cls.slug;
    container.appendChild(el);

    Cal("init", ns, { origin });
    Cal.ns[ns]("inline", {
      elementOrSelector: "#" + el.id,
      calLink: `${username}/${cls.slug}`,
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", theme: "dark" }
    });
    Cal.ns[ns]("ui", UI);
    Cal.ns[ns]("on", { action: "bookingSuccessfulV2", callback: e => successHandlers.forEach(fn => fn(e.detail.data || {}, cls)) });
    Cal.ns[ns]("on", { action: "linkFailed", callback: e => failHandlers.forEach(fn => fn(e.detail.data || {}, cls)) });
    mounted[cls.slug] = el;
    return el;
  }

  function show(container, slug){
    const cls = classes.find(c => c.slug === slug) || classes[0];
    if (!cls) return;
    Object.values(mounted).forEach(el => { el.hidden = el.dataset.slug !== cls.slug; });
    if (!mounted[cls.slug]) mountInline(container, cls);
    const loading = container.querySelector(".cal-loading");
    if (loading) loading.remove();
  }

  window.TNBooking = {
    configured,
    classes,
    origin,

    /* Llena [data-cal-tabs] y [data-cal-inline] dentro de root */
    mount(root = document){
      const container = root.querySelector("[data-cal-inline]");
      const tabs = root.querySelector("[data-cal-tabs]");
      if (!container || !configured) return false;

      if (tabs) {
        tabs.hidden = classes.length < 2;
        tabs.replaceChildren(...classes.map((c, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = c.label || c.slug;
          b.dataset.slug = c.slug;
          b.setAttribute("aria-pressed", i === 0);
          return b;
        }));
        tabs.addEventListener("click", e => {
          const b = e.target.closest("[data-slug]");
          if (!b) return;
          tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
          show(container, b.dataset.slug);
        });
      }
      show(container, classes[0].slug);
      return true;
    },

    onSuccess(fn){ successHandlers.push(fn); },
    onFail(fn){ failHandlers.push(fn); },

    // Página de Cal.com donde la persona puede cancelar o cambiar su reserva
    manageUrl(uid){ return `${origin}/booking/${encodeURIComponent(uid)}`; }
  };
})();

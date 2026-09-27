/* ==========================================================
   Tatami Norte · Reservas con Cal.com
   Carga el embed de Cal.com y expone window.TNBooking para que
   cualquier página abra la reserva de una clase.
   El usuario de Cal.com se configura en site.config.js → booking.
   Aquí solo van los slugs de cada clase (ver CAL-SETUP.md).
   ========================================================== */
(function(){
  const site = (window.SITE_CONFIG && window.SITE_CONFIG.booking) || {};
  const CAL_CONFIG = {
    username: site.calUsername || "",
    origin: site.calOrigin || "https://app.cal.com",
    // Un tipo de evento por clase. La clave es la que usa el horario del sitio,
    // el valor es el slug del tipo de evento en Cal.com.
    events: {
      bjj:  "jiu-jitsu-gi",
      nogi: "jiu-jitsu-no-gi",
      mt:   "muay-thai",
      box:  "boxeo",
      mma:  "mma",
      kids: "kids-jiu-jitsu",
      fund: "fundamentos-bjj",
      open: "open-mat"
    }
  };

  const configured = CAL_CONFIG.username.trim() !== "";
  let loaded = false;
  const successHandlers = [];
  const failHandlers = [];

  function load(){
    if (loaded || !configured) return;
    loaded = true;
    // Cargador oficial de Cal.com
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, CAL_CONFIG.origin + "/embed/embed.js", "init");

    Cal("init", { origin: CAL_CONFIG.origin });

    // Colores de la marca dentro de la ventana de Cal.com
    Cal("ui", {
      theme: "dark",
      hideEventTypeDetails: false,
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
    });

    Cal("on", {
      action: "bookingSuccessfulV2",
      callback: e => successHandlers.forEach(fn => fn(e.detail.data || {}))
    });
    Cal("on", {
      action: "linkFailed",
      callback: e => failHandlers.forEach(fn => fn(e.detail.data || {}))
    });
  }

  // Fecha (YYYY-MM-DD) de la próxima vez que cae ese día de la semana.
  // weekday: 0 = domingo … 6 = sábado. Si es hoy y la hora ya pasó, salta a la semana siguiente.
  function nextDate(weekday, time){
    const now = new Date();
    const d = new Date(now);
    let add = (weekday - now.getDay() + 7) % 7;
    if (add === 0 && time) {
      const [h, m] = time.split(":").map(Number);
      if (now.getHours() * 60 + now.getMinutes() >= h * 60 + m) add = 7;
    }
    d.setDate(now.getDate() + add);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  window.TNBooking = {
    configured,
    origin: CAL_CONFIG.origin,

    /* Abre la reserva de una clase.
       opts: { kind, weekday, time, name, email, notes } */
    open(opts){
      const slug = CAL_CONFIG.events[opts.kind];
      if (!configured || !slug) return false;
      load();
      const date = opts.weekday != null ? nextDate(opts.weekday, opts.time) : null;
      const config = { layout: "month_view", theme: "dark" };
      if (opts.name) config.name = opts.name;
      if (opts.email) config.email = opts.email;
      if (opts.notes) config.notes = opts.notes;
      if (date) { config.date = date; config.month = date.slice(0, 7); }
      Cal("modal", { calLink: `${CAL_CONFIG.username}/${slug}`, config });
      return true;
    },

    onSuccess(fn){ successHandlers.push(fn); },
    onFail(fn){ failHandlers.push(fn); },

    // Página de Cal.com donde la persona puede cancelar o cambiar su reserva
    manageUrl(uid){ return `${CAL_CONFIG.origin}/booking/${encodeURIComponent(uid)}`; }
  };

  // Precarga el embed cuando el navegador está libre, para que la ventana abra rápido.
  if (configured) {
    (window.requestIdleCallback || (fn => setTimeout(fn, 1500)))(load);
  }
})();

/* ==========================================================
   CONFIGURACIÓN DEL SITIO
   Todos los datos propios de la academia viven aquí.
   Cambia un valor y se actualiza en todas las páginas.

   Deja un valor vacío ("") para ocultarlo en el sitio.
   Todo lo de este archivo es público: no pongas contraseñas
   ni llaves secretas (esas van en Vercel → Settings →
   Environment Variables).
   ========================================================== */
window.SITE_CONFIG = {

  /* ---- Identidad ---- */
  name: "Escuela de Artes Marciales Kizuna",
  shortName: "Kizuna",                           // nombre corto para el menú
  initial: "K",                                  // letra del logo en el menú
  motto: "Respeto · Disciplina · Constancia",
  description: "Escuela de Artes Marciales Kizuna en Santiago: BJJ Gi, BJJ No-Gi, Judo y preparación física. Reserva tu clase en línea.",

  /* ---- Contacto ----
     Los canales principales son Instagram y WhatsApp: el sitio invita
     a escribir por mensaje directo de Instagram (ig.me). */
  contact: {
    phone: "+56 9 4796 6805",
    whatsapp: "56947966805",                     // solo dígitos con código de país
    instagram: "clubkizuna",                     // sin @
    facebook: "",
    tiktok: ""
  },

  /* ---- Ubicación ---- */
  address: {
    line: "Av. Portugal 412, Oficina 605",
    city: "Santiago, RM",
    note: "",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Av.+Portugal+412,+Santiago,+Chile"
  },

  /* ---- Horario (pie de página) ---- */
  hours: [
    "Revisa el calendario de reservas",
    "Consultas por Instagram o WhatsApp"
  ],

  /* ---- Cifras de la portada ---- */
  stats: [
    { value: "4",     label: "disciplinas" },
    { value: "44 m²", label: "de tatami" }
  ],

  /* ---- Moneda de los planes ---- */
  currency: {
    code: "CLP",
    symbol: "$",
    locale: "es-CL"
  },

  /* ---- Precios mensuales de los planes ----
     Número sin puntos (ej. 45000). null = muestra "Consultar". */
  prices: {
    base: null,
    ilim: null,
    comp: null
  },
  annualDiscount: 0.2,                           // descuento del pago anual (0.2 = 20%)

  /* ---- Fotos de Instagram en la portada (Behold) ----
     1. Entra a behold.so, conecta la cuenta de Instagram y crea un
        feed de tipo "JSON".
     2. Pega aquí su URL (https://feeds.behold.so/...).
     Sin URL, la sección muestra solo el botón para seguir la cuenta. */
  instagramFeed: {
    url: "https://feeds.behold.so/LXNWcDXcHb0Zzx0wsqWb",
    count: 6                                     // el plan gratuito entrega hasta 6
  },

  /* ---- Horario semanal · ver HORARIO.md ----
     Se arma solo con la disponibilidad de Cal.com: mira las próximas
     semanas y muestra qué clases hay cada día a cada hora.
     Para cambiar el horario, cámbialo en Cal.com. */
  schedule: {
    source: "cal",                               // "cal" o "json" (archivo en url)
    weeks: 2,                                    // semanas que se revisan en Cal.com
    url: "data/horario.json"                     // solo si source es "json"
  },

  /* ---- Clases y reservas (Cal.com) · ver CAL-SETUP.md ----
     Una pestaña por clase. slug = la parte final de la URL en Cal.com
     (cal.com/hccombat/judo → "judo").
     tone: color en el horario (oro, bronce, marino, acero, linea).
     page: página de la disciplina ("" si no tiene).
     variants: varios eventos de Cal.com que en el sitio son una sola clase
     (en reservas aparece un selector de duración). */
  booking: {
    requireAccount: true,                        // solo deportistas con cuenta pueden reservar (ver DEPORTISTAS.md)
    calUsername: "hccombat",                     // cal.com/<usuario>
    calOrigin: "https://app.cal.com",
    classes: [
      { label: "BJJ Gi",    slug: "jiu-jitsu-gi",   tone: "bronce", page: "bjj.html" },
      { label: "BJJ No-Gi", slug: "jiujitsu-no-gi", tone: "marino", page: "bjj.html#no-gi" },
      { label: "Judo",      slug: "judo",           tone: "oro",    page: "judo.html",
        variants: [
          { label: "1 hora",       slug: "judo" },
          { label: "1 hora 15 min", slug: "judo2" }
        ] },
      { label: "Físico",    slug: "fisico",         tone: "acero",  page: "" },
      { label: "Sala libre / Randoris", slug: "sala-libre-randoris", tone: "linea", page: "" }
    ]
  },

  /* ---- Cuentas de deportistas · ver DEPORTISTAS.md ----
     Disciplinas que cada deportista puede marcar en su perfil. */
  athletes: {
    disciplines: ["BJJ Gi", "BJJ No-Gi", "Judo", "Físico"],
    payRequiresAccount: true                     // "Suscribirme" pide cuenta: el pago queda a nombre del deportista
  },

  /* ---- Firebase (blog y planes editables desde admin.html) · ver ADMIN.md ----
     Estos datos son públicos por diseño: la seguridad la dan las
     reglas de Firestore (firestore.rules), no esta llave. */
  firebase: {
    apiKey: "AIzaSyB-BPwnUte7q5hTJJKU64IyirbbFOZXHVw",
    authDomain: "kizuna-admin-25951.firebaseapp.com",
    projectId: "kizuna-admin-25951",
    storageBucket: "kizuna-admin-25951.firebasestorage.app",
    messagingSenderId: "872289691724",
    appId: "1:872289691724:web:dbaf2de87bd7ecd373ece9"
  }
};

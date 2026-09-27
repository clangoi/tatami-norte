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
  name: "Club de Deportes de Combate Kizuna",
  shortName: "Kizuna",                           // nombre corto para el menú
  initial: "K",                                  // letra del logo en el menú
  motto: "Respeto · Disciplina · Constancia",
  description: "Club de Deportes de Combate Kizuna en Santiago: BJJ Gi, BJJ No-Gi, Judo y preparación física. Reserva tu clase en línea.",

  /* ---- Contacto ---- */
  contact: {
    email: "contacto@hccombat.com",
    phone: "+56 9 4796 6805",
    whatsapp: "56947966805",                     // solo dígitos con código de país
    instagram: "hc.combat",                      // sin @
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
    "Clases según el calendario de reservas",
    "Consultas por correo o WhatsApp"
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
    url: "https://feeds.behold.so/28TiHXcDICsBycxHv8Ke",
    count: 6                                     // el plan gratuito entrega hasta 6
  },

  /* ---- Reservas (Cal.com) · ver CAL-SETUP.md ---- */
  booking: {
    calUsername: "hccombat",                     // cal.com/<usuario>
    calOrigin: "https://app.cal.com",
    // Una pestaña por clase. slug = la parte final de la URL en Cal.com
    // (cal.com/hccombat/judo → "judo"). Agrega una línea por cada clase nueva.
    classes: [
      { label: "BJJ Gi",               slug: "jiu-jitsu-gi" },
      { label: "BJJ No-Gi",            slug: "jiujitsu-no-gi" },
      { label: "Judo",                 slug: "judo" },
      { label: "Físico",               slug: "fisico" },
      { label: "Sala libre / Randoris", slug: "sala-libre-randoris" }
    ]
  }
};

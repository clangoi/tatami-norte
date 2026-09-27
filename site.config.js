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
  name: "Tatami Norte",
  initial: "T",                                  // letra del logo en el menú
  motto: "Respeto · Disciplina · Constancia",
  description: "Academia de Jiu-Jitsu, Muay Thai, Boxeo y MMA. Agenda tu primera clase gratis, elige tu plan y lee el blog del dojo.",

  /* ---- Contacto ---- */
  contact: {
    email: "hola@tataminorte.mx",
    phone: "+52 55 4821 0930",
    whatsapp: "525548210930",                    // solo dígitos con código de país
    instagram: "tataminorte",                    // sin @
    facebook: "",
    tiktok: ""
  },

  /* ---- Ubicación ---- */
  address: {
    line: "Av. Constitución 1480, Col. Centro",
    city: "",
    note: "Estacionamiento para miembros.",
    mapsUrl: ""                                  // enlace de Google Maps
  },

  /* ---- Horario de recepción ---- */
  hours: [
    "Lun a Vie · 6:00–22:00",
    "Sábado · 8:00–14:00",
    "Domingo · Open mat 10:00"
  ],

  /* ---- Cifras de la portada ---- */
  stats: [
    { value: "42",     label: "clases por semana" },
    { value: "6",      label: "profesores cinturón negro" },
    { value: "380 m²", label: "de tatami" }
  ],

  /* ---- Moneda de los planes ---- */
  currency: {
    code: "USD",
    symbol: "$",
    locale: "es-MX"
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

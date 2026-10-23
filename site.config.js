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
  siteUrl: "https://www.hccombat.com",           // dirección del sitio (enlaces en los mensajes de WhatsApp)
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
     Se arma solo con las clases y horarios que defines en admin.html → Clases:
     muestra la semana en curso y aclara los días que ya pasaron. */
  schedule: {
    source: "own",                               // "own" (clases del panel) o "json" (archivo en url)
    url: "data/horario.json"                     // solo si source es "json"
  },

  /* ---- Clases y reservas ----
     Las clases, los horarios y los cupos se administran en admin.html → Clases
     (ver RESERVAS.md). Aquí solo van los ajustes generales y las clases de siempre,
     que el panel puede cargar con un botón.
     Cada clase es disciplina + tipo (opcional) + club; su nombre sale solo: «[disciplina] [tipo] · [Club]».
     tone: color de la disciplina (oro, bronce, cobre, marino, acero, plata, crema).
     clubTone: color de la franja lateral del club. El diseño del bloque lo da el tipo.
     page: página de la disciplina ("" si no tiene). */
  /* ---- Funciones en pausa ----
     medicalRecord: ficha médica del deportista (Mi perfil y panel de admin). Pendiente de la asesoría legal
     sobre datos de salud: déjala en false hasta tenerla. Ver DEPORTISTAS.md.
     athleteRanks: tarjeta «Mis grados» en el panel del deportista. En pausa (false): el equipo puede seguir
     asignando grados en admin, pero el deportista no los ve todavía. */
  features: {
    medicalRecord: false,
    athleteRanks: false
  },

  booking: {
    timeZone: "America/Santiago",                // hora de las clases
    defaultCapacity: 15,                         // cupos si la clase o el horario no definen otro
    classes: [
      { discipline: "BJJ",   type: "Gi",       club: "Kizuna", slug: "jiu-jitsu-gi",        tone: "bronce", clubTone: "marino", page: "bjj.html" },
      { discipline: "BJJ",   type: "Gi",       club: "Núcleo", slug: "bjj-gi-nucleo",       tone: "bronce", clubTone: "cobre",  page: "bjj.html" },
      { discipline: "BJJ",   type: "No-Gi",    club: "Núcleo", slug: "jiujitsu-no-gi",      tone: "bronce", clubTone: "cobre",  page: "bjj.html#no-gi" },
      { discipline: "Judo",                    club: "Kizuna", slug: "judo",                tone: "oro",    clubTone: "marino", page: "judo.html" },
      { discipline: "Judo",  type: "No-Gi",    club: "Kizuna", slug: "judo-no-gi",          tone: "oro",    clubTone: "marino", page: "judo.html" },
      { discipline: "Judo",  type: "Kids",     club: "Kizuna", slug: "judo-kids",           tone: "oro",    clubTone: "marino", page: "judo.html" },
      { discipline: "Físico",                  club: "Kizuna", slug: "fisico",              tone: "acero",  clubTone: "marino", page: "" },
      { discipline: "Judo",  type: "Randoris", club: "Kizuna", slug: "sala-libre-randoris", tone: "oro",    clubTone: "marino", page: "" }
    ]
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

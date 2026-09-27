/* ==========================================================
   Índice del blog
   Una línea por artículo. Cada artículo es una página en
   blog/<slug>.html (copia blog/_plantilla.html). Ver BLOG.md.

   slug    nombre del archivo, sin .html (solo minúsculas y guiones)
   title   título
   cat     categoría (se usa para los filtros)
   letter  2 o 3 letras grandes de la portada
   date    fecha de publicación AAAA-MM-DD
   read    minutos de lectura
   ex      resumen de una o dos líneas
   ========================================================== */
window.BLOG_POSTS = [
  {
    slug: "primera-clase-jiu-jitsu",
    title: "Cómo sobrevivir tu primera clase de Jiu-Jitsu",
    cat: "Principiantes", letter: "BJJ", date: "2026-09-22", read: 6,
    ex: "Qué llevar, qué esperar en la rodada y por qué nadie espera que sepas nada el primer día."
  },
  {
    slug: "ukemi-judo-caidas",
    title: "Ukemi: en Judo primero aprendes a caer",
    cat: "Técnica", letter: "JU", date: "2026-09-15", read: 6,
    ex: "Las cuatro caídas básicas y por qué te protegen dentro y fuera del tatami."
  },
  {
    slug: "cortar-peso-sin-perder-potencia",
    title: "Cortar peso sin perder potencia",
    cat: "Nutrición", letter: "KG", date: "2026-09-08", read: 7,
    ex: "La diferencia entre bajar de categoría y deshidratarte. Un calendario de 8 semanas que sí funciona."
  },
  {
    slug: "tu-cinturon-importa-menos",
    title: "Tu cinturón importa menos de lo que crees",
    cat: "Mentalidad", letter: "OSS", date: "2026-09-01", read: 5,
    ex: "Por qué medir tu progreso en rounds entrenados y no en grados te hace mejor deportista."
  },
  {
    slug: "ejercicios-de-agarre-grappling",
    title: "Tres ejercicios de agarre para grappling",
    cat: "Físico", letter: "FX", date: "2026-08-18", read: 5,
    ex: "Si se te cansan los antebrazos a mitad del randori, empieza por aquí."
  }
];

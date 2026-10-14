// Previsualización del sitio. Sirve los archivos y también /api con clases de ejemplo en memoria
// (el mismo servidor de dev.js), para que el horario y las reservas se vean en local.
// Uso: node .claude/serve.js   (puerto 5173)
process.env.PORT = process.env.PORT || "5173";
require("./dev.js");

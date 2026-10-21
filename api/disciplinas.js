/* ==========================================================
   Kizuna · Disciplinas del menú
   GET /api/disciplinas  →  { disciplines: [{ name, page }] }
   Las disciplinas creadas en el panel (Clases → Configuración), cada una con
   su primera página ("" si no tiene). Si todavía no hay configuración guardada,
   salen de las clases activas. Solo nombres y páginas: nada privado.
   ========================================================== */
const { handler } = require("./_lib/http");
const { getDb } = require("./_lib/firebase");

const norm = s => String(s || "").trim().toLowerCase();
const pagesOf = o => (Array.isArray(o.pages) ? o.pages : o.page ? [o.page] : []);
const isPage = p => /^[A-Za-z0-9_\-\/.]+(#[A-Za-z0-9_-]+)?$/.test(p);

module.exports = handler(["GET"], async (req, res) => {
  const db = getDb();
  const saved = await db.collection("settings").doc("catalog").get();
  let list = saved.exists && Array.isArray(saved.data().disciplines)
    ? saved.data().disciplines.map(d => ({ name: d.name, page: pagesOf(d)[0] || "" }))
    : [];

  if (!list.length) {
    const classes = await db.collection("classes").get();
    const seen = new Set();
    classes.docs.map(d => d.data()).filter(c => c.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach(c => {
        const name = c.discipline || String(c.label || "").split(" · ")[0];
        if (!name || seen.has(norm(name))) return;
        seen.add(norm(name));
        list.push({ name, page: pagesOf(c)[0] || "" });
      });
  }

  const disciplines = list
    .filter(d => String(d.name || "").trim())
    .map(d => ({ name: String(d.name).trim().slice(0, 40), page: isPage(d.page) ? d.page : "" }));

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.status(200).json({ disciplines });
});

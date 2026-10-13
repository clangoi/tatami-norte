/* ==========================================================
   Kizuna · Blog
   Arma tarjetas de artículos con los datos de Firestore (js/content.js).

   <div data-blog-list data-base="">          todas, con filtros en [data-blog-filters]
   <div data-blog-latest="3" data-base="">    las 3 más recientes
   <div data-blog-related="3" data-base="../" data-current="slug">
                                              otras 3, sin la actual

   data-base: ruta hasta la raíz del sitio ("" en la raíz,
   "../" dentro de blog/).

   Los artículos se escriben en admin.html y llegan desde Firestore
   (js/content.js) con TNBlog.add(lista).

   <select data-blog-sort> en la página del listado elige el orden:
   new (más recientes), old (más antiguos), az y za (por título).
   ========================================================== */
(function(){
  let all = [];
  const setPosts = list => { all = list.slice().sort((a, b) => b.date.localeCompare(a.date)); };
  setPosts([]);
  const locale = window.SITE_CONFIG?.currency?.locale || "es-CL";

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  // Patrón de portada estable para cada artículo
  const pattern = slug => [...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 4;

  const href = (p, base) => `${base}blog/articulo.html?p=${encodeURIComponent(p.slug)}`;

  const SORTS = {
    new: (a, b) => b.date.localeCompare(a.date),
    old: (a, b) => a.date.localeCompare(b.date),
    az:  (a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }),
    za:  (a, b) => b.title.localeCompare(a.title, "es", { sensitivity: "base" })
  };

  function card(p, base, lead){
    return `<a class="post${lead ? " lead" : ""}" href="${href(p, base)}">
      <div class="cover"><div class="pat pat-${p.pattern ?? pattern(p.slug)}"></div><span class="big" aria-hidden="true">${esc(p.letter)}</span><span class="cat">${esc(p.cat)}</span></div>
      <span class="meta">${fmtDate(p.date)} · ${p.read} min de lectura</span>
      <h3>${esc(p.title)}</h3><p class="ex">${esc(p.ex)}</p>
    </a>`;
  }

  const renders = [];

  // Listado completo con filtros
  document.querySelectorAll("[data-blog-list]").forEach(el => {
    const base = el.dataset.base || "";
    const filters = document.querySelector("[data-blog-filters]");
    const sortSel = document.querySelector("[data-blog-sort]");
    let cur = "Todo";
    const render = () => {
      const cats = ["Todo", ...new Set(all.map(p => p.cat).filter(Boolean))].sort((a, b) => a === "Todo" ? -1 : b === "Todo" ? 1 : a.localeCompare(b, "es"));
      if (!cats.includes(cur)) cur = "Todo";
      const sort = sortSel?.value || "new";
      const list = all.filter(p => cur === "Todo" || p.cat === cur).sort(SORTS[sort] || SORTS.new);
      el.innerHTML = list.map((p, i) => card(p, base, sort === "new" && i === 0 && list.length > 2)).join("") ||
        '<p class="empty">Todavía no hay artículos en esta categoría.</p>';
      if (filters) filters.innerHTML = cats.map(c => `<button type="button" aria-pressed="${c === cur}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    };
    if (filters) filters.addEventListener("click", e => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      cur = b.dataset.cat;
      render();
    });
    if (sortSel) sortSel.addEventListener("change", render);
    renders.push(render);
  });

  // Últimos N (portada)
  document.querySelectorAll("[data-blog-latest]").forEach(el => {
    const n = +el.dataset.blogLatest || 3;
    renders.push(() => {
      el.innerHTML = all.slice(0, n).map(p => card(p, el.dataset.base || "", false)).join("");
    });
  });

  // Relacionados (al final de un artículo): primero la misma categoría
  document.querySelectorAll("[data-blog-related]").forEach(el => {
    const n = +el.dataset.blogRelated || 3;
    renders.push(() => {
      const current = all.find(p => p.slug === el.dataset.current);
      const others = all.filter(p => p.slug !== el.dataset.current);
      const same = current ? others.filter(p => p.cat === current.cat) : [];
      const list = [...same, ...others.filter(p => !same.includes(p))].slice(0, n);
      el.innerHTML = list.map(p => card(p, el.dataset.base || "", false)).join("");
      const wrap = el.closest("[data-blog-related-section]");
      if (wrap) wrap.hidden = !list.length;
    });
  });

  const renderAll = () => renders.forEach(r => r());
  renderAll();

  window.TNBlog = {
    // Suma artículos (p. ej. los de Firestore) y vuelve a dibujar.
    add(list){
      const taken = new Set(all.map(p => p.slug));
      setPosts([...all, ...list.filter(p => !taken.has(p.slug))]);
      renderAll();
    },
    // Cambia el artículo actual de "Sigue leyendo" (blog/articulo.html)
    setCurrent(slug){
      document.querySelectorAll("[data-blog-related]").forEach(el => { el.dataset.current = slug; });
      renderAll();
    }
  };
})();

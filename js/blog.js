/* ==========================================================
   Kizuna · Blog
   Arma tarjetas de artículos a partir de js/posts.js.

   <div data-blog-list data-base="">          todas, con filtros en [data-blog-filters]
   <div data-blog-latest="3" data-base="">    las 3 más recientes
   <div data-blog-related="3" data-base="../" data-current="slug">
                                              otras 3, sin la actual

   data-base: ruta hasta la raíz del sitio ("" en la raíz,
   "../" dentro de blog/).
   ========================================================== */
(function(){
  const all = (window.BLOG_POSTS || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const locale = window.SITE_CONFIG?.currency?.locale || "es-CL";

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  // Patrón de portada estable para cada artículo
  const pattern = slug => [...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 4;

  function card(p, base, lead){
    return `<a class="post${lead ? " lead" : ""}" href="${base}blog/${esc(p.slug)}.html">
      <div class="cover"><div class="pat pat-${pattern(p.slug)}"></div><span class="big" aria-hidden="true">${esc(p.letter)}</span><span class="cat">${esc(p.cat)}</span></div>
      <span class="meta">${fmtDate(p.date)} · ${p.read} min de lectura</span>
      <h3>${esc(p.title)}</h3><p class="ex">${esc(p.ex)}</p>
    </a>`;
  }

  // Listado completo con filtros
  document.querySelectorAll("[data-blog-list]").forEach(el => {
    const base = el.dataset.base || "";
    const filters = document.querySelector("[data-blog-filters]");
    const cats = ["Todo", ...new Set(all.map(p => p.cat))];
    let cur = "Todo";
    const render = () => {
      const list = all.filter(p => cur === "Todo" || p.cat === cur);
      el.innerHTML = list.map((p, i) => card(p, base, i === 0 && list.length > 2)).join("") ||
        '<p class="empty">Todavía no hay artículos en esta categoría.</p>';
      if (filters) filters.innerHTML = cats.map(c => `<button type="button" aria-pressed="${c === cur}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    };
    if (filters) filters.addEventListener("click", e => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      cur = b.dataset.cat;
      render();
    });
    render();
  });

  // Últimos N (portada)
  document.querySelectorAll("[data-blog-latest]").forEach(el => {
    const n = +el.dataset.blogLatest || 3;
    el.innerHTML = all.slice(0, n).map(p => card(p, el.dataset.base || "", false)).join("");
  });

  // Relacionados (al final de un artículo): primero la misma categoría
  document.querySelectorAll("[data-blog-related]").forEach(el => {
    const n = +el.dataset.blogRelated || 3;
    const current = all.find(p => p.slug === el.dataset.current);
    const others = all.filter(p => p.slug !== el.dataset.current);
    const same = current ? others.filter(p => p.cat === current.cat) : [];
    const list = [...same, ...others.filter(p => !same.includes(p))].slice(0, n);
    el.innerHTML = list.map(p => card(p, el.dataset.base || "", false)).join("");
    const wrap = el.closest("[data-blog-related-section]");
    if (wrap && !list.length) wrap.hidden = true;
  });
})();

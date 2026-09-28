/* ==========================================================
   Kizuna · Datos del sitio
   Lee site.config.js y llena la página. Marca los elementos así:

   data-site="contact.phone"        → escribe el valor como texto
   data-site-href="whatsapp"        → arma el enlace (phone,
                                      whatsapp, instagram, instagramDm,
                                      facebook, tiktok, maps)
   data-site-list="hours"           → una <li> por elemento
   data-site-stats                  → cifras de la portada
   <title data-site-title="Blog">   → "Blog · <nombre>"
   <meta name="description" data-site-meta>

   Si un valor está vacío, el elemento se oculta (y su <li>, si lo tiene).
   Expone window.SITE para usar los datos desde otros scripts.
   ========================================================== */
(function(){
  const C = window.SITE_CONFIG || {};

  function get(path){
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), C);
  }

  const computed = { year: String(new Date().getFullYear()) };
  const value = path => (path in computed ? computed[path] : get(path));

  const links = {
    phone:     () => C.contact?.phone && `tel:${C.contact.phone.replace(/[^\d+]/g, "")}`,
    whatsapp:  () => C.contact?.whatsapp && `https://wa.me/${C.contact.whatsapp}`,
    instagram: () => C.contact?.instagram && `https://instagram.com/${C.contact.instagram}`,
    instagramDm: () => C.contact?.instagram && `https://ig.me/m/${C.contact.instagram}`,   // mensaje directo
    facebook:  () => C.contact?.facebook && `https://facebook.com/${C.contact.facebook}`,
    tiktok:    () => C.contact?.tiktok && `https://tiktok.com/@${C.contact.tiktok}`,
    maps:      () => C.address?.mapsUrl
  };

  function hide(el){
    const li = el.closest("li");
    (li || el).hidden = true;
  }

  function apply(root = document){
    root.querySelectorAll("[data-site]").forEach(el => {
      const v = value(el.dataset.site);
      if (v == null || v === "") hide(el); else el.textContent = v;
    });

    root.querySelectorAll("[data-site-href]").forEach(el => {
      const make = links[el.dataset.siteHref];
      const url = make && make();
      if (!url) { hide(el); return; }
      el.href = url;
      if (/^https?:/.test(url)) { el.target = "_blank"; el.rel = "noopener"; }
    });

    root.querySelectorAll("[data-site-list]").forEach(el => {
      const list = get(el.dataset.siteList) || [];
      el.replaceChildren(...list.map(t => Object.assign(document.createElement("li"), { textContent: t })));
    });

    root.querySelectorAll("[data-site-stats]").forEach(el => {
      el.replaceChildren(...(C.stats || []).map(s => {
        const d = document.createElement("div");
        const b = document.createElement("b");
        b.textContent = s.value;
        d.append(b, s.label);
        return d;
      }));
    });
  }

  // Título y descripción
  if (C.name) {
    const t = document.querySelector("title");
    const page = t && t.dataset.siteTitle;
    document.title = page ? `${page} · ${C.name}` : C.name;
  }
  const meta = document.querySelector('meta[name="description"][data-site-meta]');
  if (meta && C.description) meta.content = C.description;

  const cur = C.currency || {};
  window.SITE = {
    config: C,
    get,
    apply,
    // Precio con la moneda configurada: SITE.money(79) → "$79"
    money: n => `${cur.symbol || "$"}${Number(n).toLocaleString(cur.locale || "es-MX")}`,
    currency: cur.code || ""
  };

  apply();

  // Menú móvil (igual en todas las páginas)
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  if (menuBtn && navLinks) {
    const close = () => { navLinks.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); };
    menuBtn.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    navLinks.addEventListener("click", e => { if (e.target.closest("a")) close(); });
  }
})();

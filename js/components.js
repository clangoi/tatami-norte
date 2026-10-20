/* ==========================================================
   Kizuna · Componentes compartidos (menú y pie de página)
   Se cargan en el <head> de cada página, antes que el <body>:

     <script src="js/components.js"></script>        (raíz)
     <script src="../js/components.js"></script>     (blog/)

   Y se usan así:

     <site-nav current="judo" cta="#horario"></site-nav>
     <site-footer></site-footer>

   current: inicio | judo | bjj | blog  → marca el enlace activo.
            En "inicio" los enlaces son anclas de la misma página.
   Bajo «Disciplinas» van las disciplinas creadas en el panel (Clases → Configuración),
   que llegan de /api/disciplinas; cada una lleva a su página (o a la sección Disciplinas
   de la portada si no tiene). La última lista se guarda en el navegador para que el menú
   no cambie al cargar.
   cta:     destino del botón "Clase gratis" (por defecto, las
            reservas de la portada).

   Los textos con data-site los completa js/site.js con los datos
   de site.config.js. Cambia el menú o el pie solo aquí.
   ========================================================== */
(function(){
  // Raíz del sitio a partir de la ubicación de este archivo (…/js/components.js)
  const root = new URL("../", document.currentScript.src).href;

  const paths = page => {
    const home = page === "inicio" ? "" : root;
    return {
      home: page === "inicio" ? "#inicio" : root,
      sec: id => `${home}#${id}`,
      page: file => root + file
    };
  };

  const CACHE_KEY = "tn_disciplinas";
  const FALLBACK = [{ name: "Judo", page: "judo.html" }, { name: "BJJ", page: "bjj.html" }];
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const readCache = () => { try { const l = JSON.parse(localStorage.getItem(CACHE_KEY)); return Array.isArray(l) && l.length ? l : null; } catch (e) { return null; } };
  const here = location.pathname.split("/").pop().replace(/.html$/, "");

  // Enlaces de las disciplinas; la de la página abierta queda marcada
  function disciplineLinks(list, p){
    return list.map(d => {
      const file = String(d.page || "").split("#")[0];
      const href = file ? p.page(d.page) : p.sec("disciplinas");
      const current = file && file.replace(/.html$/, "") === here ? ' aria-current="page"' : "";
      return `<a href="${esc(href)}"${current}>${esc(d.name)}</a>`;
    }).join("");
  }

  class SiteNav extends HTMLElement {
    connectedCallback(){
      const cur = this.getAttribute("current") || "";
      const p = paths(cur);
      const cta = this.getAttribute("cta") || p.sec("horario");
      const mark = name => (cur === name ? ' aria-current="page"' : "");   // blog

      const nav = document.createElement("nav");
      nav.className = "nav";
      nav.setAttribute("aria-label", "Principal");
      nav.innerHTML = `
  <div class="wrap">
    <a class="brand" href="${p.home}"><span class="brand-mark" data-site="initial">K</span><span class="brand-name" data-site="shortName">Kizuna</span></a>
    <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="navLinks">Menú</button>
    <div class="nav-links" id="navLinks">
      <div class="nav-group">
        <a class="nav-parent" href="${p.sec("disciplinas")}">Disciplinas</a>
        <div class="nav-sub" data-nav-disciplines>${disciplineLinks(readCache() || FALLBACK, p)}</div>
      </div>
      <a href="${p.sec("horario")}">Horario</a>
      <a href="${p.sec("planes")}">Planes</a>
      <a href="${p.page("blog.html")}"${mark("blog")}>Blog</a>
      <a class="btn small" href="${cta}">Clase gratis</a>
    </div>
  </div>`;
      this.replaceWith(nav);

      // Las disciplinas del panel reemplazan a las guardadas
      fetch(new URL("api/disciplinas", root)).then(r => (r.ok ? r.json() : Promise.reject())).then(data => {
        const list = (data.disciplines || []).filter(d => d && d.name);
        if (!list.length) return;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (e) {}
        const box = nav.querySelector("[data-nav-disciplines]");
        if (box) box.innerHTML = disciplineLinks(list, p);
      }).catch(() => {});
    }
  }

  class SiteFooter extends HTMLElement {
    connectedCallback(){
      const p = paths(this.getAttribute("current") || "");

      const footer = document.createElement("footer");
      footer.innerHTML = `
  <div class="wrap foot">
    <div>
      <div class="foot-big">Nos vemos<br>en el tatami.</div>
      <p><span data-site="address.line">Av. Portugal 412, Oficina 605</span>, <span data-site="address.city">Santiago, RM</span></p>
      <p data-site="address.note"></p>
      <p><a data-site-href="maps" href="#">Cómo llegar</a></p>
    </div>
    <div><h4>Horario</h4><ul data-site-list="hours"><li>Revisa el calendario de reservas</li><li>Consultas por Instagram o WhatsApp</li></ul></div>
    <div><h4>Contacto</h4><ul><li><a data-site-href="instagram" href="#">@<span data-site="contact.instagram">clubkizuna</span></a></li><li><a data-site-href="whatsapp" href="#">WhatsApp</a></li><li><a data-site-href="phone" data-site="contact.phone" href="#">+56 9 4796 6805</a></li><li><a data-site-href="facebook" href="#">Facebook</a></li><li><a data-site-href="tiktok" href="#">TikTok</a></li></ul></div>
    <div><h4>Explora</h4><ul><li><a href="${p.page("judo.html")}">Judo</a></li><li><a href="${p.page("bjj.html")}">BJJ</a></li><li><a href="${p.sec("horario")}">Agendar clase</a></li><li><a href="${p.sec("planes")}">Planes</a></li><li><a href="${p.page("blog.html")}">Blog</a></li></ul></div>
  </div>
  <div class="wrap foot-base"><span>© <span data-site="year">2026</span> <span data-site="name">Escuela de Artes Marciales Kizuna</span></span><span data-site="motto">Respeto · Disciplina · Constancia</span></div>`;
      this.replaceWith(footer);
    }
  }

  customElements.define("site-nav", SiteNav);
  customElements.define("site-footer", SiteFooter);
})();

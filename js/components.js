/* ==========================================================
   Kizuna · Componentes compartidos (menú y pie de página)
   Se cargan en el <head> de cada página, antes que el <body>:

     <script src="js/components.js"></script>        (raíz)
     <script src="../js/components.js"></script>     (blog/)

   Y se usan así:

     <site-nav current="judo" cta="#reservar"></site-nav>
     <site-footer></site-footer>

   current: inicio | judo | bjj | blog  → marca el enlace activo.
            En "inicio" los enlaces son anclas de la misma página.
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

  class SiteNav extends HTMLElement {
    connectedCallback(){
      const cur = this.getAttribute("current") || "";
      const p = paths(cur);
      const cta = this.getAttribute("cta") || p.sec("reservas");
      const mark = name => (cur === name ? ' aria-current="page"' : "");

      const nav = document.createElement("nav");
      nav.className = "nav";
      nav.setAttribute("aria-label", "Principal");
      nav.innerHTML = `
  <div class="wrap">
    <a class="brand" href="${p.home}"><span class="brand-mark" data-site="initial">K</span><span class="brand-name" data-site="shortName">Kizuna</span></a>
    <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="navLinks">Menú</button>
    <div class="nav-links" id="navLinks">
      <a href="${p.sec("disciplinas")}">Disciplinas</a>
      <a href="${p.page("judo.html")}"${mark("judo")}>Judo</a>
      <a href="${p.page("bjj.html")}"${mark("bjj")}>BJJ</a>
      <a href="${p.sec("horario")}">Horario</a>
      <a href="${p.sec("planes")}">Planes</a>
      <a href="${p.page("blog.html")}"${mark("blog")}>Blog</a>
      <a class="btn small" href="${cta}">Clase gratis</a>
    </div>
  </div>`;
      this.replaceWith(nav);
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
    <div><h4>Explora</h4><ul><li><a href="${p.page("judo.html")}">Judo</a></li><li><a href="${p.page("bjj.html")}">BJJ</a></li><li><a href="${p.sec("reservas")}">Agendar clase</a></li><li><a href="${p.sec("planes")}">Planes</a></li><li><a href="${p.page("blog.html")}">Blog</a></li></ul></div>
  </div>
  <div class="wrap foot-base"><span>© <span data-site="year">2026</span> <span data-site="name">Escuela de Artes Marciales Kizuna</span></span><span data-site="motto">Respeto · Disciplina · Constancia</span></div>`;
      this.replaceWith(footer);
    }
  }

  customElements.define("site-nav", SiteNav);
  customElements.define("site-footer", SiteFooter);
})();

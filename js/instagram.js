/* ==========================================================
   Kizuna · Fotos de Instagram (feed JSON de Behold)
   Llena [data-ig-grid] con las últimas publicaciones.
   Configuración: site.config.js → instagramFeed.
   Si no hay URL o el feed falla, la grilla se oculta y queda
   visible el botón para seguir la cuenta.
   ========================================================== */
(function(){
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.instagramFeed) || {};
  const handle = window.SITE_CONFIG?.contact?.instagram || "";
  const grid = document.querySelector("[data-ig-grid]");
  if (!grid) return;

  const url = (cfg.url || "").trim();
  const count = cfg.count || 6;
  if (!url) { grid.hidden = true; return; }

  // Mosaicos de carga mientras llega el feed
  grid.innerHTML = Array.from({ length: count }, () => '<div class="ig-tile ig-skel" aria-hidden="true"></div>').join("");

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const short = (s, n) => { s = (s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };

  function imageOf(p){
    const s = p.sizes || {};
    return (s.medium && s.medium.mediaUrl) || (s.large && s.large.mediaUrl) ||
           p.thumbnailUrl || (p.mediaType !== "VIDEO" ? p.mediaUrl : "");
  }
  function badge(p){
    if (p.mediaType === "VIDEO") return '<span class="ig-badge">' + (p.isReel ? "Reel" : "Video") + "</span>";
    if (p.mediaType === "CAROUSEL_ALBUM") return '<span class="ig-badge">Álbum</span>';
    return "";
  }

  fetch(url)
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      const posts = (Array.isArray(data) ? data : data.posts || []).filter(imageOf).slice(0, count);
      if (!posts.length) throw new Error("Feed vacío");
      grid.innerHTML = posts.map(p => {
        const text = short(p.prunedCaption || p.caption, 110);
        const alt = short(p.altText || p.prunedCaption || `Publicación de @${handle}`, 140);
        return `<a class="ig-tile" href="${esc(p.permalink)}" target="_blank" rel="noopener">
          <img src="${esc(imageOf(p))}" alt="${esc(alt)}" loading="lazy" decoding="async">
          ${badge(p)}
          ${text ? `<span class="ig-caption">${esc(text)}</span>` : ""}
        </a>`;
      }).join("");
    })
    .catch(() => { grid.hidden = true; });
})();

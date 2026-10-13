/* ==========================================================
   Kizuna · Markdown
   Convierte el texto de un artículo escrito en el panel al
   mismo HTML que usan las páginas de blog/. Todo se escapa
   antes, así que nunca pasa HTML crudo.

   ## Subtítulo            → <h2>
   ### Subtítulo menor     → <h3>
   **negrita**  *cursiva*  [texto](https://enlace)
   - lista / 1. lista numerada
   > cita destacada
   ![descripción](/assets/images/foto.png "pie")   imagen (varias seguidas = galería)
   @[título](ID_YOUTUBE?start=21&end=57 "pie")     video de YouTube
   Línea en blanco = párrafo nuevo. El primero sale más grande.
   ========================================================== */
const esc = s => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// Solo enlaces http(s), mailto, anclas y rutas del mismo sitio
const safeUrl = u => /^(https?:\/\/|mailto:|#|\/|\.\.?\/|[\w-]+\.html)/i.test(u) ? u : "#";

function inline(text){
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const url = safeUrl(u.replace(/&amp;/g, "&"));
      const ext = /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${esc(url)}"${ext}>${t}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
}

// ![descripción](/ruta/foto.png "pie")  ·  @[título](ID_YOUTUBE?start=21&end=57 "pie")
const IMG = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/;
const VIDEO = /^@\[([^\]]*)\]\(([\w-]{11})(?:\?((?:(?:start|end)=\d+&?)*))?(?:\s+"([^"]*)")?\)$/;
// Solo https o rutas del mismo sitio (no "//otro-sitio")
const safeImg = u => /^(https:\/\/|\/(?!\/))/i.test(u);

function figure(m){
  const [, alt, src, cap] = m;
  return `<figure><img src="${esc(src)}" loading="lazy" decoding="async" alt="${esc(alt)}">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
}

function video(m){
  const [, title, id, query = "", cap] = m;
  const q = query.replace(/&$/, "").replace(/&/g, "&amp;");
  return `<figure class="post-video"><div class="frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?${q ? q + "&amp;" : ""}rel=0&amp;playsinline=1" title="${esc(title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
}

export function toHtml(src){
  const blocks = String(src || "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  let lede = false;
  return blocks.map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    const first = lines[0];
    let m;
    const imgs = lines.map(l => l.match(IMG));
    if (imgs.every(i => i && safeImg(i[2])))
      return `<div class="post-gallery${imgs.length === 1 ? " one" : ""}">${imgs.map(figure).join("")}</div>`;
    if (lines.length === 1 && (m = first.match(VIDEO))) return video(m);
    if ((m = first.match(/^(#{2,3})\s+(.*)$/)) && lines.length === 1)
      return `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
    if (lines.every(l => /^[-*]\s+/.test(l)))
      return `<ul>${lines.map(l => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    if (lines.every(l => /^\d+[.)]\s+/.test(l)))
      return `<ol>${lines.map(l => `<li>${inline(l.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
    if (lines.every(l => l.startsWith(">")))
      return `<blockquote>${inline(lines.map(l => l.replace(/^>\s?/, "")).join(" "))}</blockquote>`;
    const cls = lede ? "" : ' class="lede"';
    lede = true;
    return `<p${cls}>${lines.map(inline).join("<br>")}</p>`;
  }).join("\n");
}

// Minutos de lectura aproximados (200 palabras por minuto)
export const readingMinutes = src => Math.max(1, Math.round(String(src || "").split(/\s+/).filter(Boolean).length / 200));

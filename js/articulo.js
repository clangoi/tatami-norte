/* ==========================================================
   Kizuna · Artículo del panel (blog/articulo.html?p=<slug>)
   Lee el artículo de Firestore y llena la página con el mismo
   diseño de los artículos escritos a mano.
   ========================================================== */
import { db, fs, publishedPosts } from "./firebase.js";
import { toHtml } from "./markdown.js";

const $ = s => document.querySelector(`[data-a="${s}"]`);
const slug = new URLSearchParams(location.search).get("p") || "";
const locale = window.SITE_CONFIG?.currency?.locale || "es-CL";
const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
const pattern = s => [...s].reduce((n, c) => n + c.charCodeAt(0), 0) % 4;

function notFound(offline){
  document.title = `Artículo no encontrado · ${window.SITE_CONFIG?.name || ""}`;
  $("title").textContent = offline ? "No se pudo cargar" : "Artículo no encontrado";
  $("body").innerHTML = offline
    ? '<p class="lede">No pudimos cargar este artículo. Revisa tu conexión y recarga la página.</p><p><a href="../blog.html">Volver al blog</a></p>'
    : '<p class="lede">Este artículo no existe o ya no está publicado.</p><p><a href="../blog.html">Volver al blog</a></p>';
  document.head.append(Object.assign(document.createElement("meta"), { name: "robots", content: "noindex" }));
}

function setMeta(sel, value){
  const m = document.querySelector(sel);
  if (m) m.content = value;
}

async function load(){
  if (!/^[a-z0-9-]+$/.test(slug)) return notFound();
  let snap;
  try {
    // Sin respuesta en 12 s (sin conexión o Firebase caído) se avisa
    const timeout = new Promise((_, no) => setTimeout(() => no(Object.assign(new Error("timeout"), { code: "timeout" })), 12000));
    snap = await Promise.race([fs.getDoc(fs.doc(db, "posts", slug)), timeout]);
  } catch (err) {
    // Las reglas niegan la lectura de borradores: se trata como no encontrado
    console.warn(err);
    return notFound(err.code !== "permission-denied");
  }
  if (!snap.exists() || !snap.data().published) return notFound();

  const p = snap.data();
  const site = window.SITE_CONFIG?.name || "";
  document.title = `${p.title} · ${site}`;
  setMeta('meta[name="description"]', p.ex || "");
  setMeta('meta[property="og:title"]', p.title);
  setMeta('meta[property="og:description"]', p.ex || "");

  $("pat").className = `pat pat-${p.pattern ?? pattern(slug)}`;
  $("letter").textContent = p.letter || "";
  $("cat").textContent = p.cat || "";
  $("cat").hidden = !p.cat;
  $("title").textContent = p.title;
  $("date").dateTime = p.date;
  $("date").textContent = fmtDate(p.date);
  $("read").textContent = `${p.read || 1} min de lectura`;
  $("meta").hidden = false;
  $("body").innerHTML = toHtml(p.body);

  // "Sigue leyendo": suma los demás artículos del panel
  if (window.TNBlog) {
    window.TNBlog.setCurrent(slug);
    publishedPosts().then(list => window.TNBlog.add(list)).catch(() => {});
  }
}

load();

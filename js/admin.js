/* ==========================================================
   Kizuna · Panel de administración (admin.html)
   Inicio de sesión con Firebase Auth y edición de:
   posts/{slug}  artículos del blog (texto en Markdown, js/markdown.js)
   topics/{id}   temas (categorías) con los que se filtran y ordenan
   plans/{id}    planes de suscripción
   Quién puede entrar lo deciden admins/{uid} y firestore.rules.
   ========================================================== */
import { SDK, app, db, fs, cacheImage, hydrateImages } from "./firebase.js";
import { toHtml, readingMinutes } from "./markdown.js";
import { SEED_POSTS } from "./seed-posts.js";

const {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} = await import(`${SDK}/firebase-auth.js`);

const auth = getAuth(app);
auth.languageCode = "es";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = window.SITE;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const locale = S.config.currency?.locale || "es-CL";
const fmtDate = iso => iso ? new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "";
const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD en hora local
const catsOf = p => Array.isArray(p.cats) ? p.cats : (p.cat ? [p.cat] : []);
const collate = (a, b) => String(a).localeCompare(String(b), "es", { sensitivity: "base" });
const slugify = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const pattern = s => [...s].reduce((n, c) => n + c.charCodeAt(0), 0) % 4;

function toast(msg){
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2800);
}

// Mensajes de Firebase en español
function authError(e){
  const map = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/invalid-email": "Revisa el correo.",
    "auth/missing-password": "Escribe tu contraseña.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet."
  };
  return map[e.code] || "No se pudo entrar. Intenta otra vez.";
}
function saveError(e){
  if (e.code === "permission-denied") return "Firebase rechazó el cambio. Revisa que tu cuenta esté en admins y que las reglas estén publicadas.";
  if (e.code === "unavailable") return "Sin conexión con Firebase. Revisa tu internet.";
  return "No se pudo guardar: " + (e.message || e.code);
}

/* ---------- Vistas ---------- */
const views = ["vLoading", "vLogin", "vDenied", "vApp"];
const show = id => views.forEach(v => $("#" + v).hidden = v !== id);

let dirty = false;
window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
const confirmLeave = () => !dirty || confirm("Tienes cambios sin guardar. ¿Descartarlos?");

/* ---------- Sesión ---------- */
onAuthStateChanged(auth, async user => {
  $("#logout").hidden = !user;
  $("#who").hidden = !user;
  if (!user) { show("vLogin"); return; }
  $("#who").textContent = user.email;

  let isAdmin = false;
  try {
    isAdmin = (await fs.getDoc(fs.doc(db, "admins", user.uid))).exists();
  } catch (e) { console.warn(e); }

  if (!isAdmin) {
    $("#uid").textContent = user.uid;
    show("vDenied");
    return;
  }
  show("vApp");
  loadPosts();
  loadPlans();
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  $("#lErr").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#lEmail").value.trim(), $("#lPass").value);
    $("#lPass").value = "";
  } catch (err) {
    $("#lErr").textContent = authError(err);
  } finally { btn.disabled = false; }
});

$("#forgot").addEventListener("click", async () => {
  const email = $("#lEmail").value.trim();
  if (!email) { $("#lErr").textContent = "Escribe tu correo arriba y vuelve a presionar."; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    $("#lErr").textContent = "";
    toast("Te enviamos un correo para cambiarla");
  } catch (err) { $("#lErr").textContent = authError(err); }
});

const logout = () => { if (confirmLeave()) { dirty = false; signOut(auth); } };
$("#logout").addEventListener("click", logout);
$$("[data-logout]").forEach(b => b.addEventListener("click", logout));

$("#copyUid").addEventListener("click", () => {
  navigator.clipboard?.writeText($("#uid").textContent).then(() => toast("UID copiado"));
});

/* ---------- Pestañas ---------- */
$$("[data-tab]").forEach(b => b.addEventListener("click", () => {
  if (!confirmLeave()) return;
  closePost(); closePlan();
  $$("[data-tab]").forEach(x => x.setAttribute("aria-pressed", x === b));
  $$("[data-view]").forEach(v => v.hidden = v.dataset.view !== b.dataset.tab);
}));

/* ==========================================================
   Blog
   ========================================================== */
let posts = [];
let topics = []; // { id, name }
let editingSlug = null; // null = artículo nuevo

const SORTS = {
  new:   (x, y) => (y.date || "").localeCompare(x.date || ""),
  old:   (x, y) => (x.date || "").localeCompare(y.date || ""),
  az:    (x, y) => collate(x.title, y.title),
  za:    (x, y) => collate(y.title, x.title),
  topic: (x, y) => collate(catsOf(x)[0] || "\uffff", catsOf(y)[0] || "\uffff") || collate(x.title, y.title)
};

async function loadPosts(){
  $("#posts").innerHTML = '<p class="adm-loading">Cargando artículos…</p>';
  try {
    const [pSnap, tSnap] = await Promise.all([fs.getDocs(fs.collection(db, "posts")), fs.getDocs(fs.collection(db, "topics"))]);
    posts = pSnap.docs.map(d => ({ ...d.data(), slug: d.id }));
    topics = tSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
    await adoptTopics();
    renderTopics();
    renderPosts();
  } catch (e) {
    console.warn(e);
    $("#posts").innerHTML = `<p class="err">${esc(saveError(e))}</p>`;
  }
}

// Los temas que ya usan los artículos y aún no están en la lista se guardan solos
async function adoptTopics(){
  const known = new Set(topics.map(t => t.name.toLowerCase()));
  const missing = [...new Set(posts.flatMap(catsOf))].filter(c => !known.has(c.toLowerCase()));
  if (!missing.length) return;
  const batch = fs.writeBatch(db);
  missing.forEach(name => batch.set(fs.doc(db, "topics", slugify(name) || "tema"), { name, createdAt: fs.serverTimestamp() }));
  await batch.commit();
  missing.forEach(name => topics.push({ id: slugify(name) || "tema", name }));
}

const sortedTopics = () => topics.slice().sort((x, y) => collate(x.name, y.name));

function renderPosts(){
  // Filtro de tema
  const filter = $("#postFilter");
  const cur = filter.value;
  filter.innerHTML = '<option value="">Todos</option>' + sortedTopics().map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("");
  filter.value = topics.some(t => t.name === cur) ? cur : "";

  if (!posts.length) {
    $("#posts").innerHTML = `<div class="notice adm-seed">
      <p><strong>Aún no hay artículos en el panel.</strong> Puedes cargar los cuatro que traía el sitio para editarlos o borrarlos como cualquier otro.</p>
      <button class="btn small" type="button" id="seedPosts">Cargar los artículos de siempre</button>
    </div>`;
    return;
  }
  const list = posts.filter(p => !filter.value || catsOf(p).includes(filter.value)).sort(SORTS[$("#postSort").value] || SORTS.new);
  if (!list.length) { $("#posts").innerHTML = '<p class="adm-empty">No hay artículos con ese tema.</p>'; return; }
  $("#posts").innerHTML = list.map(p => {
    const status = p.published ? '<span class="adm-tag on">Publicado</span>' : '<span class="adm-tag">Borrador</span>';
    return `<div class="adm-row">
      <div class="adm-row-main">
        <b>${esc(p.title)}</b>
        <span>${esc(catsOf(p).join(" · ") || "Sin tema")} · ${fmtDate(p.date)}</span>
      </div>
      ${status}
      <div class="adm-row-actions">
        ${p.published ? `<a class="btn small ghost" href="blog/articulo.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver</a>` : ""}
        <button class="btn small ghost" type="button" data-edit="${esc(p.slug)}">Editar</button>
        <button class="btn small ghost adm-danger" type="button" data-del="${esc(p.slug)}">Borrar</button>
      </div>
    </div>`;
  }).join("");
}

$("#postFilter").addEventListener("change", renderPosts);
$("#postSort").addEventListener("change", renderPosts);

async function seedPosts(btn){
  btn.disabled = true;
  const batch = fs.writeBatch(db);
  const cats = new Set();
  SEED_POSTS.forEach(({ slug, ...p }) => {
    cats.add(p.cat);
    batch.set(fs.doc(db, "posts", slug), { ...p, cats: [p.cat], read: readingMinutes(p.body), published: true, updatedAt: fs.serverTimestamp() });
  });
  topics.forEach(t => cats.delete(t.name));
  cats.forEach(name => batch.set(fs.doc(db, "topics", slugify(name)), { name, createdAt: fs.serverTimestamp() }));
  try {
    await batch.commit();
    await loadPosts();
    toast("Artículos cargados");
  } catch (err) { alert(saveError(err)); btn.disabled = false; }
}

$("#posts").addEventListener("click", async e => {
  if (e.target.closest("#seedPosts")) return seedPosts(e.target.closest("#seedPosts"));
  const ed = e.target.closest("[data-edit]");
  if (ed) { openPost(posts.find(p => p.slug === ed.dataset.edit)); return; }
  const del = e.target.closest("[data-del]");
  if (del) {
    const p = posts.find(x => x.slug === del.dataset.del);
    if (!confirm(`¿Borrar “${p.title}”? No se puede deshacer.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, "posts", p.slug));
      // Sus fotos ya no sirven; si falla el borrado quedan huérfanas, sin afectar nada
      imageIds(p.body).forEach(id => fs.deleteDoc(fs.doc(db, "images", id)).catch(() => {}));
      posts = posts.filter(x => x !== p);
      renderPosts();
      renderTopics();
      toast("Artículo borrado");
    } catch (err) { alert(saveError(err)); }
  }
});

$("#newPost").addEventListener("click", () => openPost(null));

const F = {
  title: $("#fTitle"), slug: $("#fSlug"), ex: $("#fEx"), cats: $("#fCats"), date: $("#fDate"),
  letter: $("#fLetter"), pat: $("#fPat"), body: $("#fBody"), published: $("#fPublished")
};
let slugTouched = false;

// Casillas de temas; `selected` es la lista de nombres marcados
function fillTopicChecks(selected){
  const names = sortedTopics().map(t => t.name);
  selected.forEach(n => { if (!names.includes(n)) names.push(n); });
  F.cats.innerHTML = names.length
    ? names.map(n => `<label class="check"><input type="checkbox" value="${esc(n)}"${selected.includes(n) ? " checked" : ""}> ${esc(n)}</label>`).join("")
    : '<p class="adm-help">Todavía no hay temas. Crea el primero con “Nuevo tema”.</p>';
}
const selectedTopics = () => [...F.cats.querySelectorAll("input:checked")].map(i => i.value);

function openPost(p){
  editingSlug = p ? p.slug : null;
  slugTouched = !!p;
  $("#postFormTitle").textContent = p ? "Editar artículo" : "Nuevo artículo";
  F.title.value = p?.title || "";
  F.slug.value = p?.slug || "";
  F.slug.readOnly = !!p;
  F.ex.value = p?.ex || "";
  fillTopicChecks(p ? catsOf(p) : []);
  F.date.value = p?.date || today();
  F.letter.value = p?.letter || "";
  F.pat.value = String(p?.pattern ?? 0);
  F.body.value = p?.body || "";
  F.published.checked = p ? !!p.published : false;
  $("#postErr").textContent = "";
  $("#postList").hidden = true;
  $("#topicsPanel").hidden = true;
  $("#blogSubnav").hidden = true;
  $("#postForm").hidden = false;
  dirty = false;
  previewPost();
  window.scrollTo({ top: 0 });
  F.title.focus();
}

// Artículos / Temas: dos vistas dentro de la sección Blog
function showSub(name){
  $$("[data-sub]").forEach(x => x.setAttribute("aria-pressed", x.dataset.sub === name));
  $("#postList").hidden = name !== "articles";
  $("#topicsPanel").hidden = name !== "topics";
}
$("#blogSubnav").addEventListener("click", e => {
  const b = e.target.closest("[data-sub]");
  if (b) showSub(b.dataset.sub);
});

function closePost(){
  $("#postForm").hidden = true;
  $("#blogSubnav").hidden = false;
  showSub("articles");
  dirty = false;
}

$("#postForm [data-cancel]").addEventListener("click", () => { if (confirmLeave()) closePost(); });

F.slug.addEventListener("input", () => { slugTouched = true; });
F.title.addEventListener("input", () => {
  if (!slugTouched && !editingSlug) F.slug.value = slugify(F.title.value);
});
$("#postForm").addEventListener("input", () => { dirty = true; previewPost(); });

function previewPost(){
  const slug = F.slug.value || "articulo";
  const letter = F.letter.value || F.title.value.slice(0, 2);
  $("#pvCard").innerHTML = `
    <div class="cover"><div class="pat pat-${F.pat.value}"></div><span class="big" aria-hidden="true">${esc(letter)}</span>${selectedTopics().length ? `<span class="cat">${esc(selectedTopics().join(" · "))}</span>` : ""}</div>
    <span class="meta">${fmtDate(F.date.value)} · ${readingMinutes(F.body.value)} min de lectura</span>
    <h3>${esc(F.title.value || "Título del artículo")}</h3><p class="ex">${esc(F.ex.value)}</p>`;
  $("#pvTitle").textContent = F.title.value;
  $("#pvBody").innerHTML = toHtml(F.body.value) || '<p class="adm-empty">El texto aparecerá aquí.</p>';
  hydrateImages($("#pvBody"));
  $("#readInfo").textContent = `${readingMinutes(F.body.value)} min de lectura`;
}

/* ---------- Imágenes ---------- */
const imageIds = body => [...String(body || "").matchAll(/\(img:([\w-]{8,40})[\s)]/g)].map(m => m[1]);
const newImageId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(n => (n % 36).toString(36)).join("");

// Reduce la foto a 1200 px como máximo y la deja bajo ~700 KB para que quepa en Firestore
async function compressImage(file){
  const bmp = await createImageBitmap(file);
  let scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  for (let tries = 0; tries < 6; tries++) {
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    for (const q of [0.82, 0.68, 0.55]) {
      let url = canvas.toDataURL("image/webp", q);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", q); // navegador sin WebP
      if (url.length <= 700000) { bmp.close?.(); return url; }
    }
    scale *= 0.75;
  }
  bmp.close?.();
  throw new Error("La imagen es demasiado pesada incluso reducida. Prueba con otra.");
}

$("#fImage").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const err = $("#postErr");
  if (!file.type.startsWith("image/")) { err.textContent = "Elige un archivo de imagen (JPG, PNG o WebP)."; return; }
  err.textContent = "";
  const btn = $('[data-md="image"]'); btn.disabled = true; btn.textContent = "Subiendo…";
  try {
    const data = await compressImage(file);
    const id = newImageId();
    await fs.setDoc(fs.doc(db, "images", id), { data, createdAt: fs.serverTimestamp() });
    cacheImage(id, data);
    const t = F.body, s = t.selectionStart;
    const alt = "descripción";
    const lead = s && !/\n\n$/.test(t.value.slice(0, s)) ? "\n\n" : "";
    const text = `${lead}![${alt}](img:${id})\n\n`;
    t.setRangeText(text, s, t.selectionEnd);
    const from = s + lead.length + 2;
    t.focus(); t.setSelectionRange(from, from + alt.length);
    dirty = true; previewPost();
    toast("Imagen subida");
  } catch (e2) {
    err.textContent = e2.code ? saveError(e2) : (e2.message || "No se pudo subir la imagen.");
  } finally { btn.disabled = false; btn.textContent = "Imagen"; }
});

// Barra de formato: envuelve la selección o inserta al inicio de la línea
$(".adm-tools").addEventListener("click", e => {
  const b = e.target.closest("[data-md]"); if (!b) return;
  if (b.dataset.md === "image") { $("#fImage").click(); return; }
  const t = F.body, s = t.selectionStart, en = t.selectionEnd;
  const sel = t.value.slice(s, en);
  const lineStart = t.value.lastIndexOf("\n", s - 1) + 1;
  let text, from, to;
  const wrap = (a, z, ph) => { text = a + (sel || ph) + z; from = s + a.length; to = from + (sel || ph).length; t.setRangeText(text, s, en); };
  const prefix = p => { t.setRangeText(p, lineStart, lineStart); from = s + p.length; to = en + p.length; };
  switch (b.dataset.md) {
    case "bold":   wrap("**", "**", "negrita"); break;
    case "italic": wrap("*", "*", "cursiva"); break;
    case "link":   wrap("[", "](https://)", "texto del enlace"); break;
    case "h2":     prefix("## "); break;
    case "ul":     prefix("- "); break;
    case "quote":  prefix("> "); break;
  }
  t.focus(); t.setSelectionRange(from, to);
  dirty = true; previewPost();
});

$("#postForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#postErr");
  const slug = F.slug.value.trim();
  const title = F.title.value.trim();
  if (!title) { err.textContent = "Falta el título."; F.title.focus(); return; }
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) { err.textContent = "La dirección solo puede tener minúsculas, números y guiones."; F.slug.focus(); return; }
  if (!F.date.value) { err.textContent = "Falta la fecha."; F.date.focus(); return; }
  if (!editingSlug && posts.some(p => p.slug === slug)) {
    err.textContent = "Ya existe un artículo con esa dirección. Cambia la dirección."; F.slug.focus(); return;
  }
  if (F.published.checked && !F.body.value.trim()) { err.textContent = "No se puede publicar un artículo sin texto."; F.body.focus(); return; }

  const data = {
    title,
    ex: F.ex.value.trim(),
    cats: selectedTopics(),
    cat: selectedTopics()[0] || "",
    date: F.date.value,
    letter: (F.letter.value.trim() || title.slice(0, 2)).toUpperCase(),
    pattern: +F.pat.value,
    body: F.body.value,
    read: readingMinutes(F.body.value),
    published: F.published.checked,
    updatedAt: fs.serverTimestamp()
  };
  const btn = e.submitter; btn.disabled = true; err.textContent = "";
  try {
    await fs.setDoc(fs.doc(db, "posts", slug), data);
    const local = { ...data, slug, updatedAt: null };
    posts = [...posts.filter(p => p.slug !== slug), local];
    closePost();
    renderPosts();
    renderTopics();
    toast(data.published ? "Artículo publicado" : "Borrador guardado");
  } catch (e2) {
    err.textContent = saveError(e2);
  } finally { btn.disabled = false; }
});

/* ==========================================================
   Temas
   ========================================================== */
// Crea el tema si no existe. Devuelve su nombre o lanza Error con un mensaje para mostrar.
async function addTopic(raw){
  const name = raw.trim().replace(/\s+/g, " ");
  const id = slugify(name);
  if (!name || !id) throw new Error("Escribe el nombre del tema.");
  if (name.length > 30) throw new Error("Máximo 30 letras.");
  const dup = topics.find(t => t.name.toLowerCase() === name.toLowerCase() || t.id === id);
  if (dup) throw new Error(`Ya existe el tema “${dup.name}”.`);
  await fs.setDoc(fs.doc(db, "topics", id), { name, createdAt: fs.serverTimestamp() });
  topics.push({ id, name });
  renderTopics();
  return name;
}

function renderTopics(){
  if (!topics.length) { $("#topicsRows").innerHTML = '<p class="adm-empty">Todavía no hay temas. Agrega el primero arriba.</p>'; return; }
  $("#topicsRows").innerHTML = sortedTopics().map(t => {
    const n = posts.filter(p => catsOf(p).includes(t.name)).length;
    return `<div class="adm-row">
      <div class="adm-row-main"><b>${esc(t.name)}</b><span>${n} ${n === 1 ? "artículo" : "artículos"}</span></div>
      <span></span>
      <div class="adm-row-actions">
        <button class="btn small ghost" type="button" data-trename="${esc(t.id)}">Renombrar</button>
        <button class="btn small ghost adm-danger" type="button" data-tdel="${esc(t.id)}">Borrar</button>
      </div>
    </div>`;
  }).join("");
}

$("#topicForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#topicErr"); err.textContent = "";
  const btn = e.submitter; btn.disabled = true;
  try {
    await addTopic($("#topicName").value);
    $("#topicName").value = "";
    toast("Tema agregado");
  } catch (e2) { err.textContent = e2.code ? saveError(e2) : e2.message; }
  finally { btn.disabled = false; }
});

$("#newTopicInline").addEventListener("click", async () => {
  const raw = prompt("Nombre del nuevo tema:");
  if (raw === null) return;
  try {
    const name = await addTopic(raw);
    fillTopicChecks([...selectedTopics(), name]);
    dirty = true; previewPost();
    toast("Tema agregado");
  } catch (e2) { alert(e2.code ? saveError(e2) : e2.message); }
});

$("#topicsRows").addEventListener("click", async e => {
  const ren = e.target.closest("[data-trename]");
  if (ren) {
    const t = topics.find(x => x.id === ren.dataset.trename);
    const raw = prompt("Nuevo nombre del tema:", t.name);
    if (raw === null) return;
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name || name === t.name) return;
    if (name.length > 30) { alert("Máximo 30 letras."); return; }
    if (topics.some(x => x !== t && x.name.toLowerCase() === name.toLowerCase())) { alert("Ya existe un tema con ese nombre."); return; }
    const affected = posts.filter(p => catsOf(p).includes(t.name));
    const renamed = p => catsOf(p).map(c => c === t.name ? name : c);
    const batch = fs.writeBatch(db);
    batch.update(fs.doc(db, "topics", t.id), { name });
    affected.forEach(p => batch.update(fs.doc(db, "posts", p.slug), { cats: renamed(p), cat: renamed(p)[0] || "" }));
    try {
      await batch.commit();
      affected.forEach(p => { p.cats = renamed(p); p.cat = p.cats[0] || ""; });
      t.name = name;
      renderTopics(); renderPosts();
      toast("Tema renombrado");
    } catch (err) { alert(saveError(err)); }
    return;
  }
  const del = e.target.closest("[data-tdel]");
  if (del) {
    const t = topics.find(x => x.id === del.dataset.tdel);
    const n = posts.filter(p => catsOf(p).includes(t.name)).length;
    if (n) { alert(`“${t.name}” tiene ${n} ${n === 1 ? "artículo" : "artículos"}. Cámbialos de tema (o bórralos) antes de borrar el tema.`); return; }
    if (!confirm(`¿Borrar el tema “${t.name}”?`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, "topics", t.id));
      topics = topics.filter(x => x !== t);
      renderTopics(); renderPosts();
      toast("Tema borrado");
    } catch (err) { alert(saveError(err)); }
  }
});

/* ==========================================================
   Planes
   ========================================================== */
let plans = [];
let editingPlan = null; // null = plan nuevo
$$("[data-currency]").forEach(el => el.textContent = S.currency || "");

// Los tres planes que traía el sitio, para empezar rápido
const DEFAULT_PLANS = [
  { id: "base", name: "Base", for: "Para empezar con una disciplina y crear el hábito.", feats: ["1 disciplina a elegir", "2 clases por semana", "Evaluación de cinturón semestral"] },
  { id: "ilim", name: "Ilimitado", for: "Entrena todo lo que quieras, en todas las disciplinas.", featured: true, feats: ["Todas las disciplinas", "Clases ilimitadas", "Sala libre / Randoris", "Físico incluido"] },
  { id: "comp", name: "Competidor", for: "Para quien prepara torneos o peleas amateur.", feats: ["Todo lo del plan Ilimitado", "4 clases privadas al mes", "Plan de fuerza y acondicionamiento", "Esquina en torneos y corte de peso guiado"] }
];

async function loadPlans(){
  $("#plansRows").innerHTML = '<p class="adm-loading">Cargando planes…</p>';
  try {
    const snap = await fs.getDocs(fs.collection(db, "plans"));
    plans = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderPlans();
  } catch (e) {
    console.warn(e);
    $("#plansRows").innerHTML = `<p class="err">${esc(saveError(e))}</p>`;
  }
}

const priceText = p => (typeof p.price === "number" && p.price > 0) ? `${S.money(p.price)} ${S.currency} / mes` : "Consultar";

function renderPlans(){
  if (!plans.length) {
    $("#plansRows").innerHTML = `<div class="notice adm-seed">
      <p><strong>Aún no hay planes en el panel.</strong> Mientras tanto el sitio muestra los tres de siempre (Base, Ilimitado y Competidor).</p>
      <button class="btn small" type="button" id="seedPlans">Cargar esos tres para editarlos</button>
    </div>`;
    return;
  }
  $("#plansRows").innerHTML = plans.map((p, i) => `
    <div class="adm-row">
      <div class="adm-order">
        <button type="button" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir ${esc(p.name)}">↑</button>
        <button type="button" data-down="${i}" ${i === plans.length - 1 ? "disabled" : ""} aria-label="Bajar ${esc(p.name)}">↓</button>
      </div>
      <div class="adm-row-main">
        <b>${esc(p.name)}${p.featured ? ' <span class="adm-star">Más elegido</span>' : ""}</b>
        <span>${esc(priceText(p))} · ${(p.feats || []).length} beneficios</span>
      </div>
      ${p.visible ? '<span class="adm-tag on">Visible</span>' : '<span class="adm-tag">Oculto</span>'}
      <div class="adm-row-actions">
        <button class="btn small ghost" type="button" data-pedit="${esc(p.id)}">Editar</button>
        <button class="btn small ghost adm-danger" type="button" data-pdel="${esc(p.id)}">Borrar</button>
      </div>
    </div>`).join("");
}

$("#plansRows").addEventListener("click", async e => {
  if (e.target.closest("#seedPlans")) return seedPlans(e.target.closest("#seedPlans"));
  const ed = e.target.closest("[data-pedit]");
  if (ed) return openPlan(plans.find(p => p.id === ed.dataset.pedit));
  const del = e.target.closest("[data-pdel]");
  if (del) {
    const p = plans.find(x => x.id === del.dataset.pdel);
    if (!confirm(`¿Borrar el plan “${p.name}”? Si solo quieres sacarlo del sitio, edítalo y desmarca “Visible”.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, "plans", p.id));
      plans = plans.filter(x => x !== p);
      renderPlans();
      toast("Plan borrado");
    } catch (err) { alert(saveError(err)); }
    return;
  }
  const up = e.target.closest("[data-up]"), down = e.target.closest("[data-down]");
  if (up || down) {
    const i = +(up ? up.dataset.up : down.dataset.down), j = up ? i - 1 : i + 1;
    const next = plans.slice();
    [next[i], next[j]] = [next[j], next[i]];
    const batch = fs.writeBatch(db);
    next.forEach((p, k) => { if (p.order !== k) batch.update(fs.doc(db, "plans", p.id), { order: k }); });
    try {
      await batch.commit();
      next.forEach((p, k) => p.order = k);
      plans = next;
      renderPlans();
    } catch (err) { alert(saveError(err)); }
  }
});

async function seedPlans(btn){
  btn.disabled = true;
  const prices = S.config.prices || {};
  const batch = fs.writeBatch(db);
  DEFAULT_PLANS.forEach((p, k) => {
    const { id, ...rest } = p;
    const v = prices[id];
    batch.set(fs.doc(db, "plans", id), {
      featured: false, ...rest,
      price: (typeof v === "number" && v > 0) ? v : null,
      visible: true, order: k, updatedAt: fs.serverTimestamp()
    });
  });
  try {
    await batch.commit();
    await loadPlans();
    toast("Planes cargados");
  } catch (err) { alert(saveError(err)); btn.disabled = false; }
}

$("#newPlan").addEventListener("click", () => openPlan(null));

const G = {
  name: $("#gName"), for: $("#gFor"), price: $("#gPrice"), feats: $("#gFeats"),
  featured: $("#gFeatured"), visible: $("#gVisible")
};

function openPlan(p){
  editingPlan = p ? p.id : null;
  $("#planFormTitle").textContent = p ? "Editar plan" : "Nuevo plan";
  G.name.value = p?.name || "";
  G.for.value = p?.for || "";
  G.price.value = (typeof p?.price === "number" && p.price > 0) ? p.price.toLocaleString(locale) : "";
  G.feats.value = (p?.feats || []).join("\n");
  G.featured.checked = !!p?.featured;
  G.visible.checked = p ? !!p.visible : true;
  $("#planErr").textContent = "";
  $("#planList").hidden = true;
  $("#planForm").hidden = false;
  dirty = false;
  previewPlan();
  window.scrollTo({ top: 0 });
  G.name.focus();
}

function closePlan(){
  $("#planForm").hidden = true;
  $("#planList").hidden = false;
  dirty = false;
}

$("#planForm [data-cancel]").addEventListener("click", () => { if (confirmLeave()) closePlan(); });
$("#planForm").addEventListener("input", () => { dirty = true; previewPlan(); });

const featsOf = () => G.feats.value.split("\n").map(s => s.trim()).filter(Boolean);

// Mismo HTML que la sección de planes de index.html
// Acepta 45000, 45.000, $45.000 o "45 000": se queda con los dígitos
const parsePrice = v => { const d = String(v).replace(/\D/g, ""); return d ? +d : null; };

function previewPlan(){
  const price = parsePrice(G.price.value) || 0;
  const feat = G.featured.checked;
  $("#pvPlan").innerHTML = `<article class="plan${feat ? " feat" : ""}">
    ${feat ? '<span class="badge">Más elegido</span>' : ""}
    <h3>${esc(G.name.value || "Nombre")}</h3><p class="for">${esc(G.for.value)}</p>
    ${price > 0
      ? `<div class="price"><b>${S.money(price)}</b><span>${esc(S.currency)} / mes</span></div><div class="price-note">Facturación mensual</div>`
      : `<div class="price"><b class="ask">Consultar</b></div><div class="price-note">Escríbenos y te enviamos el valor.</div>`}
    <ul>${featsOf().map(f => `<li>${esc(f)}</li>`).join("")}</ul>
    <span class="btn${feat ? "" : " ghost"}">${price > 0 ? "Suscribirme" : "Consultar precio"}</span>
  </article>`;
}

$("#planForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#planErr");
  const name = G.name.value.trim();
  if (!name) { err.textContent = "Falta el nombre."; G.name.focus(); return; }
  const raw = G.price.value.trim();
  const price = parsePrice(raw);
  if (raw && !price) { err.textContent = "Escribe el precio con números, por ejemplo 45.000, o déjalo vacío."; G.price.focus(); return; }
  if (/[.,]\d{1,2}$/.test(raw)) { err.textContent = "Escribe el precio sin decimales, por ejemplo 45.000."; G.price.focus(); return; }

  const current = plans.find(p => p.id === editingPlan);
  const data = {
    name,
    for: G.for.value.trim(),
    price: price || null,
    feats: featsOf(),
    featured: G.featured.checked,
    visible: G.visible.checked,
    order: current ? (current.order ?? 0) : plans.length,
    updatedAt: fs.serverTimestamp()
  };
  const btn = e.submitter; btn.disabled = true; err.textContent = "";
  try {
    let id = editingPlan;
    if (id) await fs.setDoc(fs.doc(db, "plans", id), data);
    else id = (await fs.addDoc(fs.collection(db, "plans"), data)).id;
    plans = [...plans.filter(p => p.id !== id), { ...data, id, updatedAt: null }]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    closePlan();
    renderPlans();
    toast("Plan guardado");
  } catch (e2) {
    err.textContent = saveError(e2);
  } finally { btn.disabled = false; }
});

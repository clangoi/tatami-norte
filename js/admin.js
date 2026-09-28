/* ==========================================================
   Kizuna · Panel de administración (admin.html)
   Inicio de sesión con Firebase Auth y edición de:
   posts/{slug}  artículos del blog (texto en Markdown, js/markdown.js)
   plans/{id}    planes de suscripción
   Quién puede entrar lo deciden admins/{uid} y firestore.rules.
   ========================================================== */
import { SDK, app, db, fs } from "./firebase.js";
import { toHtml, readingMinutes } from "./markdown.js";

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
let editingSlug = null; // null = artículo nuevo
const STATIC = (window.BLOG_POSTS || []).map(p => ({ ...p, src: "file" }));

async function loadPosts(){
  $("#posts").innerHTML = '<p class="adm-loading">Cargando artículos…</p>';
  try {
    const snap = await fs.getDocs(fs.collection(db, "posts"));
    posts = snap.docs.map(d => ({ ...d.data(), slug: d.id }));
    renderPosts();
  } catch (e) {
    console.warn(e);
    $("#posts").innerHTML = `<p class="err">${esc(saveError(e))}</p>`;
  }
}

function renderPosts(){
  const all = [...posts, ...STATIC].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  $("#cats").innerHTML = [...new Set(all.map(p => p.cat).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join("");
  if (!all.length) { $("#posts").innerHTML = '<p class="adm-empty">Todavía no hay artículos.</p>'; return; }
  $("#posts").innerHTML = all.map(p => {
    const fixed = p.src === "file";
    const status = fixed ? '<span class="adm-tag">Página fija</span>'
      : p.published ? '<span class="adm-tag on">Publicado</span>' : '<span class="adm-tag">Borrador</span>';
    const actions = fixed
      ? `<a class="btn small ghost" href="blog/${esc(p.slug)}.html" target="_blank" rel="noopener">Ver</a>`
      : `${p.published ? `<a class="btn small ghost" href="blog/articulo.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver</a>` : ""}
         <button class="btn small ghost" type="button" data-edit="${esc(p.slug)}">Editar</button>
         <button class="btn small ghost adm-danger" type="button" data-del="${esc(p.slug)}">Borrar</button>`;
    return `<div class="adm-row${fixed ? " is-fixed" : ""}">
      <div class="adm-row-main">
        <b>${esc(p.title)}</b>
        <span>${esc(p.cat || "Sin categoría")} · ${fmtDate(p.date)}${fixed ? " · se edita en el código (BLOG.md)" : ""}</span>
      </div>
      ${status}
      <div class="adm-row-actions">${actions}</div>
    </div>`;
  }).join("");
}

$("#posts").addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]");
  if (ed) { openPost(posts.find(p => p.slug === ed.dataset.edit)); return; }
  const del = e.target.closest("[data-del]");
  if (del) {
    const p = posts.find(x => x.slug === del.dataset.del);
    if (!confirm(`¿Borrar “${p.title}”? No se puede deshacer.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, "posts", p.slug));
      posts = posts.filter(x => x !== p);
      renderPosts();
      toast("Artículo borrado");
    } catch (err) { alert(saveError(err)); }
  }
});

$("#newPost").addEventListener("click", () => openPost(null));

const F = {
  title: $("#fTitle"), slug: $("#fSlug"), ex: $("#fEx"), cat: $("#fCat"), date: $("#fDate"),
  letter: $("#fLetter"), pat: $("#fPat"), body: $("#fBody"), published: $("#fPublished")
};
let slugTouched = false;

function openPost(p){
  editingSlug = p ? p.slug : null;
  slugTouched = !!p;
  $("#postFormTitle").textContent = p ? "Editar artículo" : "Nuevo artículo";
  F.title.value = p?.title || "";
  F.slug.value = p?.slug || "";
  F.slug.readOnly = !!p;
  F.ex.value = p?.ex || "";
  F.cat.value = p?.cat || "";
  F.date.value = p?.date || today();
  F.letter.value = p?.letter || "";
  F.pat.value = String(p?.pattern ?? 0);
  F.body.value = p?.body || "";
  F.published.checked = p ? !!p.published : false;
  $("#postErr").textContent = "";
  $("#postList").hidden = true;
  $("#postForm").hidden = false;
  dirty = false;
  previewPost();
  window.scrollTo({ top: 0 });
  F.title.focus();
}

function closePost(){
  $("#postForm").hidden = true;
  $("#postList").hidden = false;
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
    <div class="cover"><div class="pat pat-${F.pat.value}"></div><span class="big" aria-hidden="true">${esc(letter)}</span>${F.cat.value ? `<span class="cat">${esc(F.cat.value)}</span>` : ""}</div>
    <span class="meta">${fmtDate(F.date.value)} · ${readingMinutes(F.body.value)} min de lectura</span>
    <h3>${esc(F.title.value || "Título del artículo")}</h3><p class="ex">${esc(F.ex.value)}</p>`;
  $("#pvTitle").textContent = F.title.value;
  $("#pvBody").innerHTML = toHtml(F.body.value) || '<p class="adm-empty">El texto aparecerá aquí.</p>';
  $("#readInfo").textContent = `${readingMinutes(F.body.value)} min de lectura`;
}

// Barra de formato: envuelve la selección o inserta al inicio de la línea
$(".adm-tools").addEventListener("click", e => {
  const b = e.target.closest("[data-md]"); if (!b) return;
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
  if (!editingSlug && (posts.some(p => p.slug === slug) || STATIC.some(p => p.slug === slug))) {
    err.textContent = "Ya existe un artículo con esa dirección. Cambia la dirección."; F.slug.focus(); return;
  }
  if (F.published.checked && !F.body.value.trim()) { err.textContent = "No se puede publicar un artículo sin texto."; F.body.focus(); return; }

  const data = {
    title,
    ex: F.ex.value.trim(),
    cat: F.cat.value.trim(),
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
    toast(data.published ? "Artículo publicado" : "Borrador guardado");
  } catch (e2) {
    err.textContent = saveError(e2);
  } finally { btn.disabled = false; }
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

/* ==========================================================
   Kizuna · Firebase
   Conexión compartida con Firestore. Toma los datos de
   site.config.js → firebase. Se carga como módulo:

   import { db, fs } from "./firebase.js";

   Colecciones (ver firestore.rules):
   posts/{slug}   artículos del blog escritos desde admin.html
   plans/{id}     planes de suscripción
   admins/{uid}   quién puede editar
   ========================================================== */
export const SDK = "https://www.gstatic.com/firebasejs/12.19.0";

const { initializeApp } = await import(`${SDK}/firebase-app.js`);
export const fs = await import(`${SDK}/firebase-firestore.js`);

export const app = initializeApp(window.SITE_CONFIG.firebase);
export const db = fs.getFirestore(app);

// Artículos publicados, del más nuevo al más antiguo
export async function publishedPosts(){
  const q = fs.query(fs.collection(db, "posts"), fs.where("published", "==", true));
  const snap = await fs.getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), slug: d.id, src: "db" }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Planes visibles, en el orden elegido en el panel
export async function visiblePlans(){
  const q = fs.query(fs.collection(db, "plans"), fs.where("visible", "==", true));
  const snap = await fs.getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// Imágenes subidas desde admin: images/{id} guarda la foto como data URL (ya reducida).
// Se piden una sola vez por visita.
const imageCache = new Map();
export function cacheImage(id, data){ imageCache.set(id, Promise.resolve(data)); }
export function loadImage(id){
  if (!imageCache.has(id)) {
    imageCache.set(id, fs.getDoc(fs.doc(db, "images", id)).then(s => (s.exists() ? s.data().data : null)));
  }
  return imageCache.get(id);
}
// Rellena las <img data-img="ID"> que dibuja markdown.js
export function hydrateImages(root){
  root.querySelectorAll("img[data-img]").forEach(img => {
    loadImage(img.dataset.img)
      .then(data => { if (data) img.src = data; else img.alt = img.alt || "Imagen no disponible"; })
      .catch(() => { img.alt = img.alt || "Imagen no disponible"; });
  });
}

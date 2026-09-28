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

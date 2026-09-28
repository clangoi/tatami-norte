/* ==========================================================
   Kizuna · Contenido editable
   Trae desde Firestore lo que se escribe en admin.html y lo
   suma a la página. Si Firestore no responde, el sitio sigue
   mostrando lo que ya tiene (js/posts.js y los planes por defecto).

   <script type="module" src="js/content.js"></script>
   Va después de js/blog.js y del script de planes.
   ========================================================== */
import { publishedPosts, visiblePlans } from "./firebase.js";

const needsPosts = document.querySelector("[data-blog-list],[data-blog-latest],[data-blog-related]");
const needsPlans = window.TNPlans && document.getElementById("plans");

if (needsPosts && window.TNBlog) {
  publishedPosts()
    .then(list => { if (list.length) window.TNBlog.add(list); })
    .catch(err => console.warn("Blog: no se pudieron cargar los artículos del panel.", err));
}

if (needsPlans) {
  visiblePlans()
    .then(list => { if (list.length) window.TNPlans.set(list); })
    .catch(err => console.warn("Planes: no se pudieron cargar desde el panel.", err));
}

# Blog

Los artículos ya no son archivos del código: se crean, editan y borran desde `/admin` (ver `ADMIN.md`). Se guardan en Firebase y se muestran en `blog/articulo.html?p=<direccion>`.

- El listado (`blog.html`) permite filtrar por tema y ordenar por fecha o título.
- Los temas se administran en la pestaña **Temas** del panel.
- `js/seed-posts.js` solo guarda los cuatro artículos originales para el botón "Cargar los artículos de siempre".
- Las direcciones antiguas (`/blog/<nombre>`) redirigen a la nueva en `vercel.json`.

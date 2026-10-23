# Blog

Los artículos ya no son archivos del código: se crean, editan y borran desde `/admin` (ver `ADMIN.md`). Se guardan en Firebase y se muestran en `blog/articulo.html?p=<direccion>`.

- El listado (`blog.html`) permite filtrar por tema y ordenar por fecha o título.
- Los temas se administran en la pestaña **Temas** del panel.
- `js/seed-posts.js` guarda los artículos listos para cargar (los cuatro originales y los nuevos, p. ej. los de hikite y tsurite). En `/admin`, el botón "Cargar artículos nuevos" copia solo los que faltan, sin pisar los que ya editaste.
- Las imágenes propias son SVG limpios con la paleta de la marca (`assets/images/content/*.svg`). Los videos deben ser recientes.
- Las direcciones antiguas (`/blog/<nombre>`) redirigen a la nueva en `vercel.json`.

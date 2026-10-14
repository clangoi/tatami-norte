/* ==========================================================
   Kizuna · Panel → ícono "i" que muestra cómo funciona cada sección
   infoTip(html) devuelve el ícono y el texto oculto; al tocar el ícono se muestra u oculta.
   Para HTML fijo (admin.html) basta copiar el mismo marcado.
   ========================================================== */
export const infoTip = (html, label = "Cómo funciona esta sección") =>
  `<div class="adm-info"><button type="button" class="adm-info-btn" data-info aria-expanded="false" aria-label="${label}" title="${label}">i</button><p class="adm-help adm-note adm-info-text" role="note" hidden>${html}</p></div>`;

document.addEventListener("click", e => {
  const btn = e.target.closest && e.target.closest("[data-info]");
  if (!btn) return;
  const text = btn.nextElementSibling;
  if (!text) return;
  const open = text.hidden;
  text.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
});

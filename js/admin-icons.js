/* ==========================================================
   Kizuna · Iconos del panel
   Ver (clic en la fila), editar (lápiz), borrar (tacho) y el estado
   publicado / visible (ojo; ojo tachado si no lo está) van como símbolos,
   sin palabras. El texto solo queda como etiqueta accesible (aria-label)
   y como ayuda al pasar el mouse (title).
   Los textos que se pasan aquí deben venir ya escapados.
   ========================================================== */
const svg = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="M9.9 4.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2"/><path d="M6.6 6.6A18.5 18.5 0 0 0 2 12s3.6 7 10 7a10.4 10.4 0 0 0 5.4-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/>'),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>')
};

// Estado: ojo si está publicado / visible; ojo tachado si no
export const stateIcon = (on, onLabel, offLabel) => {
  const label = on ? onLabel : offLabel;
  return `<span class="adm-state${on ? " on" : ""}" role="img" aria-label="${label}" title="${label}">${on ? ICONS.eye : ICONS.eyeOff}</span>`;
};

// Botón de solo símbolo: kind = "pencil" | "trash" | "eye"
export const iconBtn = (kind, label, attrs = "") =>
  `<button class="adm-icon${kind === "trash" ? " adm-icon-danger" : ""}" type="button" ${attrs} aria-label="${label}" title="${label}">${ICONS[kind]}</button>`;

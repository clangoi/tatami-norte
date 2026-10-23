/* ==========================================================
   Kizuna · Panel → Asistencia (pasar lista)
   La asistencia la marca el propio deportista al responder la encuesta de cansancio
   (1 a 10 y comentarios), y responderla cuenta como que fue. Esta pantalla es para el
   equipo: ver las respuestas y marcar a quien olvidó responder. Pensado para el celular:
   las clases del día con sus inscritos y dos toques por persona (vino / faltó). Quien llega sin reservar
   se agrega al momento, sin crear perfil. Habla con /api/asistencia.
   ========================================================== */
export function initAsistencia({ getToken, esc, toast }) {
  const root = document.getElementById("attendanceRoot");
  let state = null;           // { date, today, sessions }
  let known = [];             // personas conocidas, para completar al agregar a alguien
  let date = "";              // día que se está viendo ("" = hoy)
  let adding = null;          // clave de la clase con el formulario «agregar» abierto
  let busy = false;

  const api = async (path, body) => {
    const token = await getToken();
    const r = await fetch("/api/asistencia" + path, body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) }
      : { headers: { Authorization: "Bearer " + token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo completar. Intenta de nuevo.");
    return j;
  };

  const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const longDate = d => new Date(d + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  async function load(first) {
    if (first) root.innerHTML = '<p class="adm-loading">Cargando clases…</p>';
    try {
      state = await api(`?date=${date || ""}${known.length ? "" : "&known=1"}`);
      if (state.known) known = state.known;
      render();
    } catch (e) { root.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  function activate() { return load(!state); }

  /* ---------- Dibujo ---------- */
  const count = list => list.filter(p => p.present === true).length;

  function person(s, p) {
    return `<div class="att-person" data-person="${esc(p.id)}">
      <div class="att-who"><b>${esc(p.name)}</b>
        ${p.fatigue ? `<span class="att-survey"><em class="att-tag att-fat">Cansancio ${p.fatigue}/10</em>${p.comment ? `“${esc(p.comment)}”` : ""}</span>` : p.present === true && p.source === "admin" ? '<span class="att-survey"><em class="att-tag">Marcada por el equipo</em></span>' : ""}
        <span>${p.walkIn ? '<em class="att-tag">Sin reserva</em>' : ""}${p.booked ? "" : p.walkIn ? "" : '<em class="att-tag">Reserva cancelada</em>'}${esc(p.phone || p.email || "")}</span></div>
      <div class="att-btns">
        <button type="button" class="btn small ghost att-yes" data-mark="${esc(s.key)}|${esc(p.id)}|true" aria-pressed="${p.present === true}">Vino</button>
        <button type="button" class="btn small ghost att-no" data-mark="${esc(s.key)}|${esc(p.id)}|false" aria-pressed="${p.present === false}">Faltó</button>
        ${p.walkIn ? `<button type="button" class="btn small ghost" data-remove="${esc(s.key)}|${esc(p.id)}" aria-label="Quitar a ${esc(p.name)}">✕</button>` : ""}
      </div>
    </div>`;
  }

  function addForm(s) {
    return `<form class="att-add" data-walkin="${esc(s.key)}" novalidate>
      <div class="field"><label for="w-${esc(s.key)}">Nombre</label>
        <input id="w-${esc(s.key)}" name="name" list="attKnown" maxlength="80" autocomplete="off" required>
        <datalist id="attKnown">${known.map(k => `<option value="${esc(k.name)}">${esc(k.email || k.phone)}</option>`).join("")}</datalist></div>
      <div class="row2">
        <div class="field"><label>Teléfono (opcional)</label><input name="phone" type="tel" inputmode="tel" maxlength="24"></div>
        <div class="field"><label>Correo (opcional)</label><input name="email" type="email" maxlength="160"></div>
      </div>
      <small class="adm-help">No hace falta que tenga cuenta. Si tiene un perfil, pon el mismo correo para que la clase cuente en su historial.</small>
      <div class="err" data-err role="alert"></div>
      <div class="adm-actions"><button class="btn" type="submit">Agregar y marcar que vino</button><button class="btn ghost" type="button" data-add-cancel>Cancelar</button></div>
    </form>`;
  }

  function session(s) {
    const pending = s.people.filter(p => p.booked && p.present === null).length;
    return `<section class="adm-sess att-sess">
      <header><div><b>${esc(s.classLabel)}</b><span>${esc(s.start)}–${esc(s.end)}</span></div>
        <span class="adm-tag on" title="Presentes">${count(s.people)} presentes · ${s.people.length} en lista</span></header>
      ${s.answers ? `<p class="adm-help att-avg">Cansancio promedio: <b>${s.avgFatigue}/10</b> · ${s.answers} ${s.answers === 1 ? "respuesta" : "respuestas"} a la encuesta</p>` : ""}
      <div class="att-list">${s.people.length ? s.people.map(p => person(s, p)).join("") : '<p class="adm-help">Nadie se inscribió a esta clase.</p>'}</div>
      <div class="adm-actions att-foot">
        ${pending > 1 ? `<button class="btn small" type="button" data-all="${esc(s.key)}">Marcar presentes a los ${pending} sin marcar</button>` : ""}
        ${adding === s.key ? "" : `<button class="btn small ghost" type="button" data-add="${esc(s.key)}">Agregar a alguien que no reservó</button>`}
      </div>
      ${adding === s.key ? addForm(s) : ""}
    </section>`;
  }

  function render() {
    const isToday = state.date === state.today;
    root.innerHTML = `<div class="adm-bar"><h2>Pasar lista</h2></div>
      <div class="adm-info"><button type="button" class="adm-info-btn" data-info aria-expanded="false" aria-label="Cómo funciona esta sección" title="Cómo funciona esta sección">i</button><p class="adm-help adm-note adm-info-text" role="note" hidden>Cada deportista marca su asistencia respondiendo, al terminar la clase, la encuesta de cansancio (1 a 10 y comentarios); responderla cuenta como que fue y aquí ves su respuesta. Si alguien olvidó responder, márcalo tú con «Vino». Quien llegó sin reservar se agrega al momento, sin crear perfil. La asistencia alimenta los grados y el historial de cada deportista. Solo se puede marcar de hoy y de días anteriores.</p></div>
      <div class="att-day">
        <button class="btn small ghost" type="button" data-day="-1" aria-label="Día anterior">←</button>
        <b>${isToday ? "Hoy · " : ""}${esc(cap(longDate(state.date)))}</b>
        <button class="btn small ghost" type="button" data-day="1" aria-label="Día siguiente"${isToday ? " disabled" : ""}>→</button>
        ${isToday ? "" : '<button class="btn small" type="button" data-day="today">Ir a hoy</button>'}
      </div>
      ${state.sessions.length ? state.sessions.map(session).join("") : '<p class="adm-empty">No hay clases en el horario de este día.</p>'}`;
  }

  /* ---------- Acciones ---------- */
  async function mark(key, id, present) {
    if (busy) return;
    const s = state.sessions.find(x => x.key === key), p = s && s.people.find(x => x.id === id);
    if (!p) return;
    const next = p.present === present ? null : present;   // tocar de nuevo lo deja sin marcar
    if (next === null && p.fatigue && !confirm("Esta persona respondió la encuesta. ¿Quitar su asistencia y su respuesta?")) return;
    const before = p.present;
    p.present = next; render();
    try { await api("", { action: "mark", sessionKey: key, id, present: next }); }
    catch (e) { p.present = before; render(); toast(e.message); }
  }

  async function markAll(key) {
    const s = state.sessions.find(x => x.key === key);
    if (!s || busy) return;
    busy = true;
    const todo = s.people.filter(p => p.booked && p.present === null);
    try {
      for (const p of todo) { await api("", { action: "mark", sessionKey: key, id: p.id, present: true }); p.present = true; }
      toast("Listo: marcados como presentes");
    } catch (e) { toast(e.message); }
    busy = false;
    await load();
  }

  root.addEventListener("click", async e => {
    const t = e.target;
    const mk = t.closest("[data-mark]");
    if (mk) { const [key, id, v] = mk.dataset.mark.split("|"); return mark(key, id, v === "true"); }
    const all = t.closest("[data-all]");
    if (all) return markAll(all.dataset.all);
    const ad = t.closest("[data-add]");
    if (ad) { adding = ad.dataset.add; render(); const i = root.querySelector(".att-add input"); if (i) i.focus(); return; }
    if (t.closest("[data-add-cancel]")) { adding = null; render(); return; }
    const rm = t.closest("[data-remove]");
    if (rm) {
      const [key, id] = rm.dataset.remove.split("|");
      if (!confirm("¿Quitar a esta persona de la lista?")) return;
      try { await api("", { action: "remove", sessionKey: key, id }); await load(); } catch (ex) { toast(ex.message); }
      return;
    }
    const dy = t.closest("[data-day]");
    if (dy) {
      date = dy.dataset.day === "today" ? state.today : addDays(state.date, Number(dy.dataset.day));
      if (date > state.today) date = state.today;
      adding = null;
      load(true);
    }
  });

  // Al elegir a alguien conocido, se completan su teléfono y correo
  root.addEventListener("change", e => {
    const form = e.target.closest("[data-walkin]");
    if (!form || e.target.name !== "name") return;
    const k = known.find(x => norm(x.name) === norm(e.target.value));
    if (!k) return;
    if (!form.elements.phone.value) form.elements.phone.value = k.phone;
    if (!form.elements.email.value) form.elements.email.value = k.email;
  });

  root.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target.closest("[data-walkin]");
    if (!form) return;
    const err = form.querySelector("[data-err]"), btn = form.querySelector("[type=submit]");
    err.textContent = ""; btn.disabled = true;
    try {
      await api("", { action: "walkin", sessionKey: form.dataset.walkin, name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value });
      adding = null;
      toast("Agregado");
      await load();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });

  return { activate, reset() { adding = null; } };
}

/* ==========================================================
   Kizuna · Panel → Deportistas
   CRUD de las cuentas de deportistas. Crear una cuenta no es automático:
   el equipo la crea con el correo con el que la persona se inscribe (esté o
   no en las reservas) y se le envía un enlace para crear su clave.
   Habla con /api/deportistas usando la sesión del panel.
   ========================================================== */
export function initDeportistas({ getToken, esc, toast }) {
  const root = document.getElementById("athletesRoot");
  let data = null;            // { athletes, candidates }
  let query = "";
  let editing = null;         // null | "new" | id

  const api = async (body) => {
    const token = await getToken();
    const r = await fetch("/api/deportistas", body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) }
      : { headers: { Authorization: "Bearer " + token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo completar. Intenta de nuevo.");
    return j;
  };

  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const when = iso => iso ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "";
  // Sugerencias de grado según la disciplina (se puede escribir cualquier otro)
  const GRADES = {
    bjj: ["Blanco", "Azul", "Morado", "Café", "Negro"],
    judo: ["6º kyu (blanco)", "5º kyu (amarillo)", "4º kyu (naranja)", "3º kyu (verde)", "2º kyu (azul)", "1º kyu (café)", "1º dan (negro)"]
  };
  const gradesFor = name => { const n = norm(name); return n.includes("judo") ? GRADES.judo : n.includes("bjj") || n.includes("jiu") ? GRADES.bjj : []; };
  const MEDICAL = !!((window.SITE_CONFIG || {}).features || {}).medicalRecord;   // ficha médica en pausa (site.config.js → features)
  const MED = [["conditions", "Condiciones médicas"], ["injuries", "Lesiones"], ["allergies", "Alergias"], ["medications", "Medicamentos"], ["bloodType", "Grupo sanguíneo"], ["insurance", "Previsión / seguro"]];
  const chips = list => list.length
    ? list.map(c => `<span class="adm-chip">${esc(c.name)} <b>${c.count}</b></span>`).join("")
    : '<span class="adm-help">Aún sin clases tomadas</span>';

  async function activate() {
    if (!data) {
      root.innerHTML = '<p class="adm-loading">Cargando deportistas…</p>';
      try { data = await api(); }
      catch (e) { root.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    }
    render();
  }

  async function reload() { data = await api(); render(); }

  /* ---------- Dibujo ---------- */
  function row(a) {
    return `<div class="adm-row adm-ath${a.active ? "" : " is-off"}">
      <div class="adm-row-main">
        <b>${esc(a.name || a.email)}</b>
        <span>${esc(a.email)}${a.phone ? " · " + esc(a.phone) : ""}</span>
        <span class="adm-ath-chips">${a.taken ? `<span class="adm-chip is-total">${a.taken} ${a.taken === 1 ? "clase" : "clases"}</span>` : ""}
          ${a.clubs.map(c => `<span class="adm-chip" title="Club">${esc(c.name)} <b>${c.count}</b></span>`).join("")}
          ${a.disciplines.map(c => `<span class="adm-chip" title="Disciplina">${esc(c.name)} <b>${c.count}</b></span>`).join("")}
          ${a.types.map(c => `<span class="adm-chip" title="Tipo">${esc(c.name)} <b>${c.count}</b></span>`).join("")}
          ${a.upcoming ? `<span class="adm-chip is-next">${a.upcoming} ${a.upcoming === 1 ? "próxima" : "próximas"}</span>` : ""}</span>
        <span class="adm-ath-chips">${a.attendance.total ? `<span class="adm-chip is-next" title="Asistencias reales: total y últimos 90 días">Asistió ${a.attendance.total} · 90 d: ${a.attendance.last90}</span>` : ""}${Object.entries(a.ranks || {}).map(([d, r]) => `<span class="adm-chip is-total" title="Grado y clases asistidas desde que lo tiene">${esc(d)} · ${esc(r.grade)} <b>${(a.attendance.sinceGrade || {})[d] || 0}</b></span>`).join("")}${MEDICAL && !a.medical ? '<span class="adm-chip is-next" title="Aún no llena su ficha médica">Ficha médica pendiente</span>' : ""}</span>
        <span>${a.active ? "" : "Desactivado · "}${a.lastLoginAt ? "Último ingreso: " + esc(when(a.lastLoginAt)) : "Aún no ha entrado"}</span>
      </div>
      <div class="adm-row-actions">
        <button class="btn small ghost" type="button" data-resend="${esc(a.id)}">Enviar enlace de clave</button>
        <button class="btn small ghost" type="button" data-edit="${esc(a.id)}">Editar</button>
        <button class="btn small ghost" type="button" data-del="${esc(a.id)}">Eliminar</button>
      </div>
    </div>`;
  }

  // Solo al editar: apodo, contacto de emergencia, grados y ficha médica (solo lectura)
  function extra(a) {
    const disciplines = [...new Set([...(data.disciplines || []), ...Object.keys(a.ranks || {})])];
    const med = a.medical;
    return `<div class="row2">
        <div class="field"><label for="aNick">Apodo (sale en las listas de inscritos)</label><input id="aNick" name="nickname" maxlength="30" value="${esc(a.nickname)}"></div>
        <div class="field"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="aEmN">Contacto de emergencia</label><input id="aEmN" name="emergencyName" maxlength="80" placeholder="Nombre" value="${esc(a.emergencyName)}"></div>
        <div class="field"><label for="aEmP">Teléfono de emergencia</label><input id="aEmP" name="emergencyPhone" type="tel" maxlength="24" placeholder="+56 9 1234 5678" value="${esc(a.emergencyPhone)}"></div>
      </div>
      <h3 class="adm-sub">Grados</h3>
      <small class="adm-help">Los asigna el equipo; el deportista los ve en su panel. Deja vacío si no tiene grado en esa disciplina.</small>
      <div class="adm-ranks">${disciplines.length ? disciplines.map((d, i) => {
        const r = (a.ranks || {})[d] || {};
        return `<div class="adm-cfg-row" data-rank="${esc(d)}"><b class="adm-rank-name">${esc(d)}</b>
          <input name="grade${i}" list="aGr${i}" maxlength="40" placeholder="Grado" value="${esc(r.grade || "")}" aria-label="Grado en ${esc(d)}">
          <datalist id="aGr${i}">${gradesFor(d).map(g => `<option value="${esc(g)}">`).join("")}</datalist>
          <input name="since${i}" type="date" value="${esc(r.since || "")}" aria-label="Desde cuándo en ${esc(d)}"></div>`;
      }).join("") : '<p class="adm-help">Todavía no hay disciplinas creadas en Clases → Configuración.</p>'}</div>
      ${!MEDICAL ? "" : `<h3 class="adm-sub">Ficha médica</h3>
      ${med ? `<dl class="adm-med">${MED.map(([k, label]) => `<dt>${label}</dt><dd>${med[k] ? esc(med[k]) : "—"}</dd>`).join("")}
        <dt>Declaración</dt><dd>Aceptada el ${esc(when(med.consentAt))}${med.updatedAt ? " · actualizada el " + esc(when(med.updatedAt)) : ""}</dd></dl>
        <small class="adm-help">La llena el propio deportista. Es información sensible: úsala solo en caso de emergencia.</small>`
        : '<p class="adm-help">Aún no completa su ficha médica.</p>'}`}`;
  }

  function form() {
    const a = editing === "new" ? null : data.athletes.find(x => x.id === editing);
    const isNew = !a;
    return `<form class="adm-editor adm-ath-form" data-form novalidate>
      <div class="adm-bar">
        <h2>${isNew ? "Nuevo deportista" : "Editar deportista"}</h2>
        <div class="adm-actions">
          <button class="btn ghost" type="button" data-cancel>Cancelar</button>
          <button class="btn" type="submit">${isNew ? "Crear y enviar enlace" : "Guardar"}</button>
        </div>
      </div>
      <div class="field"><label for="aEmail">Correo con el que se inscribe a sus clases</label>
        <input id="aEmail" name="email" type="email" maxlength="160" list="aCandidates" autocomplete="off" value="${esc(a ? a.email : "")}"${isNew ? " required" : " readonly"}>
        <datalist id="aCandidates">${data.candidates.map(c => `<option value="${esc(c.email)}">${esc(c.name)}${c.lastClass ? " · " + esc(c.lastClass) : ""}</option>`).join("")}</datalist>
        <small class="adm-help">${isNew ? "Elige uno de las reservas (se completan sus datos) o escribe otro correo nuevo. Se le envía un enlace para crear su clave." : "El correo no se puede cambiar: es su usuario y con él se reconocen sus reservas."}</small></div>
      <div class="row2">
        <div class="field"><label for="aName">Nombre y apellido</label><input id="aName" name="name" maxlength="80" value="${esc(a ? a.name : "")}"${isNew ? "" : " required"}>
          ${isNew ? '<small class="adm-help">Si el correo ya tiene reservas, se toma de ahí cuando lo dejas vacío.</small>' : ""}</div>
        <div class="field"><label for="aPhone">Teléfono</label><input id="aPhone" name="phone" type="tel" maxlength="24" placeholder="+56 9 1234 5678" value="${esc(a ? a.phone : "")}"></div>
      </div>
      ${isNew ? "" : extra(a)}
      ${isNew ? "" : `<label class="check"><input type="checkbox" name="active"${a.active ? " checked" : ""}> Cuenta activa (si no, no puede entrar a su panel)</label>`}
      <div class="err" data-err role="alert"></div>
    </form>`;
  }

  function render() {
    if (editing) { root.innerHTML = form(); const f = root.querySelector("input:not([readonly])"); if (f) f.focus(); return; }
    const list = data.athletes.filter(a => !query || norm(`${a.name} ${a.email} ${a.phone}`).includes(norm(query)));
    root.innerHTML = `<div class="adm-bar">
        <h2>Deportistas</h2>
        <button class="btn" type="button" data-new>Nuevo deportista</button>
      </div>
      <div class="adm-info"><button type="button" class="adm-info-btn" data-info aria-expanded="false" aria-label="Cómo funciona esta sección" title="Cómo funciona esta sección">i</button><p class="adm-help adm-note adm-info-text" role="note" hidden>Un deportista tiene su propio panel (/deportista) para agendar, reagendar y cancelar sus clases, ver su historial y suscribir sus reservas a su calendario. Se crea desde aquí con el correo con el que se inscribe, y recibe un enlace para crear su clave. Sus disciplinas, clubes y contadores salen solos de las clases que toma.</p></div>
      <div class="adm-toolbar"><label>Buscar <input type="search" id="athQuery" value="${esc(query)}" placeholder="Nombre, correo o teléfono" autocomplete="off"></label></div>
      <div class="adm-rows">${list.length ? list.map(row).join("") : `<p class="adm-empty">${data.athletes.length ? "Nadie coincide con la búsqueda." : "Todavía no hay deportistas. Crea el primero con el botón de arriba."}</p>`}</div>
      ${data.candidates.length ? `<p class="adm-help adm-note">${data.candidates.length} ${data.candidates.length === 1 ? "persona se inscribió" : "personas se inscribieron"} a clases sin tener cuenta; aparecen como sugerencias al crear un deportista.</p>` : ""}`;
    const q = root.querySelector("#athQuery");
    if (q && query) { q.focus(); q.setSelectionRange(query.length, query.length); }
  }

  /* ---------- Acciones ---------- */
  root.addEventListener("input", e => {
    if (e.target.id !== "athQuery") return;
    query = e.target.value;
    render();
  });

  root.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target;
    const err = form.querySelector("[data-err]");
    const btn = form.querySelector("[type=submit]");
    const f = form.elements;
    err.textContent = "";
    btn.disabled = true;
    try {
      if (editing === "new") {
        const res = await api({ action: "create", email: f.email.value, name: f.name.value, phone: f.phone.value });
        toast(res.emailSent ? "Deportista creado: le enviamos el enlace para crear su clave" : "Deportista creado, pero el correo no salió");
        if (!res.emailSent) prompt("Correo no configurado o falló. Envíale este enlace para que cree su clave:", res.link);
      } else {
        const ranks = {};
        form.querySelectorAll("[data-rank]").forEach(r => {
          const grade = r.querySelector("input[name^=grade]").value.trim();
          if (grade) ranks[r.dataset.rank] = { grade, since: r.querySelector("input[type=date]").value };
        });
        await api({ action: "update", id: editing, name: f.name.value, nickname: f.nickname.value, phone: f.phone.value,
          emergencyName: f.emergencyName.value, emergencyPhone: f.emergencyPhone.value, ranks, active: f.active.checked });
        toast("Guardado");
      }
      editing = null;
      await reload();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });

  root.addEventListener("click", async e => {
    const t = e.target;
    if (t.closest("[data-new]")) { editing = "new"; render(); return; }
    if (t.closest("[data-cancel]")) { editing = null; render(); return; }
    const ed = t.closest("[data-edit]");
    if (ed) { editing = ed.dataset.edit; render(); window.scrollTo({ top: 0 }); return; }
    const rs = t.closest("[data-resend]");
    if (rs) {
      const a = data.athletes.find(x => x.id === rs.dataset.resend);
      if (!confirm(`¿Enviar a ${a.email} un enlace para crear o cambiar su clave?`)) return;
      rs.disabled = true;
      try {
        const res = await api({ action: "resend", id: a.id });
        toast(res.emailSent ? "Enlace enviado" : "El correo no salió");
        if (!res.emailSent) prompt("Envíale este enlace para que cree su clave:", res.link);
      } catch (ex) { alert(ex.message); }
      rs.disabled = false;
      return;
    }
    const del = t.closest("[data-del]");
    if (del) {
      const a = data.athletes.find(x => x.id === del.dataset.del);
      if (!confirm(`¿Eliminar a ${a.name || a.email}? Pierde el acceso a su panel. Sus reservas quedan en el historial de la escuela.`)) return;
      try { await api({ action: "delete", id: a.id }); toast("Deportista eliminado"); await reload(); }
      catch (ex) { alert(ex.message); }
    }
  });

  return { activate, reset() { editing = null; } };
}

/* ==========================================================
   Kizuna · Tu reserva (reserva.html)
   Muestra una reserva con su código (?t=…), permite añadirla al
   calendario y reprogramarla o cancelarla. En ambos cambios el
   motivo es obligatorio. Usa /api/reserva.
   ========================================================== */
(function(){
  const app = document.getElementById("app");
  let code = new URLSearchParams(location.search).get("t") || "";
  const SITE = window.SITE_CONFIG || {};
  const locale = (SITE.currency && SITE.currency.locale) || "es-CL";

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dayLabel = date => new Date(date + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const manageUrl = id => `reserva?t=${encodeURIComponent(id)}`;
  const toast = msg => {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2800);
  };

  const api = (path, opts) => fetch("/api" + path, opts).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || "No se pudo completar. Intenta de nuevo."), { status: r.status });
    return data;
  });

  const waLink = text => SITE.contact && SITE.contact.whatsapp
    ? `https://wa.me/${SITE.contact.whatsapp}?text=${encodeURIComponent(text)}` : "";

  let state = null;      // { booking, options, google, ics }
  let mode = "view";     // view | cancel | reschedule

  const summary = b => `<div class="rv-pick"><b>${esc(b.classLabel)}</b><span>${esc(dayLabel(b.date))} · ${esc(b.start)}–${esc(b.end)}</span></div>`;

  function render(){
    const { booking: b } = state;
    if (b.status === "cancelled") {
      app.innerHTML = `<div class="rv-done">
        <div class="eyebrow">Reserva cancelada</div>${summary(b)}
        ${b.cancelReason ? `<p>Motivo: ${esc(b.cancelReason)}</p>` : ""}
        <div class="rv-actions"><a class="btn small" href="/#horario">Agendar otra clase</a></div></div>`;
      return;
    }
    if (b.status === "rescheduled") {
      app.innerHTML = `<div class="rv-done">
        <div class="eyebrow">Clase reprogramada</div>${summary(b)}
        <p>Esta reserva se cambió a otra hora${b.rescheduleReason ? ` (motivo: ${esc(b.rescheduleReason)})` : ""}.</p>
        <div class="rv-actions">${b.movedTo ? `<a class="btn small" href="${esc(manageUrl(b.movedTo))}">Ver mi nueva clase</a>` : ""}</div></div>`;
      return;
    }
    const open = mode === "view" ? "" : mode;
    app.innerHTML = `<div class="rv-done">
      <div class="eyebrow">${b.canChange ? "Reserva confirmada" : "Clase finalizada"}</div>${summary(b)}
      <p>A nombre de <b>${esc(b.name)}</b>${b.display !== b.name ? `<br>En la lista de inscritos apareces como <b>${esc(b.display)}</b>` : ""}</p>
      ${b.canChange ? `
      <div class="rv-actions">
        <a class="btn small" href="${esc(state.google)}" target="_blank" rel="noopener">Añadir a Google Calendar</a>
        <a class="btn small ghost" href="${esc(state.ics)}">Descargar .ics</a>
      </div>
      <div class="rv-change">
        <div class="rv-actions">
          <button class="btn small ghost" type="button" data-mode="reschedule" aria-pressed="${open === "reschedule"}">Reprogramar</button>
          <button class="btn small ghost" type="button" data-mode="cancel" aria-pressed="${open === "cancel"}">Cancelar mi reserva</button>
        </div>
        ${open ? changeForm(open) : ""}
      </div>` : '<p>Esta clase ya pasó. Puedes agendar otra desde la <a href="/#horario" style="color:var(--gold)">portada</a>.</p>'}
    </div>`;
  }

  const reasonField = label => `<div class="field"><label for="rvReason">${label}</label>
      <textarea id="rvReason" name="reason" rows="3" maxlength="300" required placeholder="Cuéntanos brevemente por qué"></textarea>
      <small class="rv-help">Es obligatorio: nos ayuda a organizar los cupos.</small></div>`;

  function changeForm(kind){
    if (kind === "cancel") {
      return `<form class="rv-subform" data-form="cancel" novalidate>
        ${reasonField("Motivo de la cancelación")}
        <div class="err" data-err role="alert"></div>
        <button class="btn" type="submit">Confirmar cancelación</button>
      </form>`;
    }
    const opts = state.options;
    if (!opts.length) return '<p class="rv-help">No hay otras horas disponibles para esta clase en los próximos días. Escríbenos y te ayudamos.</p>';
    const byDate = {};
    opts.forEach(s => (byDate[s.date] = byDate[s.date] || []).push(s));
    return `<form class="rv-subform" data-form="reschedule" novalidate>
      <div class="field"><label>Nueva hora</label>
        <div class="rv-options">${Object.entries(byDate).map(([date, list]) => `
          <div class="rv-opt-day"><h5>${esc(dayLabel(date))}</h5>
          ${list.map(s => `<label class="rv-opt${s.full ? " is-full" : ""}">
            <input type="radio" name="newSessionKey" value="${esc(s.key)}"${s.full ? " disabled" : ""}>
            <span><b>${esc(s.start)}–${esc(s.end)}</b> · ${s.full ? "Completa" : `${s.capacity - s.taken} cupos`}${s.attendees.length ? `<small>Inscritos: ${esc(s.attendees.join(", "))}</small>` : ""}</span>
          </label>`).join("")}</div>`).join("")}
        </div></div>
      ${reasonField("Motivo del cambio")}
      <div class="err" data-err role="alert"></div>
      <button class="btn" type="submit">Confirmar nueva hora</button>
    </form>`;
  }

  app.addEventListener("click", e => {
    const m = e.target.closest("[data-mode]");
    if (!m) return;
    mode = mode === m.dataset.mode ? "view" : m.dataset.mode;
    render();
    const f = app.querySelector("form");
    if (f) f.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  app.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target;
    const err = form.querySelector("[data-err]");
    const btn = form.querySelector("[type=submit]");
    const reason = form.elements.reason.value.trim();
    err.textContent = "";
    if (reason.length < 3) { err.textContent = "Cuéntanos el motivo (es obligatorio)."; form.elements.reason.focus(); return; }
    const body = { t: code, action: form.dataset.form, reason };
    if (body.action === "reschedule") {
      const pick = form.querySelector("input[name=newSessionKey]:checked");
      if (!pick) { err.textContent = "Elige la nueva hora."; return; }
      body.newSessionKey = pick.value;
    }
    btn.disabled = true;
    try {
      const res = await api("/reserva", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      mode = "view";
      if (body.action === "cancel") {
        state.booking = res.booking;
        toast("Reserva cancelada");
      } else {
        code = res.booking.id;   // los próximos cambios usan la reserva nueva
        history.replaceState(null, "", manageUrl(code));
        await load(code);
        toast("Clase reprogramada" + (res.emailSent ? ": te enviamos la confirmación" : ""));
        return;
      }
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });

  async function load(id){
    try {
      state = await api("/reserva?t=" + encodeURIComponent(id));
      mode = "view";
      render();
    } catch (ex) {
      app.innerHTML = `<div class="rv-done"><div class="eyebrow">No encontramos tu reserva</div>
        <p>${esc(ex.message)} Revisa que el enlace esté completo o escríbenos${waLink("Hola, necesito ayuda con mi reserva.") ? ` por <a style="color:var(--gold)" href="${esc(waLink("Hola, necesito ayuda con mi reserva."))}">WhatsApp</a>` : ""}.</p>
        <div class="rv-actions"><a class="btn small" href="/#horario">Agendar una clase</a></div></div>`;
    }
  }


  load(code);
})();

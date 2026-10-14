/* Correos de reservas (Brevo, plan gratis de 300 al día).
   Variables en Vercel:
     BREVO_API_KEY         llave de Brevo (SMTP & API → API Keys)
     MAIL_FROM             correo remitente, verificado en Brevo (Senders)
     MAIL_FROM_NAME        opcional; por defecto el nombre corto de la escuela
     ADMIN_NOTIFY_EMAIL    opcional; recibe un aviso de cada reserva, cambio o cancelación
   Sin BREVO_API_KEY las reservas funcionan igual, solo que sin correo. */
const { siteConfig } = require("./config");
const ics = require("./ics");

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ENT[c]);

const longDate = date => new Date(date + "T12:00:00Z")
  .toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Datos del evento de calendario de una reserva
function eventOf(b, site) {
  const cfg = siteConfig();
  const where = [cfg.address && cfg.address.line, cfg.address && cfg.address.city].filter(Boolean).join(", ");
  return {
    uid: `${b.id}@kizuna`,
    startAt: b.startAt, endAt: b.endAt,
    title: `${b.classLabel} · ${cfg.shortName || cfg.name}`,
    description: `Clase de ${b.classLabel} en ${cfg.name}. Llega 10 minutos antes.\nCambiar o cancelar: ${site}/reserva?t=${b.id}`,
    location: where, url: `${site}/reserva?t=${b.id}`, remind: 60
  };
}

async function send({ to, toName, subject, html, attachments }) {
  const key = process.env.BREVO_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) return false;
  const cfg = siteConfig();
  const body = {
    sender: { name: process.env.MAIL_FROM_NAME || cfg.shortName || cfg.name, email: from },
    to: [{ email: to, name: toName || undefined }],
    subject, htmlContent: html
  };
  if (attachments && attachments.length) body.attachment = attachments;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) { console.error("Brevo:", r.status, await r.text().catch(() => "")); return false; }
  return true;
}

function layout(title, bodyHtml) {
  const cfg = siteConfig();
  const a = cfg.address || {};
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F6F2E7;font-family:Arial,Helvetica,sans-serif;color:#1B2338">
<div style="max-width:540px;margin:0 auto;padding:24px 16px">
  <div style="background:#1B2338;color:#D6BD8C;padding:18px 22px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;font-weight:bold">${esc(cfg.name)}</div>
  <div style="background:#fff;padding:26px 22px;border:1px solid #e4dcc8;border-top:0">
    <h1 style="margin:0 0 14px;font-size:22px">${esc(title)}</h1>
    ${bodyHtml}
  </div>
  <p style="font-size:12px;color:#6b6f7a;margin:14px 4px">${esc(cfg.name)} · ${esc(a.line || "")}, ${esc(a.city || "")}</p>
</div></body></html>`;
}

const button = (href, label, dark) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:11px 16px;font-size:14px;font-weight:bold;text-decoration:none;${dark ? "background:#1B2338;color:#D6BD8C" : "border:1px solid #1B2338;color:#1B2338"}">${esc(label)}</a>`;

const summary = b => `<p style="font-size:17px;margin:0 0 4px"><b>${esc(b.classLabel)}</b></p>
  <p style="font-size:17px;margin:0 0 16px">${esc(cap(longDate(b.date)))} · ${esc(b.start)}–${esc(b.end)}</p>`;

// kind: "confirmed" | "rescheduled" | "cancelled"
async function toAttendee(kind, b, site) {
  const cfg = siteConfig();
  const a = cfg.address || {};
  const manage = `${site}/reserva?t=${b.id}`;
  const ev = eventOf(b, site);
  const first = esc(String(b.name).split(/\s+/)[0]);
  const where = `${esc(a.line)}, ${esc(a.city)}`;
  let title, html, attachments;
  if (kind === "cancelled") {
    title = "Tu reserva fue cancelada";
    html = `<p>Hola ${first}, cancelamos tu reserva.</p>${summary(b)}
      <p style="color:#4c5264">Cuando quieras volver, agenda otra clase en <a href="${esc(site)}/#reservas">${esc(site.replace(/^https?:\/\//, ""))}</a>.</p>`;
  } else {
    title = kind === "rescheduled" ? "Reprogramamos tu clase" : "Tu clase está confirmada";
    html = `<p>Hola ${first}, ${kind === "rescheduled" ? "esta es tu nueva clase" : "te esperamos"}:</p>${summary(b)}
      <p style="margin:0 0 18px;color:#4c5264">Llega 10 minutos antes. Trae agua y sandalias.<br>${where}</p>
      <div>${button(ics.googleUrl(ev), "Añadir a Google Calendar", true)}${button(`${site}/api/calendario?t=${b.id}`, "Descargar .ics (Apple, Outlook)", false)}</div>
      <p style="margin:22px 0 6px;font-size:14px;color:#4c5264">¿No puedes venir? Avísanos con tiempo para liberar tu cupo:</p>
      <div>${button(manage, "Cambiar o cancelar", false)}</div>`;
    attachments = [{ name: "clase.ics", content: Buffer.from(ics.calendar("Clase", [ev])).toString("base64") }];
  }
  return send({ to: b.email, toName: b.name, subject: `${title} · ${b.classLabel} ${b.date}`, html: layout(title, html), attachments });
}

// Aviso para la escuela. extra: HTML adicional (motivo, clase anterior…)
async function toHost(kind, b, site, extra) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return false;
  const label = { confirmed: "Nueva reserva", rescheduled: "Reprogramó", cancelled: "Canceló" }[kind];
  const html = `${summary(b)}<p style="margin:0 0 6px"><b>${esc(b.name)}</b>${b.nickname ? ` (${esc(b.nickname)})` : ""}</p>
    <p style="margin:0 0 6px">Teléfono: <a href="https://wa.me/${esc(b.waPhone)}">${esc(b.phone)}</a><br>Correo: ${esc(b.email)}</p>
    ${extra ? `<p style="margin:14px 0 0;padding:12px;background:#F6F2E7">${extra}</p>` : ""}`;
  const attachments = kind === "cancelled" ? undefined : [{ name: "clase.ics", content: Buffer.from(ics.calendar("Clase", [eventOf(b, site)])).toString("base64") }];
  return send({ to, subject: `${label}: ${b.display} · ${b.classLabel} ${b.date} ${b.start}`, html: layout(label, html), attachments });
}

module.exports = { toAttendee, toHost, eventOf, esc, longDate };

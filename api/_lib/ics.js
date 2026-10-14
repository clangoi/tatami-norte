/* Archivos de calendario (.ics) y enlace de Google Calendar */
const stamp = iso => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const esc = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Las líneas de un .ics miden como máximo 75 bytes; las largas continúan con un espacio
function fold(line) {
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > 74) { out.push(cur); cur = " " + ch; bytes = 1 + n; }
    else { cur += ch; bytes += n; }
  }
  out.push(cur);
  return out.join("\r\n");
}

function calendar(name, events) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kizuna//Reservas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"
  ];
  events.forEach(e => lines.push(...event(e)));
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// e: { uid, startAt, endAt, title, description, location, url, remind (minutos antes) }
function event(e) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startAt)}`,
    `DTEND:${stamp(e.endAt)}`,
    `SUMMARY:${esc(e.title)}`
  ];
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.cancelled) lines.push("STATUS:CANCELLED");
  if (e.remind) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.remind}M`, "END:VALARM");
  lines.push("END:VEVENT");
  return lines;
}

function googleUrl(e) {
  const q = new URLSearchParams({
    action: "TEMPLATE", text: e.title, dates: `${stamp(e.startAt)}/${stamp(e.endAt)}`,
    details: e.description || "", location: e.location || ""
  });
  return "https://calendar.google.com/calendar/render?" + q;
}

module.exports = { calendar, googleUrl };

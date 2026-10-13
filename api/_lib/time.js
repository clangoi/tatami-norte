/* Fechas y horas en la zona horaria de la escuela.
   Las clases se guardan como fecha "AAAA-MM-DD" y hora "HH:MM" locales;
   aquí se convierten a instantes UTC cuando hace falta (calendarios, avisos). */
const DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const pad = n => String(n).padStart(2, "0");

function partsIn(utcMs, tz) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  return Object.fromEntries(f.formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
}

// Minutos de diferencia entre la zona y UTC en ese instante
function offsetMinutes(utcMs, tz) {
  const p = partsIn(utcMs, tz);
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60000;
}

// "2026-10-19" + "19:00" en la zona → milisegundos UTC
function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMinutes(guess, tz) * 60000;
  return guess - offsetMinutes(first, tz) * 60000;
}

// Fecha de hoy ("AAAA-MM-DD") en la zona
function todayIn(tz, nowMs = Date.now()) {
  const p = partsIn(nowMs, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dayKeyOf = date => DAYS[new Date(date + "T12:00:00Z").getUTCDay()];

function addMinutes(hhmm, min) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}

const isDate = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = v => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

module.exports = { DAYS, zonedToUtc, todayIn, addDays, dayKeyOf, addMinutes, isDate, isTime };

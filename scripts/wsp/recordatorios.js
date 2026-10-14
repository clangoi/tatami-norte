/* ==========================================================
   Kizuna · Recordatorios de clase por WhatsApp (WhatsApp Web automatizado)
   Avisa por WhatsApp a quienes tienen una reserva confirmada unas horas antes de la clase.

   OJO: automatizar WhatsApp Web va contra los términos de WhatsApp y el número puede ser
   bloqueado. Por eso el script es prudente: solo escribe a personas que reservaron una clase,
   espacia los mensajes, tiene tope por vuelta y no envía de madrugada. Úsalo con un número
   que puedas arriesgar o, mejor, pasa a la API oficial de WhatsApp Business.

   Uso (desde esta carpeta, ver WHATSAPP.md):
     node recordatorios.js --dry          muestra qué enviaría, sin abrir WhatsApp ni marcar nada
     node recordatorios.js --test 569XXXXXXXX   envía un mensaje de prueba a ese número
     node recordatorios.js --once         una sola vuelta (por ejemplo desde el Programador de tareas)
     node recordatorios.js                se queda corriendo y revisa cada 5 minutos

   Variables de entorno (todas opcionales):
     SITE_URL            https://tu-sitio.cl  (para el enlace de cambiar o cancelar)
     REMIND_HOURS        horas antes de la clase (3)
     QUIET_FROM / QUIET_TO   horas en que NO se envía (22 y 7; hora de la escuela)
     MAX_PER_RUN         tope de mensajes por vuelta (25)
     FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio; si no, se usa .claude/service-account.json
   ========================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
process.chdir(ROOT);                       // las funciones de api/ leen site.config.js desde la raíz

const arg = n => process.argv.includes(n);
const argVal = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const DRY = arg("--dry"), ONCE = arg("--once"), TEST_TO = argVal("--test");

const REMIND_HOURS = Number(process.env.REMIND_HOURS) || 3;
const QUIET_FROM = process.env.QUIET_FROM !== undefined ? Number(process.env.QUIET_FROM) : 22;
const QUIET_TO = process.env.QUIET_TO !== undefined ? Number(process.env.QUIET_TO) : 7;
const MAX_PER_RUN = Number(process.env.MAX_PER_RUN) || 25;
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
const EVERY_MS = 5 * 60 * 1000;

const { siteConfig, bookingSettings } = require(path.join(ROOT, "api/_lib/config.js"));
const T = require(path.join(ROOT, "api/_lib/time.js"));
const { timeZone } = bookingSettings();
const school = (siteConfig().shortName || siteConfig().name || "la escuela");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleString("es-CL", { timeZone }), "·", ...a);
const hourNow = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
const isQuiet = () => { const h = hourNow(); return QUIET_FROM > QUIET_TO ? (h >= QUIET_FROM || h < QUIET_TO) : (h >= QUIET_FROM && h < QUIET_TO); };

/* ---------- Firestore (solo lectura, más la marca reminderSentAt) ---------- */
function getDb() {
  const admin = require("firebase-admin");
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) {
    const f = path.join(ROOT, ".claude/service-account.json");
    if (!fs.existsSync(f)) throw new Error("Falta la cuenta de servicio: define FIREBASE_SERVICE_ACCOUNT o crea .claude/service-account.json");
    raw = fs.readFileSync(f, "utf8");
  }
  const cred = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin.firestore();
}

// Reservas confirmadas que empiezan dentro de las próximas REMIND_HOURS horas y aún no tienen recordatorio
async function dueBookings(db) {
  const today = T.todayIn(timeZone);
  const now = Date.now(), limit = now + REMIND_HOURS * 3600e3;
  const snap = await db.collection("bookings").where("date", ">=", today).where("date", "<=", T.addDays(today, 1)).get();
  return snap.docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter(b => b.status === "confirmed" && !b.reminderSentAt && !b.reminderError)
    .filter(b => { const t = new Date(b.startAt).getTime(); return t > now && t <= limit; })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/* ---------- Mensaje ---------- */
const dayWord = date => { const t = T.todayIn(timeZone); return date === t ? "hoy" : date === T.addDays(t, 1) ? "mañana" : "el " + date; };
const firstName = n => String(n || "").trim().split(/\s+/)[0] || "";
function messageFor(b) {
  const when = Math.round((new Date(b.startAt).getTime() - Date.now()) / 60000);
  const hasta = when >= 90 ? `en unas ${Math.round(when / 60)} horas` : when >= 45 ? "en menos de una hora" : "muy pronto";
  const lines = [
    `Hola ${firstName(b.name)} 👋, te recordamos tu clase de *${b.classLabel}* ${dayWord(b.date)} a las *${b.start}* (${hasta}) en ${school}.`,
    "Llega 10 minutos antes. ¡Te esperamos! 🥋"
  ];
  if (SITE_URL) lines.push("", `¿No puedes venir? Cámbiala o cancélala aquí para liberar tu cupo: ${SITE_URL}/reserva?t=${b.id}`);
  return lines.join("\n");
}

/* ---------- WhatsApp ---------- */
async function startWhatsApp() {
  const { Client, LocalAuth } = require("whatsapp-web.js");
  const qrcode = require("qrcode-terminal");
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, ".wwebjs_auth") }),   // la sesión queda guardada: el QR se escanea una vez
    puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
  });
  client.on("qr", qr => { log("Escanea este QR con WhatsApp → Dispositivos vinculados:"); qrcode.generate(qr, { small: true }); });
  client.on("authenticated", () => log("Sesión de WhatsApp autenticada"));
  client.on("auth_failure", m => log("Falló la autenticación:", m));
  client.on("disconnected", r => log("WhatsApp se desconectó:", r));
  await new Promise((resolve, reject) => {
    client.once("ready", resolve);
    client.initialize().catch(reject);
  });
  log("WhatsApp listo");
  return client;
}

async function sendTo(client, waPhone, text) {
  const id = await client.getNumberId(waPhone);        // null si el número no tiene WhatsApp
  if (!id) return { ok: false, error: "el número no tiene WhatsApp" };
  await client.sendMessage(id._serialized, text);
  return { ok: true };
}

/* ---------- Vuelta ---------- */
async function pass(db, client) {
  if (isQuiet()) { log(`Horario de silencio (${QUIET_FROM}:00–${QUIET_TO}:00): no se envía nada`); return; }
  const due = await dueBookings(db);
  log(`${due.length} recordatorio(s) pendiente(s)${due.length > MAX_PER_RUN ? ` (se envían ${MAX_PER_RUN} en esta vuelta)` : ""}`);
  let sent = 0;
  for (const b of due.slice(0, MAX_PER_RUN)) {
    const text = messageFor(b);
    if (DRY) { console.log(`\n→ ${b.name} (+${b.waPhone}) · ${b.classLabel} ${b.date} ${b.start}\n${text}\n`); continue; }
    try {
      const r = await sendTo(client, b.waPhone, text);
      if (r.ok) { await b.ref.update({ reminderSentAt: new Date().toISOString(), reminderChannel: "whatsapp" }); sent++; log("Enviado a", b.name); }
      else { await b.ref.update({ reminderError: r.error }); log("Omitido", b.name, "—", r.error); }
    } catch (e) { log("Error con", b.name, "—", e.message); }   // sin marca: se reintenta en la próxima vuelta
    await sleep(8000 + Math.random() * 12000);                  // pausa entre mensajes para no parecer un robot
  }
  if (!DRY) log(`Vuelta lista: ${sent} enviado(s)`);
}

(async () => {
  if (TEST_TO) {
    const client = await startWhatsApp();
    const r = await sendTo(client, TEST_TO.replace(/\D/g, ""), `Mensaje de prueba de ${school} ✅ (recordatorios por WhatsApp)`);
    log(r.ok ? "Mensaje de prueba enviado" : "No se pudo enviar: " + r.error);
    await client.destroy(); process.exit(r.ok ? 0 : 1);
  }
  const db = getDb();
  const client = DRY ? null : await startWhatsApp();
  await pass(db, client);
  if (DRY || ONCE) { if (client) await client.destroy(); process.exit(0); }
  log(`Revisando cada ${EVERY_MS / 60000} minutos. Ctrl+C para salir.`);
  setInterval(() => pass(db, client).catch(e => log("Error en la vuelta:", e.message)), EVERY_MS);
})().catch(e => { console.error(e); process.exit(1); });

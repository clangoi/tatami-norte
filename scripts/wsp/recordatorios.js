/* ==========================================================
   Kizuna · Recordatorios de clase por WhatsApp (WhatsApp Web automatizado)
   Avisa por WhatsApp a quienes tienen una reserva confirmada 4 horas antes de la clase. Cada clase
   es un lote: llegada la hora, se escribe a todos sus inscritos, con 50 a 80 segundos entre mensajes.
   Si las 4 horas caen antes de las 08:00, el lote sale a las 08:00 (una clase que empieza antes de
   las 08:00 no recibe recordatorio, porque sería tarde).

   OJO: automatizar WhatsApp Web va contra los términos de WhatsApp y el número puede ser
   bloqueado. Por eso el script es prudente: solo escribe a personas que reservaron una clase,
   espacia los mensajes (50 a 80 s), tiene tope por vuelta y no envía de noche. Úsalo con un número
   que puedas arriesgar o, mejor, pasa a la API oficial de WhatsApp Business.

   Uso (desde esta carpeta, ver WHATSAPP.md):
     node recordatorios.js --dry          muestra qué enviaría, sin abrir WhatsApp ni marcar nada
     node recordatorios.js --test 569XXXXXXXX   envía un mensaje de prueba a ese número
     node recordatorios.js --once         una sola vuelta (por ejemplo desde el Programador de tareas)
     node recordatorios.js                se queda corriendo y revisa cada 5 minutos

   Variables de entorno (todas opcionales):
     SITE_URL            https://tu-sitio.cl  (para el enlace de cambiar o cancelar)
     REMIND_HOURS        horas antes de la clase (4)
     EARLIEST_HOUR       hora más temprana a la que sale un lote (8; hora de la escuela)
     QUIET_FROM          desde esta hora no se envía nada (22)
     MAX_PER_RUN         tope de mensajes por vuelta (60)
     WSP_SESSION_DIR     dónde se guarda la sesión de WhatsApp (por defecto ~/.kizuna-wsp-sesion; sin espacios en la ruta)
     FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio; si no, se usa .claude/service-account.json
   ========================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
process.chdir(ROOT);                       // las funciones de api/ leen site.config.js desde la raíz

const arg = n => process.argv.includes(n);
const argVal = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const DRY = arg("--dry"), ONCE = arg("--once"), TEST_TO = argVal("--test");

const REMIND_HOURS = Number(process.env.REMIND_HOURS) || 4;
const EARLIEST_HOUR = process.env.EARLIEST_HOUR !== undefined ? Number(process.env.EARLIEST_HOUR) : 8;
const QUIET_FROM = process.env.QUIET_FROM !== undefined ? Number(process.env.QUIET_FROM) : 22;
const PAUSE_MIN_S = 50, PAUSE_MAX_S = 80;   // pausa entre mensajes
const MAX_PER_RUN = Number(process.env.MAX_PER_RUN) || 60;
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
const EVERY_MS = 5 * 60 * 1000;

const { siteConfig, bookingSettings } = require(path.join(ROOT, "api/_lib/config.js"));
const T = require(path.join(ROOT, "api/_lib/time.js"));
const { timeZone } = bookingSettings();
const school = (siteConfig().shortName || siteConfig().name || "la escuela");

// FAKE_NOW=2026-10-14T17:00:00Z sirve para probar el reloj sin esperar (solo para pruebas)
const nowMs = () => (process.env.FAKE_NOW ? Date.parse(process.env.FAKE_NOW) : Date.now());
// La sesión de WhatsApp se guarda en la carpeta del usuario: con una ruta con espacios (como esta carpeta del proyecto) el navegador falla
const SESSION_DIR = process.env.WSP_SESSION_DIR || path.join(require("os").homedir(), ".kizuna-wsp-sesion");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleString("es-CL", { timeZone }), "·", ...a);
const hourNow = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(nowMs())));
const isQuiet = () => { const h = hourNow(); return h >= QUIET_FROM || h < EARLIEST_HOUR; };

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

// Hora en que sale el lote de una clase: REMIND_HOURS antes, pero nunca antes de EARLIEST_HOUR de ese día
const sendAtOf = b => Math.max(new Date(b.startAt).getTime() - REMIND_HOURS * 3600e3,
  T.zonedToUtc(b.date, String(EARLIEST_HOUR).padStart(2, "0") + ":00", timeZone));

// Reservas confirmadas de clases de hoy cuyo lote ya debe salir (y que no han empezado) y sin recordatorio
async function dueBookings(db) {
  const today = T.todayIn(timeZone, nowMs());
  const now = nowMs();
  const snap = await db.collection("bookings").where("date", "==", today).get();
  return snap.docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter(b => b.status === "confirmed" && !b.reminderSentAt && !b.reminderError)
    .filter(b => { const start = new Date(b.startAt).getTime(); return now >= sendAtOf(b) && now < start; })
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || (a.createdAt || "").localeCompare(b.createdAt || ""));
}

/* ---------- Mensaje ---------- */
const dayWord = date => { const t = T.todayIn(timeZone, nowMs()); return date === t ? "hoy" : date === T.addDays(t, 1) ? "mañana" : "el " + date; };
const firstName = n => String(n || "").trim().split(/\s+/)[0] || "";
// El texto lo edita la escuela en el panel (Clases → Configuración → Mensaje de WhatsApp) y se guarda en
// settings/catalog.waTemplate. Datos disponibles: {nombre} {clase} {dia} {hora} {cuando} {escuela} {enlace}
const DEFAULT_TEMPLATE = "Hola {nombre} 👋, te recordamos tu clase de *{clase}* {dia} a las *{hora}* ({cuando}) en {escuela}.\nLlega 10 minutos antes. ¡Te esperamos! 🥋\n\n¿No puedes venir? Cámbiala o cancélala aquí para liberar tu cupo: {enlace}";
async function loadTemplate(db) {
  try { const snap = await db.collection("settings").doc("catalog").get(); const t = snap.exists && snap.data().waTemplate; return (t && String(t).trim()) || DEFAULT_TEMPLATE; }
  catch (e) { log("No se pudo leer el mensaje del panel; se usa el original:", e.message); return DEFAULT_TEMPLATE; }
}
function messageFor(b, template) {
  const when = Math.round((new Date(b.startAt).getTime() - nowMs()) / 60000);
  const cuando = when >= 90 ? `en unas ${Math.round(when / 60)} horas` : when >= 45 ? "en menos de una hora" : "muy pronto";
  const link = SITE_URL ? `${SITE_URL}/reserva?t=${b.id}` : "";
  const data = { nombre: firstName(b.name), clase: b.classLabel, dia: dayWord(b.date), hora: b.start, cuando, escuela: school, enlace: link };
  // sin SITE_URL no hay enlace: se quita la línea que lo menciona para no dejar un texto cortado
  const text = link ? template : template.split("\n").filter(l => !l.includes("{enlace}")).join("\n");
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in data ? data[k] : m)).replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------- WhatsApp ---------- */
async function startWhatsApp() {
  const { Client, LocalAuth } = require("whatsapp-web.js");
  const qrcode = require("qrcode-terminal");
  // WhatsApp Web a veces se recarga mientras el script se engancha («Execution context was destroyed»): se reintenta
  for (let attempt = 1; attempt <= 4; attempt++) {
    const client = new Client({
      // WhatsApp Web rechaza a «HeadlessChrome» («actualiza Chrome»): se presenta como un Chrome normal
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),   // la sesión queda guardada: el QR se escanea una vez
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
    });
    client.on("qr", qr => { log("Escanea este QR con WhatsApp → Dispositivos vinculados:"); qrcode.generate(qr, { small: true }); });
    client.on("authenticated", () => log("Sesión de WhatsApp autenticada"));
    client.on("auth_failure", m => log("Falló la autenticación:", m));
    client.on("disconnected", r => log("WhatsApp se desconectó:", r));
    try {
      await new Promise((resolve, reject) => {
        client.once("ready", resolve);
        client.initialize().catch(reject);
      });
      log("WhatsApp listo");
      return client;
    } catch (e) {
      log(`No se pudo iniciar WhatsApp (intento ${attempt}/4): ${e.message}`);
      try { await client.destroy(); } catch (_) {}
      if (attempt === 4) throw e;
      await sleep(4000);
    }
  }
}

async function sendTo(client, waPhone, text) {
  const id = await client.getNumberId(waPhone);        // null si el número no tiene WhatsApp
  if (!id) return { ok: false, error: "el número no tiene WhatsApp" };
  await client.sendMessage(id._serialized, text);
  return { ok: true };
}

/* ---------- Vuelta ---------- */
async function pass(db, client) {
  if (isQuiet()) { log(`Fuera de horario (solo entre las ${EARLIEST_HOUR}:00 y las ${QUIET_FROM}:00): no se envía nada`); return; }
  const due = await dueBookings(db);
  const template = await loadTemplate(db);
  log(`${due.length} recordatorio(s) pendiente(s)${due.length > MAX_PER_RUN ? ` (se envían ${MAX_PER_RUN} en esta vuelta)` : ""}`);
  let sent = 0;
  for (const b of due.slice(0, MAX_PER_RUN)) {
    const text = messageFor(b, template);
    if (DRY) { console.log(`\n→ ${b.name} (+${b.waPhone}) · ${b.classLabel} ${b.date} ${b.start}\n${text}\n`); continue; }
    try {
      const r = await sendTo(client, b.waPhone, text);
      if (r.ok) { await b.ref.update({ reminderSentAt: new Date().toISOString(), reminderChannel: "whatsapp" }); sent++; log("Enviado a", b.name); }
      else { await b.ref.update({ reminderError: r.error }); log("Omitido", b.name, "—", r.error); }
    } catch (e) { log("Error con", b.name, "—", e.message); }   // sin marca: se reintenta en la próxima vuelta
    await sleep((PAUSE_MIN_S + Math.random() * (PAUSE_MAX_S - PAUSE_MIN_S)) * 1000);   // pausa de 50 a 80 s entre mensajes
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
  let running = false;
  setInterval(async () => {
    if (running) return;               // un lote largo puede durar más de 5 minutos: no se encima otro
    running = true;
    try { await pass(db, client); } catch (e) { log("Error en la vuelta:", e.message); } finally { running = false; }
  }, EVERY_MS);
})().catch(e => { console.error(e); process.exit(1); });

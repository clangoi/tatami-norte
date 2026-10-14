// Previsualización local de las reservas, sin Firebase ni Vercel.
// Sirve el sitio y las funciones de api/ contra una base de datos en memoria
// con unas clases de ejemplo. Uso: node .claude/dev.js   (puerto 5174)
// Los datos se pierden al detener el servidor. Los correos no se envían.
// Para ver el horario REAL del panel: guarda la cuenta de servicio de Firebase en .claude/service-account.json
// (o defínela en FIREBASE_SERVICE_ACCOUNT) y ejecuta `npm install` una vez. Entonces se usa tu Firestore real
// (las reservas que hagas en local también se guardan ahí).
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
process.chdir(root);

/* ---------- Firestore falso (lo justo que usan las funciones) ---------- */
const store = {};   // colección → Map(id → datos)
const col = name => (store[name] = store[name] || new Map());
const snapOf = (name, id) => ({ id, exists: col(name).has(id), data: () => structuredClone(col(name).get(id)) });

function query(name, filters = []) {
  const run = () => [...col(name)].filter(([, d]) => filters.every(([f, op, v]) =>
    op === "==" ? d[f] === v : op === ">=" ? d[f] >= v : op === "<=" ? d[f] <= v : false));
  return {
    where: (f, op, v) => query(name, [...filters, [f, op, v]]),
    _docs: () => run().map(([id]) => snapOf(name, id)),
    get: async () => ({ docs: run().map(([id]) => snapOf(name, id)) })
  };
}
const ref = (name, id) => ({
  id, _name: name,
  get: async () => snapOf(name, id),
  set: async d => { col(name).set(id, structuredClone(d)); },
  update: async p => { col(name).set(id, { ...col(name).get(id), ...structuredClone(p) }); }
});
const db = {
  collection: name => ({ ...query(name), doc: id => ref(name, id) }),
  runTransaction: async fn => {
    const writes = [];
    const tx = {
      get: async x => (x._docs ? { docs: x._docs() } : snapOf(x._name, x.id)),
      set: (r, d) => writes.push(() => r.set(d)),
      update: (r, p) => writes.push(() => r.update(p))
    };
    const out = await fn(tx);
    for (const w of writes) await w();
    return out;
  }
};
const saFile = path.join(__dirname, "service-account.json");
const REAL = !process.env.DEV_FAKE && !!(process.env.FIREBASE_SERVICE_ACCOUNT || fs.existsSync(saFile));   // DEV_FAKE=1 fuerza la base de datos falsa
if (REAL) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) process.env.FIREBASE_SERVICE_ACCOUNT = fs.readFileSync(saFile, "utf8");
  console.log("Usando el Firestore real (horario del panel). Las reservas de prueba también se guardan ahí.");
} else {
  require.cache[require.resolve("../api/_lib/firebase.js")] = { exports: { getDb: () => db }, loaded: true, id: "fake" };
}

/* ---------- Datos de ejemplo ---------- */
const put = (name, id, d) => { if (!REAL) col(name).set(id, d); };
put("classes", "judo", { label: "Judo", tone: "oro", page: "judo.html", capacity: 3, duration: 60, order: 1, active: true });
put("classes", "jiu-jitsu-gi", { label: "BJJ Gi · Kizuna", tone: "bronce", page: "bjj.html", capacity: 15, duration: 90, order: 2, active: true });
put("classes", "judo-kids", { label: "Judo Kids", tone: "plata", page: "judo.html", capacity: 12, duration: 45, order: 3, active: true });
[["lunes", "19:00"], ["miercoles", "19:00"], ["sabado", "11:00"]].forEach(([day, start]) => put("slots", `judo-${day}`, { classId: "judo", day, start, active: true }));
[["martes", "20:00"], ["jueves", "20:00"]].forEach(([day, start]) => put("slots", `bjj-${day}`, { classId: "jiu-jitsu-gi", day, start, active: true }));
put("slots", "kids-sabado", { classId: "judo-kids", day: "sabado", start: "10:00", active: true });

/* ---------- Servidor ---------- */
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const m = /^\/api\/([a-z]+)$/.exec(url.pathname);
  if (m && fs.existsSync(path.join(root, "api", m[1] + ".js"))) {
    let raw = "";
    for await (const c of req) raw += c;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = o => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    res.send = s => res.end(s);
    return require(path.join(root, "api", m[1] + ".js"))(req, res);
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(+process.env.PORT || 5174, () => console.log("Reservas de prueba en http://localhost:" + (+process.env.PORT || 5174)));

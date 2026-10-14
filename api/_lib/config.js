/* Lee site.config.js (es un script de navegador: se evalúa con un window falso) */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let cached;
function siteConfig() {
  if (cached) return cached;
  const code = fs.readFileSync(path.join(process.cwd(), "site.config.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  cached = sandbox.window.SITE_CONFIG;
  return cached;
}

// Ajustes de reservas con sus valores por defecto
function bookingSettings() {
  const c = (siteConfig().booking) || {};
  return {
    timeZone: c.timeZone || "America/Santiago",
    minNoticeMinutes: Number.isFinite(c.minNoticeMinutes) ? c.minNoticeMinutes : 120,
    defaultCapacity: c.defaultCapacity || 15
  };
}

module.exports = { siteConfig, bookingSettings };

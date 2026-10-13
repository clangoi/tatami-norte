/* Utilidades comunes de las funciones de reservas */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Envuelve un manejador: devuelve JSON y traduce HttpError a su código
function handler(methods, fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!methods.includes(req.method)) {
      res.setHeader("Allow", methods.join(", "));
      return res.status(405).json({ error: "Método no permitido." });
    }
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: "Algo salió mal. Intenta de nuevo en un rato." });
    }
  };
}

const siteUrl = req => `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

module.exports = { HttpError, handler, siteUrl };

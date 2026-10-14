# Recordatorios por WhatsApp

Script que avisa por WhatsApp a quienes tienen una **reserva confirmada** unas horas antes de su clase. Vive en `scripts/wsp/` y **se ejecuta en un computador** (no en Vercel): controla WhatsApp Web, como un navegador.

> **Riesgo:** automatizar WhatsApp Web va contra los términos de WhatsApp y el número puede ser bloqueado. El script es prudente (solo escribe a quien reservó, pausa de 50 a 80 s entre mensajes, tope por vuelta y horario de silencio), pero el riesgo no desaparece. Para algo estable, la alternativa es la API oficial de WhatsApp Business (Cloud API de Meta).

## Instalación (una vez)

```bash
cd scripts/wsp
npm install
```

Descarga Chromium (unos 170 MB). Además necesita la cuenta de servicio de Firebase: `.claude/service-account.json` (ya ignorada por git) o la variable `FIREBASE_SERVICE_ACCOUNT`.

## Uso

```bash
node recordatorios.js --dry                 # muestra qué enviaría, sin abrir WhatsApp ni marcar nada
node recordatorios.js --test 569XXXXXXXX    # mensaje de prueba a tu propio número (pide escanear el QR la primera vez)
node recordatorios.js --once                # una sola vuelta (para el Programador de tareas)
node recordatorios.js                       # queda corriendo y revisa cada 5 minutos
```

La primera vez aparece un **QR** en la terminal: escanéalo con WhatsApp → *Dispositivos vinculados*. La sesión queda guardada en `scripts/wsp/.wwebjs_auth` y no hay que repetirlo.

## Qué envía y cuándo

- Cada clase es un **lote**: **4 horas antes** de que empiece, se escribe a todos sus inscritos confirmados (`REMIND_HOURS`).
- Si esas 4 horas caen **antes de las 08:00**, el lote sale **a las 08:00** (`EARLIEST_HOUR`). Una clase que empieza antes de las 08:00 no recibe recordatorio, porque llegaría tarde.
- Entre un mensaje y el siguiente hay una pausa aleatoria de **50 a 80 segundos**. Un lote de 15 personas tarda unos 16 minutos, y si hay varias clases a la misma hora, los lotes salen uno tras otro.
- No envía nada desde las 22:00 hasta las 08:00 (`QUIET_FROM`), ni más de 60 mensajes por vuelta (`MAX_PER_RUN`).
- Texto: nombre, clase, hora (hoy) y el enlace `/reserva?t=…` para cambiar o cancelar, si defines `SITE_URL`.
- Al enviar marca la reserva con `reminderSentAt`, así que nunca repite. Si el número no tiene WhatsApp, la marca con `reminderError` y no insiste. Un error de red no marca nada: se reintenta en la siguiente vuelta.

Variables: `SITE_URL`, `REMIND_HOURS`, `EARLIEST_HOUR`, `QUIET_FROM`, `MAX_PER_RUN`, `FIREBASE_SERVICE_ACCOUNT`. Ejemplo en PowerShell:

```powershell
$env:SITE_URL = "https://tu-sitio.cl"; node recordatorios.js
```

El texto del mensaje está en `messageFor()` de `recordatorios.js`.

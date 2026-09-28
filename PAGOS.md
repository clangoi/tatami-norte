# Pagos con Mercado Pago

El botón **Suscribirme** de cada plan abre un formulario (nombre, correo, fecha de inicio) y después lleva al checkout de Mercado Pago con el plan y el periodo ya elegidos. Ahí se puede pagar con crédito, débito o los otros medios que tenga activos tu cuenta.

- **Mensual**: cobra un mes del plan.
- **Anual**: cobra 12 meses con el descuento de `site.config.js` → `annualDiscount`.

El precio lo calcula el servidor (`api/pagar.js`) con los planes del panel (`/admin`) o, si no hay, con `site.config.js` → `prices`. Un plan sin precio muestra "Consultar precio" y no se puede pagar en línea.

## Configuración (una sola vez)

1. Entra a [mercadopago.cl/developers/panel](https://www.mercadopago.cl/developers/panel) con la cuenta de Mercado Pago que va a **recibir** el dinero.
2. **Crear aplicación** → tipo *Pagos online* → producto **Checkout Pro**.
3. En la aplicación → **Credenciales de producción** → copia el **Access Token** (empieza con `APP_USR-`).
4. En Vercel → el proyecto → **Settings → Environment Variables** → agrega:
   - Nombre: `MP_ACCESS_TOKEN`
   - Valor: el Access Token
   - Entornos: Production (y Preview si quieres probar ahí)
5. **Deployments → Redeploy** para que tome la variable.

Mientras la variable no exista, el formulario muestra "Los pagos en línea aún no están activos" y no cobra nada.

> El Access Token es secreto: nunca lo pongas en `site.config.js` ni en ningún archivo del repositorio.

## Probar sin cobrar

En el panel de Mercado Pago → **Cuentas de prueba** crea un vendedor y un comprador. Usa el Access Token de **prueba** del vendedor en `MP_ACCESS_TOKEN` (entorno Preview) y paga con el comprador y las [tarjetas de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards). Después cambia al token de producción.

La función no corre con `python -m http.server`; se prueba en Vercel (o con `vercel dev`).

## Dónde ver los pagos

En tu cuenta de Mercado Pago → **Actividad**. Cada pago trae:

- El nombre del plan y el periodo en el detalle.
- En **Referencia externa**: `plan|periodo|fecha de inicio|correo|UID`, p. ej. `ilim|mes|2026-10-01|ana@correo.cl|Xk3…`. El UID identifica la cuenta del deportista (ver `DEPORTISTAS.md`).

Mercado Pago le envía el comprobante al alumno, y a ti un aviso por cada pago recibido.

## Registro automático en el panel (webhook)

Cuando un pago se aprueba, Mercado Pago avisa a `/api/mp-webhook`. La función vuelve a consultar el pago a Mercado Pago (nunca confía en el aviso) y:

- Lo guarda en la ficha del deportista (`/admin` → Deportistas y `/cuenta`), con el medio "Mercado Pago".
- **Extiende su membresía**: 1 mes si pagó mensual, 12 si pagó anual. Se suma desde su vencimiento si sigue al día, o desde hoy si estaba vencida. También actualiza su plan.
- Busca al deportista por su cuenta (UID) y, si no calza, por el correo. Si nadie calza, el pago aparece en el panel como **"sin cuenta asociada"** para registrarlo a mano.
- Si el pago se reembolsa o tiene contracargo, lo marca como tal. La fecha de la membresía no se toca: ajústala a mano si corresponde.
- Mercado Pago puede avisar varias veces del mismo pago; se registra una sola vez.

### Configuración (una sola vez)

**1. Cuenta de servicio de Firebase** (permite a la función escribir en Firestore)

1. [Consola de Firebase](https://console.firebase.google.com) → proyecto `kizuna-admin-25951` → ⚙️ **Configuración del proyecto** → **Cuentas de servicio**.
2. **Generar nueva clave privada** → se descarga un archivo `.json`.
3. En Vercel → **Settings → Environment Variables** → agrega `FIREBASE_SERVICE_ACCOUNT` y pega **todo el contenido** del archivo.
4. Guarda el archivo en un lugar seguro o bórralo. **Nunca lo subas al repositorio**: da acceso total a la base de datos.

**2. Webhook en Mercado Pago**

1. [Panel de developers](https://www.mercadopago.cl/developers/panel) → tu aplicación → **Webhooks** → **Configurar notificaciones**.
2. **Modo productivo** → URL: `https://<tu-dominio>/api/mp-webhook`.
3. Eventos: marca **Pagos**. Guarda.
4. Copia la **clave secreta** que aparece y agrégala en Vercel como `MP_WEBHOOK_SECRET`.

**3. Redeploy** en Vercel para que tome las variables nuevas.

### Probar

- En Mercado Pago → Webhooks → **Simular notificación**. Con un id inventado la función responde "ignorado" (el pago no existe): sirve para confirmar que la URL y la clave secreta funcionan.
- Para una prueba completa, usa las cuentas de prueba (arriba) con una cuenta de deportista creada en `/cuenta`: al aprobarse el pago, su membresía debería aparecer extendida en `/cuenta`.
- Los resultados quedan en Vercel → **Logs** (función `api/mp-webhook`): `Pago 123: registrado`, `repetido` o `sin deportista`.

## Qué ve el alumno al volver

Mercado Pago lo devuelve a `/?pago=ok`, `/?pago=pendiente` o `/?pago=error`, y el sitio le muestra un mensaje según el resultado.

## Pendiente (si se necesita más adelante)

- **Cobro automático cada mes** (suscripción de Mercado Pago): hoy cada mes se paga por separado.

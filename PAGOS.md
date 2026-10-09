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
- En **Referencia externa**: `plan|periodo|fecha de inicio|correo`, p. ej. `ilim|mes|2026-10-01|ana@correo.cl`.

Mercado Pago le envía el comprobante al alumno, y a ti un aviso por cada pago recibido.

## Qué ve el alumno al volver

Mercado Pago lo devuelve a `/?pago=ok`, `/?pago=pendiente` o `/?pago=error`, y el sitio le muestra un mensaje según el resultado.

## Pendiente (si se necesita más adelante)

- **Cobro automático cada mes** (suscripción de Mercado Pago): hoy cada mes se paga por separado.
- **Registro automático de pagos** (webhook de Mercado Pago): hoy los pagos se revisan en la cuenta de Mercado Pago.

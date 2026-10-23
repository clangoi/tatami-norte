# Reservas propias

Las clases, los horarios y los cupos se administran en `/admin` → **Clases**; las personas reservan en la portada y en las páginas de Judo y BJJ, y gestionan su reserva desde el enlace del correo (`/reserva?t=…`).

## Qué hace

| Necesidad | Cómo |
|---|---|
| Guardar nombre y teléfono | Cada reserva guarda nombre, teléfono y correo en Firestore (`bookings`). El formulario pide esos tres datos; el apodo ya no se pide (las reservas antiguas lo conservan). |
| Reagendar o cancelar | Enlace único en el correo de confirmación → `/reserva?t=…`; los deportistas con cuenta lo hacen desde su panel (`/deportista`). La portada ya no lista «Tus reservas». |
| Motivo obligatorio | El formulario y el servidor lo exigen (mínimo 3 letras) al cancelar y al reprogramar. |
| Nombres de los asistentes | La lista de cada clase muestra el apodo, o nombre + inicial del apellido («Camila R.»). Nunca teléfono ni correo. Se actualiza sola cada 30 s. |
| Confirmación | Por correo (Brevo), con la invitación `.ics` adjunta. Ver más abajo por qué no es por WhatsApp. |
| Calendario de la persona | Botón «Añadir a Google Calendar», archivo `.ics` (Apple, Outlook) y el adjunto del correo. |
| Calendario de la escuela | Suscripción `.ics` con todas las clases y sus inscritos, más un correo de aviso por cada reserva, cambio o cancelación. |
| Panel | **Clases → Inscritos**: quién está inscrito, quién cambió de hora y quién canceló, cada uno con su motivo. |

### WhatsApp

La confirmación automática por WhatsApp exige la API de pago de Meta, así que la confirmación es **por correo** (por eso el correo es obligatorio al reservar). Solo la escuela escribe por WhatsApp, y sin costo:

- En el panel (Clases → Inscritos), el botón **WhatsApp** de cada inscrito abre un chat con esa persona, con el mensaje escrito, desde tu WhatsApp Business.

## Puesta en marcha (una sola vez)

### 1. Cuenta de servicio de Firebase

Las funciones de `api/` escriben las reservas con permisos de administrador.

1. [Consola de Firebase](https://console.firebase.google.com) → ⚙ **Configuración del proyecto** → **Cuentas de servicio** → **Generar nueva clave privada**. Descarga un `.json`.
2. En Vercel → **Settings → Environment Variables**, crea `FIREBASE_SERVICE_ACCOUNT` y pega **todo el contenido** del `.json`.
3. No subas ese archivo al repositorio.

### 2. Reglas de Firestore

Vuelve a publicar `firestore.rules` (Firestore → Reglas → Publicar). Las nuevas cierran `bookings` al público y dejan a los admins administrar `classes`, `slots` y `closures`.

### 3. Correo (Brevo, gratis hasta 300 al día)

1. Crea una cuenta en [brevo.com](https://www.brevo.com) → **Senders, Domains & Dedicated IPs → Senders** → agrega y verifica el correo desde el que enviarás.
2. **SMTP & API → API Keys** → crea una llave.
3. En Vercel agrega:

| Variable | Valor |
|---|---|
| `BREVO_API_KEY` | la llave |
| `MAIL_FROM` | el correo verificado |
| `MAIL_FROM_NAME` | opcional; por defecto «Kizuna» |
| `ADMIN_NOTIFY_EMAIL` | opcional; recibe un aviso de cada reserva, cambio o cancelación, con su `.ics` |

Sin estas variables las reservas funcionan igual, pero sin correo (la pantalla de confirmación avisa que guarden el enlace).

### 4. Calendario de la escuela

En Vercel agrega `CALENDAR_FEED_SECRET` con un texto largo al azar. Luego suscríbete (Google Calendar → Otros calendarios → **Desde URL**; Apple Calendar → Archivo → Nueva suscripción):

```
https://TU-SITIO/api/calendario?feed=EL_SECRETO
```

Cada clase aparece como «Judo (3/15)» y en la descripción lista a los inscritos con su teléfono. **Quien tenga ese enlace ve esos datos: no lo compartas.** Los calendarios se refrescan solos cada algunas horas (Google puede tardar hasta un día); para cambiarlo, cambia el secreto.

### 5. Cargar las clases

1. `/admin` → **Clases → Clases** → **Cargar las clases de siempre** (trae las de `site.config.js`) y ajusta duración, cupos y colores.
   Antes, en `/admin` → **Clases → Configuración**, define los **clubes** (color de la franja lateral), las **disciplinas** (color y página donde se listan sus clases, por ejemplo `judo.html`) y los **tipos** (diseño del bloque). Al crear una clase solo eliges su disciplina, su tipo (opcional) y su club: el nombre («[disciplina] [tipo] · [Club]») y el código (`judo-no-gi-kizuna`) se arman solos. Si cambias algo en Configuración, se actualizan todas las clases que lo usan. Las páginas de Judo y BJJ muestran las clases cuya disciplina apunta a ellas. Requiere publicar `firestore.rules` (incluye `settings/catalog`).
2. **Horario semanal**: ubica cada clase en el día y la hora donde empieza.
3. **Cancelar una clase solo una semana**: toca la clase en el horario semanal, el tacho y elige «Solo esta semana». Queda inactiva únicamente ese día (se guarda como un cierre) y se puede reactivar desde la misma ventana. «De la planificación semanal» la quita de todas las semanas.
4. **Clase única**: al agregar una clase al horario se pregunta si es recurrente (se repite cada semana) o única (una sola fecha). Las únicas aparecen en el horario hasta que pasa su fecha.

El `código` de cada clase es el que usan `judo.html` y `bjj.html` en `TNBooking.mount(…, { slugs: [...] })` para mostrar solo sus clases.

## Cómo funcionan los cupos y los cambios

- Una **sesión** es un horario semanal en una fecha concreta. Se puede reservar **cualquier clase de la semana en curso y de la siguiente** (de lunes a domingo, hasta el domingo de la semana próxima), incluso una que ya pasó o ya empezó: sirve para inscribir a quien fue y no alcanzó a reservar. Las clases de semanas anteriores ya no se pueden reservar. Cancelar o reprogramar sí exige que la clase no haya pasado.
- El cupo se comprueba dentro de una transacción de Firestore: si dos personas toman el último cupo a la vez, una recibe «la clase se llenó».
- Una misma persona (mismo teléfono) no puede reservar dos veces la misma clase.
- **Reprogramar** solo permite otra hora de la misma clase. La reserva original queda como «reprogramada» (con su motivo) y se crea una nueva; en el panel ves ambas.
- **Cancelar** libera el cupo al instante. La reserva se conserva con su motivo.
- Cambiar o borrar un horario semanal afecta solo a fechas futuras; las reservas ya hechas no se mueven. Si cierras una clase que ya tenía inscritos, el panel la marca en rojo para que les avises.

## Probar en tu computador

```bash
node .claude/dev.js
```

Abre `http://localhost:5174`. Usa una base de datos en memoria con unas clases de ejemplo (se pierde al detener el servidor) y no envía correos. Sirve para ver y probar el flujo completo de reserva, reprogramación y cancelación. El panel `/admin` necesita Firebase real.

## Pendiente para una segunda etapa

- Recordatorio automático antes de la clase (requiere un cron de Vercel).
- Avisar por correo a los inscritos cuando cierras una clase desde el panel (hoy los ves marcados y les escribes por WhatsApp).
- Límite de intentos contra abuso (hoy hay un campo trampa para bots; Vercel Firewall permite limitar `/api/reservar` por IP).
- Lista de espera cuando una clase se llena.

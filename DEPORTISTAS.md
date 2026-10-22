# Deportistas (panel personal)

Cada deportista tiene una cuenta y un panel personal en `/deportista`. Las cuentas **no se crean solas**: las crea el equipo desde `/admin` → **Deportistas**.

## Qué hace

| Necesidad | Cómo |
|---|---|
| Crear un deportista | Admin → Deportistas → **Nuevo deportista**. Se escribe el correo con el que se inscribe. El campo sugiere los correos de las reservas que aún no tienen cuenta (trae nombre y teléfono); también sirve un correo que no esté en las reservas (ahí se escribe el nombre). |
| Crear su clave | Al crear la cuenta le llega un correo con el botón **Crear mi clave** (enlace de Firebase). Admin → **Enviar enlace de clave** lo reenvía. Si el correo no está configurado, el panel muestra el enlace para copiarlo. |
| Restablecer la clave | En el login, **Olvidé mi clave** (escribe su correo); dentro del panel, **Cambiar mi clave**. En ambos casos recibe por correo (Brevo, con el diseño de la escuela) un enlace que vuelve a `/deportista`. Responde siempre igual exista o no la cuenta, y permite un enlace cada 2 minutos (`api/clave.js`). |
| Agendar rápido | Se agenda siempre desde el horario del sitio («Tu semana en el tatami», Judo y BJJ). Con la sesión iniciada no hay formulario: se muestran los datos de su cuenta y un botón «Confirmar reserva». Mismas reglas de cupo y los mismos correos que el resto del sitio. El panel `/deportista` no agenda. |
| Reagendar y cancelar | `/deportista` → **Próximas**. El motivo es obligatorio, igual que en `/reserva`. |
| Perfil editable | **Mi perfil** → «Mis datos»: nombre, apodo (sale en las listas de inscritos), teléfono y contacto de emergencia. El correo no se cambia desde aquí. |
| Grados por disciplina | Los asigna solo el equipo: admin → Deportistas → Editar → **Grados** (un campo por disciplina creada en Clases → Configuración, con sugerencias para BJJ y Judo y la fecha desde la que lo tiene). El deportista los ve en **Resumen → Mis grados**. |
| Ficha médica | **EN PAUSA** hasta tener la asesoría legal sobre datos de salud. El código está hecho pero apagado: `features.medicalRecord` en `site.config.js` (false). Mientras está apagada no se muestra en Mi perfil ni en admin, y el servidor rechaza guardarla. Para activarla, cambiar ese valor a `true` (y revisar antes el texto de consentimiento). Ver «Pendiente» abajo. |
| Asistencia real: encuesta | El deportista marca su asistencia **respondiendo la encuesta de la clase** (Resumen → «Clases por registrar», o desde el detalle de un día en Historial): qué tan cansado quedó del **1 al 10** y comentarios opcionales. Responderla implica que fue a la clase. Solo se puede responder cuando la clase ya terminó y dentro de 30 días; después, la marca el equipo. Solo cuentan reservas confirmadas suyas. |
| Marcar asistencia desde admin | Admin → **Asistencia** (pensado para el celular): las clases del día con sus inscritos, la respuesta de la encuesta de cada uno (cansancio y comentario) y el promedio de cansancio de la clase. Para quien olvidó responder: **Vino** / **Faltó** (tocar de nuevo desmarca). **Agregar a alguien que no reservó**: solo nombre (teléfono y correo opcionales), sin crear perfil; si da el correo de un deportista, cuenta en su historial. Si alguien respondió la encuesta y el equipo marca «Faltó», se conserva su respuesta pero deja de contar como asistencia, y ya no puede volver a responder. Se puede marcar de hoy y de días anteriores, no de futuros. Quien marca debe estar en `admins`. |
| Asistencias y grados | En **Resumen**, el deportista ve «Asistencias» (total y últimos 90 días) y, en cada grado, cuántas clases asistió desde que lo tiene. En el panel de admin cada deportista muestra sus asistencias. Son distintas de las «clases tomadas» (reservas pasadas), que no confirman que haya ido. |
| Historial | **Historial**: calendario mensual, vista mensual donde los días con clases se marcan con su cantidad. Al tocar uno se abre un detalle encima con las clases de ese día (hora, club, disciplina, tipo y si fue tomada, próxima o cancelada, con su motivo). No hay lista de historial aparte. También permite suscribir Google Calendar / Apple / Outlook a un enlace propio (`/api/calendario?a=…`): las reservas aparecen, cambian y se quitan solas. |
| Disciplinas, clubes y contadores | Salen solos de las clases que tomó (reservas confirmadas ya pasadas): contador por **club**, por **disciplina** y por **tipo**, más el total y las próximas. Nadie los asigna a mano. |

Las reservas de una persona se reconocen por su **correo** (sin importar mayúsculas), también las hechas antes de existir su cuenta. Eliminar un deportista le quita el acceso; sus reservas quedan en el historial de la escuela. Desactivarlo (Editar → «Cuenta activa») le impide entrar sin borrar nada.

## Puesta en marcha

Usa lo que ya está configurado para las reservas (`FIREBASE_SERVICE_ACCOUNT`, y `BREVO_API_KEY` / `MAIL_FROM` para los correos). Falta, una sola vez, en la consola de Firebase:

1. **Authentication → Sign-in method → Correo electrónico/contraseña**: debe estar activado (ya lo usa el panel).
2. **Authentication → Settings → Authorized domains**: agrega el dominio del sitio, para que el enlace de clave vuelva a `/deportista`.
3. La cuenta de servicio necesita el rol **Firebase Authentication Admin** (el rol por defecto «Firebase Admin SDK Administrator Service Agent» ya lo incluye).

No hace falta cambiar las reglas de Firestore: los deportistas nunca leen la base directamente, todo pasa por `api/deportista.js`, que valida su sesión.

## Datos y archivos

- `attendance/{sessionKey}__{id}` (Firestore): una asistencia por persona y clase (`present` true/false, `source` athlete|admin, `fatigue` 1-10 y `comment` de la encuesta, `walkIn`, `emailKey`). Solo la leen y escriben las funciones del servidor (`api/asistencia.js`).
- `athletes/{uid}` (Firestore): correo, nombre, teléfono, `active`, `calToken` (secreto de su calendario). El `uid` es el de Firebase Auth.
- `bookings` ahora guardan también `emailKey` (correo en minúsculas) para unir las reservas con la cuenta.
- `api/deportistas.js`: CRUD del panel (exige ser admin). `api/deportista.js`: panel personal (exige ser deportista activo). `api/_lib/athletes.js`: sesión y contadores.
- `deportista.html` + `js/deportista.js` + `css/pages/deportista.css`; pestaña en `js/admin-deportistas.js`.

## Pendiente

- **Ficha médica**: activar cuando haya asesoría legal (consentimiento, quién puede verla, plazo de conservación, menores de edad).
- **Quiénes pueden competir**: falta definir los criterios (por ejemplo: mínimo de asistencias en los últimos N días, tiempo mínimo en el grado actual, grado mínimo, ficha médica al día). Con los criterios definidos, el panel puede marcar a quienes cumplen en cada disciplina. Los datos que se necesitan (asistencias reales y grados con fecha) ya se guardan.

# Cuentas de deportistas

Cada deportista crea su cuenta en `tusitio.cl/cuenta`. Con ella:

- **Reserva clases y paga su plan.** Sin cuenta, el calendario muestra un aviso para entrar o registrarse. Con sesión iniciada, su nombre, correo y teléfono se completan solos en Cal.com.
- **Ve su membresía** (plan y fecha de vencimiento) y **sus pagos**.
- Edita sus datos: teléfono, RUT, fecha de nacimiento, disciplinas y contacto de emergencia.

En el panel (`/admin` → **Deportistas**) la escuela ve a todos, edita sus fichas y membresías, y **registra los pagos** a nombre de cada deportista.

## Configuración en Firebase (una sola vez)

### 1. Volver a permitir el registro

En el panel de admin se desactivó el registro para que nadie se creara cuentas. Ahora los deportistas sí lo necesitan:

**Authentication → Configuración → Acciones del usuario** → marca **Habilitar creación (registro)** → Guardar.

El panel admin sigue protegido: solo entra quien esté en la colección `admins`.

### 2. Publicar las reglas nuevas

**Firestore Database → Reglas** → borra todo, pega el contenido actualizado de `firestore.rules` → **Publicar**.

Sin este paso, crear cuentas y registrar pagos falla con "permiso denegado".

### 3. Correos en español (recomendado)

**Authentication → Plantillas** → ícono de lápiz → **Idioma de la plantilla: español**. Aplica al correo de confirmación y al de cambio de contraseña.

## Uso diario

### Registrar un pago

1. `/admin` → **Deportistas** → busca a la persona → **Ver ficha**.
2. En **Registrar pago**: fecha, monto, medio de pago y plan (el monto se sugiere según el precio del plan).
3. Deja marcado **Extender la membresía** y elige los meses. La nueva fecha se calcula desde el vencimiento actual si sigue al día, o desde hoy si estaba vencida.

El deportista ve el pago y su nueva fecha de vencimiento en `/cuenta`.

### Estados de la membresía

| Estado | Cuándo |
|---|---|
| Al día | La fecha de vencimiento es hoy o posterior |
| Vencida | La fecha ya pasó |
| Sin membresía | Nunca se le registró una fecha |
| Inactiva | La escuela desactivó la cuenta |

Reservar solo exige tener cuenta y perfil completo (nombre, apellido y teléfono), no la membresía al día, porque la primera clase es gratis.

### Borrar a alguien

- **El deportista** puede eliminar su cuenta desde `/cuenta`.
- **La escuela** puede borrar la ficha desde el panel. Los pagos se conservan. La cuenta de acceso se borra aparte en **Authentication → Usuarios**.

## Límites actuales

- **Los pagos de Mercado Pago se registran solos** y extienden la membresía (ver "Registro automático" en `PAGOS.md`). Los pagos en efectivo o por transferencia se registran a mano en el panel. Para suscribirse en línea hay que tener cuenta (`athletes.payRequiresAccount` en `site.config.js`).
- **El bloqueo del calendario es del sitio.** Alguien que conozca la dirección directa de Cal.com (`cal.com/hccombat/...`) podría reservar sin cuenta. Para impedirlo del todo hace falta revisar cada reserva contra la lista de deportistas con un webhook de Cal.com.
- **La escuela no crea cuentas desde el panel.** Requiere el Admin SDK de Firebase en una función de servidor.
- Para desactivar el requisito de cuenta, en `site.config.js` → `booking.requireAccount: false`.

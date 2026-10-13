# Panel de administración

`tusitio.cl/admin` sirve para escribir artículos del blog y editar los planes de suscripción sin tocar código. Los datos se guardan en Firebase (proyecto `kizuna-admin-25951`).

## Configuración inicial (una sola vez)

### 1. Authentication

En [la consola de Firebase](https://console.firebase.google.com) → **Authentication**:

- **Método de acceso** → habilita **Correo electrónico/contraseña**.
- **Configuración → Acciones del usuario** → desmarca **Habilitar creación (registro)**, para que nadie pueda crearse una cuenta.
- **Configuración → Dominios autorizados** → agrega el dominio de Vercel (p. ej. `tatami-norte.vercel.app`) y el dominio propio si lo hay.
- **Usuarios → Agregar usuario** → tu correo y una contraseña.

### 2. Firestore

- **Firestore Database → Crear base de datos** → ubicación `southamerica-east1 (São Paulo)` → **modo producción**.
- **Reglas** → borra lo que haya, pega el contenido de `firestore.rules` y presiona **Publicar**.

> Si la base ya existía de antes (con deportistas y pagos), igual vuelve a publicar las reglas: las nuevas cierran esas colecciones. Puedes borrar `athletes` y `payments` desde **Datos** si ya no las necesitas.

### 3. Darte permiso de admin

1. Entra a `/admin` con tu correo y contraseña. Te va a mostrar tu **UID** con un botón para copiarlo.
2. En **Firestore Database → Datos** → **Iniciar colección** → ID `admins`.
3. **ID del documento**: pega tu UID. Agrega un campo `email` (string) con tu correo. Guarda.
4. Recarga `/admin`.

Para sumar otra persona: créale un usuario en Authentication y repite el paso 3 con su UID. Para quitarle el acceso, borra su documento de `admins`.

## Uso

### Blog

- **Nuevo artículo** → escribe título, resumen, categoría y texto. La vista previa de la derecha muestra cómo va a quedar.
- Marca **Publicado** para que aparezca en el sitio; si no, queda como borrador.
- La dirección queda como `/blog/articulo?p=<direccion>`.
- Todos los artículos se editan y se borran desde el panel. La primera vez, **Cargar los artículos de siempre** copia al panel los cuatro que traía el sitio.
- Arriba de la lista puedes filtrar por **tema** y ordenar por fecha (más recientes / más antiguos), por título (A–Z / Z–A) o por tema. El blog público tiene los mismos filtros y orden.
- Imágenes y videos en el texto: `![descripción](/assets/images/foto.png "pie de foto")` y `@[título](ID_YOUTUBE?start=21&end=57 "pie")`.

### Temas

- La pestaña **Temas** crea, renombra y borra temas. Renombrar actualiza también los artículos que lo usan; un tema con artículos no se puede borrar.
- Al escribir un artículo, el tema se elige de la lista; **Nuevo tema** crea uno sin salir del editor.
- Para que funcione, vuelve a publicar `firestore.rules` (hay una regla nueva para `topics`).

Formato del texto:

```
## Subtítulo
Párrafo con **negrita**, *cursiva* y [un enlace](https://…).

- Lista
- con viñetas

> Una idea destacada.
```

El primer párrafo sale un poco más grande. Deja una línea en blanco entre párrafos.

### Planes

- La primera vez, **Cargar esos tres para editarlos** copia al panel los planes Base, Ilimitado y Competidor.
- Precio vacío = el sitio muestra "Consultar precio" con un botón a WhatsApp.
- Las flechas ↑ ↓ cambian el orden en el sitio. **Visible** los muestra u oculta sin borrarlos.
- El descuento del pago anual sigue en `site.config.js` → `annualDiscount`.

Si Firebase no responde, el blog queda vacío y el sitio muestra los tres planes por defecto.

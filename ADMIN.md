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
- Los artículos que ya existían como páginas en `blog/` aparecen como **Página fija**: se siguen editando en el código (ver `BLOG.md`).

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

Si Firebase no responde, el sitio sigue mostrando los artículos de `js/posts.js` y los tres planes por defecto.

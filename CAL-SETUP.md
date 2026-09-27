# Reservas con Cal.com

El horario del sitio abre el calendario de Cal.com en una ventana. Cal.com controla los cupos, manda los correos de confirmación y recordatorio, y permite cancelar o cambiar la reserva.

## 1. Cuenta

1. Crea una cuenta en https://cal.com (el plan gratuito sirve).
2. En **Settings → General**, pon la zona horaria de la academia (por ejemplo `America/Mexico_City`).
3. Anota tu usuario: es lo que aparece en `cal.com/<usuario>`.

## 2. Tipos de evento (uno por clase)

Crea un tipo de evento para cada clase con **exactamente** este slug (la parte final de la URL):

| Clase del sitio        | Slug en Cal.com     | Duración | Cupo (seats) | Días y horas                                      |
|------------------------|---------------------|----------|--------------|---------------------------------------------------|
| Jiu-Jitsu Gi           | `jiu-jitsu-gi`      | 90 min   | 24           | Lun 07:00, Lun 20:00, Mié 07:00, Vie 19:30        |
| Jiu-Jitsu No-Gi        | `jiu-jitsu-no-gi`   | 90 min   | 24           | Mié 20:00, Vie 07:00                              |
| Muay Thai              | `muay-thai`         | 75 min   | 20           | Lun 18:30, Mar 19:00, Jue 07:00, Jue 19:00, Sáb 10:30 |
| Boxeo                  | `boxeo`             | 60 min   | 16           | Mar 07:00, Mié 18:30, Vie 18:00                   |
| MMA                    | `mma`               | 90 min   | 12           | Mar 20:30, Jue 20:30                              |
| Kids Jiu-Jitsu (6–12)  | `kids-jiu-jitsu`    | 60 min   | 16           | Lun 17:00, Mié 17:00, Sáb 09:00                   |
| Fundamentos BJJ        | `fundamentos-bjj`   | 60 min   | 20           | Mar 18:00, Jue 18:00                              |
| Open Mat               | `open-mat`          | 90 min   | 30           | Sáb 12:00                                         |

En cada tipo de evento:

- **Advanced → Offer seats**: actívalo y pon el cupo. Así varias personas reservan la misma clase y Cal.com la cierra cuando se llena.
- **Availability**: crea un horario propio para esa clase donde cada bloque dure lo mismo que la clase. Por ejemplo, para Boxeo: martes 07:00–08:00, miércoles 18:30–19:30 y viernes 18:00–19:00. Así solo cabe un horario de inicio por bloque.
- **Limits → Minimum notice**: 2 horas, para que nadie reserve cuando la clase ya empezó.
- **Limits → Before/after event buffer**: 0.
- Opcional: en **Workflows**, agrega un recordatorio por correo o WhatsApp 3 horas antes.

Si cambias el horario de una clase, cámbialo en los dos lugares: en Cal.com y en `plan` dentro de `index.html`.

## 3. Conectar el sitio

Abre `js/booking.js` y escribe tu usuario:

```js
username: "tu-usuario",
```

Si usaste slugs distintos, cámbialos en `events`. Luego sube los cambios:

```bash
git add -A
git commit -m "Activar reservas con Cal.com"
git push
```

Vercel publica la nueva versión en menos de un minuto.

## Cómo funciona

1. La persona elige una clase en el horario y escribe su nombre, correo, teléfono y experiencia.
2. Se abre Cal.com con el día de esa clase ya seleccionado y los datos llenos. El teléfono, la experiencia y si es su primera clase llegan en las notas de la reserva.
3. Al confirmar, Cal.com manda el correo y el sitio muestra la reserva en "Tus reservas", con un enlace para cambiarla o cancelarla.

Mientras `username` esté vacío, el sitio muestra un aviso con el correo y el teléfono de la academia en lugar del botón de reserva.

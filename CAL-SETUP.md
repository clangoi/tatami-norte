# Reservas con Cal.com

La sección "Agenda tu clase" muestra el calendario de Cal.com directamente en la página, con una pestaña por clase. Cal.com controla los cupos, manda los correos de confirmación y recordatorio, y permite cancelar o cambiar la reserva.

Cuenta conectada: **cal.com/hccombat**

## Agregar una clase

1. En Cal.com, crea un tipo de evento para la clase (por ejemplo "Muay Thai").
2. Copia el final de su URL: en `cal.com/hccombat/muay-thai` es `muay-thai`.
3. En `site.config.js`, agrégala a `booking.classes`:

```js
classes: [
  { label: "Judo", slug: "judo" },
  { label: "Muay Thai", slug: "muay-thai" }
]
```

Con una sola clase no se muestran pestañas; con dos o más aparecen solas, en el orden de la lista.

## Configuración recomendada de cada clase en Cal.com

- **Advanced → Offer seats**: actívalo y pon el cupo de la clase. Así varias personas reservan la misma hora y Cal.com la cierra cuando se llena.
- **Availability**: crea un horario propio para la clase donde cada bloque dure lo mismo que la clase (por ejemplo, Judo lunes y miércoles 19:00–20:00). Así solo hay un horario de inicio por bloque.
- **Duración**: una sola duración por clase. Judo hoy ofrece 60 y 75 min; si es la misma clase, deja solo una.
- **Limits → Minimum notice**: 2 horas.
- **Booking questions**: agrega "Teléfono" y "¿Es tu primera clase?" si quieres esos datos.
- **Workflows** (opcional): recordatorio por correo o WhatsApp 3 horas antes.
- Borra o oculta "Reunión de 15 min" y "Reunión de 30 min" si no las usas; no aparecen en el sitio, pero sí en tu perfil público de Cal.com.

## Publicar

```bash
git add -A
git commit -m "Actualizar clases de Cal.com"
git push
```

Vercel publica la nueva versión en menos de un minuto.

## Si el calendario no carga

Si `calUsername` está vacío, `classes` no tiene elementos o Cal.com no responde, la sección muestra un aviso con el correo y el teléfono de `site.config.js` para reservar por mensaje.

## Calendario en otras páginas

Las páginas de disciplina muestran solo sus clases. En `judo.html` y `bjj.html`, al final:

```js
TNBooking.mount(document.getElementById('booking'), { slugs: ['judo'] });
```

Copia la sección `#booking` de cualquiera de esas páginas y cambia los `slugs` para crear otra.

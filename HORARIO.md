# Horario semanal

El horario de la portada (sección "Horario") y de las páginas de Judo y BJJ se arma **solo, con la disponibilidad de Cal.com**. Para cambiarlo, cambia la disponibilidad de las clases en Cal.com: el sitio lo refleja en unos minutos, sin tocar código ni hacer `git push`.

## Cómo se calcula

1. Por cada clase de `site.config.js → booking.classes`, el sitio consulta en Cal.com los horarios de **hoy y los próximos 7 días**.
2. Muestra una semana: un lunes, un martes, etc., cada uno con su fecha. Hoy muestra las clases que le quedan; si ya no queda ninguna, se muestra el mismo día de la semana siguiente.
3. La hora de término sale de la duración del evento en Cal.com.
4. Si una clase tiene variantes (Judo de 1 h y de 1 h 15), todas aparecen como "Judo". Si dos variantes coinciden el mismo día a la misma hora, se muestra la más larga.
5. Guarda el resultado 10 minutos en el navegador para no consultar Cal.com en cada página.

Por eso, si cambias un horario en Cal.com (por ejemplo, Judo pasa de 11:00 a 12:00 desde la próxima semana), la página muestra el cambio sola en cuanto esa semana entra en los próximos 7 días.

Al tocar una clase del horario se abre el calendario de reservas en esa clase y con la duración que corresponde.

## Cosas a tener en cuenta

- **Clases llenas:** si una clase se llena, Cal.com deja de ofrecerla y ese horario no aparece esa semana. Con 15 cupos es poco probable.
- **Feriados:** si bloqueas un día en Cal.com, ese día aparece sin clases (o con las que queden) mientras esté dentro de los próximos 7 días. Es lo esperado: muestra la semana real.
- **Colores y nombres:** se configuran en `site.config.js → booking.classes` (`label`, `tone`, `page`).
- **Clase nueva:** créala en Cal.com y agrégala a `booking.classes` (ver `CAL-SETUP.md`).

## Alternativa: horario desde un archivo

Si algún día el horario se administra fuera de Cal.com (por ejemplo desde un panel de admin propio), cambia `schedule.source` a `"json"` y apunta `schedule.url` al archivo o a la dirección de la base de datos. El formato es:

```json
{
  "nota": "Texto bajo el horario.",
  "disciplinas": {
    "judo": { "nombre": "Judo", "tono": "oro", "pagina": "judo.html" }
  },
  "clases": [
    { "dia": "lunes", "inicio": "18:00", "fin": "19:00", "disciplina": "judo", "pick": "judo" }
  ]
}
```

`dia` va sin tildes (`miercoles`, `sabado`). `pick` es opcional: el evento de Cal.com que se abre al tocar la clase.

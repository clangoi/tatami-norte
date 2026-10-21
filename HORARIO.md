# Horario semanal

El horario de la portada (sección "Horario") y de las páginas de Judo y BJJ se arma **solo, con las clases y horarios de `/admin` → Clases** (ver `RESERVAS.md`). Para cambiarlo, edita el horario semanal en el panel: el sitio lo refleja en cuanto guardas, sin tocar código ni hacer `git push`.

## Cómo se muestra

1. Se muestra **la semana en curso**, de lunes a sábado (el domingo solo si tiene clases), cada día con su fecha.
2. Los días que ya pasaron se ven más claros, pero sus clases se pueden reservar igual mientras sean de la semana en curso o la siguiente. Al empezar una semana nueva se muestran los días de esa semana.
3. Las clases canceladas solo una semana, o con cierre, no aparecen ese día.
4. Una clase llena se marca como «Completa».

Al tocar una clase se abre la reserva de esa clase.

## Alternativa: horario desde un archivo

Si algún día el horario se administra fuera del panel, cambia `schedule.source` a `"json"` y apunta `schedule.url` al archivo o a la dirección de la base de datos. El formato es:

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

`dia` va sin tildes (`miercoles`, `sabado`). `pick` es opcional: la clase que se abre al tocarla.

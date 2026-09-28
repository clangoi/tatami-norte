# Horario semanal

El horario de la portada (sección "Horario") y de las páginas de Judo y BJJ se arma desde **`data/horario.json`**. Cambias ese archivo y se actualizan las tres páginas.

Cuando exista el panel de administración, el horario se editará desde ahí con este mismo formato. Hasta entonces se edita a mano.

## Formato

```json
{
  "titulo": "Semana tipo",
  "actualizado": "2026-09-27",
  "nota": "Texto que aparece debajo del horario.",
  "disciplinas": {
    "judo": { "nombre": "Judo", "tono": "oro", "pagina": "judo.html" }
  },
  "clases": [
    { "dia": "lunes", "inicio": "18:00", "fin": "19:00", "disciplina": "judo" }
  ]
}
```

### `disciplinas`

La clave (`judo`, `jiu-jitsu-gi`…) es la misma que usa Cal.com en la dirección de la clase (`cal.com/hccombat/judo`). Así, al tocar una clase en el horario se abre su pestaña en el calendario de reservas.

| Campo | Qué es |
|---|---|
| `nombre` | Cómo se muestra |
| `tono` | Color: `oro`, `bronce`, `marino`, `acero` o `linea` (borde punteado) |
| `pagina` | Página de la disciplina, o `""` si no tiene |

### `clases`

Una línea por clase.

| Campo | Valores |
|---|---|
| `dia` | `lunes`, `martes`, `miercoles`, `jueves`, `viernes`, `sabado`, `domingo` (sin tildes) |
| `inicio`, `fin` | Hora en formato 24 h: `"18:00"` |
| `disciplina` | Una clave de `disciplinas` |
| `nota` | Opcional. Texto corto bajo la hora, por ejemplo `"Principiantes"` |

El domingo solo aparece si tiene clases. Las horas de la grilla salen solas de las clases que existan.

## Importante: Cal.com

El horario del sitio es informativo; las reservas las controla Cal.com. Si cambias una clase de día u hora, cámbiala también en la disponibilidad de esa clase en Cal.com, o la gente verá un horario y podrá reservar otro.

## Publicar

```bash
git add data/horario.json
git commit -m "Actualizar horario"
git push
```

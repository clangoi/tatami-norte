---
name: crear-entrada-blog
description: Crea entradas del blog de Kizuna a partir de una o más fuentes (URLs, textos). Úsala cuando el usuario pida crear, escribir o adaptar una entrada del blog desde un enlace o documento, incluyendo sus imágenes, videos, fuentes y publicación.
---

# Crear entradas del blog

Convierte una o más fuentes en entradas del blog de Kizuna. Los artículos viven en Firebase y se escriben en Markdown propio (formato en `js/markdown.js`, flujo en `BLOG.md`).

## 1. Leer las fuentes

- El usuario puede dar **una o varias fuentes** para una misma entrada. Léelas todas antes de escribir.
- Escribe con palabras propias, nunca copies el texto. Cita como máximo frases cortas.
- **Si las fuentes se contradicen** (datos, definiciones, cifras, técnica), no elijas tú: explicita la discrepancia, indica qué dice cada fuente y **pregunta al usuario cómo resolverla antes de seguir** con la entrada.
- Si una fuente no cubre un punto, no lo inventes ni lo rellenes de memoria: dilo o pregunta.
- Una fuente puede dar para más de una entrada. Si el tema se divide bien (por ejemplo, dos conceptos complementarios), propón varias entradas enlazadas entre sí.

## 2. Escribir la entrada

- Español, tuteo, tono cercano y claro, como las entradas ya publicadas en `js/seed-posts.js`.
- **Largo máximo: 10 minutos de lectura** (unas 2000 palabras; la web calcula `readingMinutes` a 200 palabras por minuto). Lo normal es bastante menos.
- Estructura habitual: párrafo inicial (sale destacado), secciones con `##`, listas cortas, y una parte práctica ("Cómo practicarlo").
- Campos de cada artículo: `slug` (minúsculas, números y guiones), `title`, `cat` (un tema que ya exista, p. ej. "Técnica"), `letter` (2-3 letras), `date` (AAAA-MM-DD), `pattern` (0 a 3), `ex` (resumen de una o dos frases) y `body`.
- Enlaza entre entradas con `/blog/articulo.html?p=<slug>`.

## 3. Imágenes

- Cuando el artículo necesite imágenes, **genéralas con la paleta del sitio** (`css/tokens.css`): azul marino `#1B2338`, crema `#F6F2E7`, acero `#888D95`, bronce `#A98B5E`, dorado `#D6BD8C`.
- Deben ser **realistas, limpias y sin adornos**. **No uses SVG, dibujos de palitos ni ilustraciones esquemáticas.**
- Las imágenes van **sin fondo, solo los sujetos**: entrégalas en WebP o PNG con transparencia en `assets/images/content/`, con una versión de unos 600 px de ancho (`nombre-600.webp`) como las existentes.
- **Usa las herramientas de creación de imágenes del chat** (las de la app de Claude) para generarlas, describiendo escena, encuadre, personas, vestimenta y la paleta de colores. Guarda el resultado en `assets/images/content/`.
- Si en la sesión no hay ninguna herramienta de creación de imágenes disponible, **no las sustituyas por SVG**: escribe un **prompt por imagen** para que el usuario lo pegue en el generador del chat. Guárdalos en `docs/prompts-imagenes/<tema>.md`; el modelo a seguir es `docs/prompts-imagenes/hikite-tsurite.md`.
- Cada prompt debe ser muy detallado, en inglés (los generadores lo siguen mejor), y llevar:
  1. **Imagen de referencia online** (URL directa, con su licencia, qué aporta y qué no copiar). Compruébala abriéndola antes de usarla y prefiere Wikimedia Commons.
  2. **Estilo fotográfico** realista (lente, luz, sin ilustración ni render).
  3. **Sujetos** descritos de forma idéntica en toda la serie (edad, complexión, ropa, colores), para que no cambien entre imágenes.
  4. **Paleta de `css/tokens.css`** con sus códigos hex y para qué usa cada color, más la prohibición de colores fuera de ella.
  5. **Sin fondo: solo los sujetos**, sobre fondo transparente (PNG con alfa), sin suelo, tatami, paredes, sombra proyectada ni otras personas, con bordes limpios y sin halo. Como respaldo, si el generador no da transparencia, pide fondo blanco liso (#FFFFFF) sin sombra para recortarlo después. La referencia solo aporta pose y tela, nunca el fondo.
  6. **Encuadre y proporción** (plano, ángulo, 8:5 o 4:5) y la **pose exacta**, mano por mano y articulación por articulación cuando importe.
  7. **"Keep it clean"**: sin texto, flechas, marcas de agua ni logos dentro de la imagen (las explicaciones van en el pie).
  8. **Negative prompt** con los errores típicos (dedos de más, manos deformadas, agarre equivocado, ilustración, texto, colores fuertes).
- Termina el archivo con el **nombre de cada imagen**, la **sintaxis para insertarla** en la entrada y una **lista de revisión** para aceptar o rechazar cada resultado. Si una imagen compara varias posiciones, pide una imagen por posición con los mismos personajes (la entrada las muestra como galería).
- Cada imagen lleva texto alternativo y, si ayuda, un pie: `![descripción](/assets/images/content/archivo.webp "pie")`.

## 4. Videos

- Solo videos **recientes**. Búscalos en YouTube filtrando por fecha (el último año) y descarta los antiguos aunque la fuente original los use.
- Comprueba que se puedan incrustar (por ejemplo con `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=ID`; si no responde 200, no sirve).
- Sintaxis: `@[Título · Canal](ID_YOUTUBE?start=21&end=57 "pie")`.
- **Pie del video:** nombre del video y canal. Si el nombre se traduce al español, **no añadas "(español)", "(en inglés)" ni indicaciones parecidas**. Ejemplo: `"Cómo el tsurite lleva la técnica en uchi-mata. Video: atsushi judo channel."`
- No des por buena la relevancia de un video solo por el título: comprueba que trate el tema.

## 5. Fuentes al final

Cierra cada entrada con una sección `## Fuentes` con **todas** las fuentes usadas (artículos, páginas, y videos si aportaron contenido), como lista de enlaces:

```
## Fuentes

- [Título de la fuente](https://url) · Autor o sitio
```

## 6. Dónde guardar y publicar

1. Agrega el artículo al arreglo `SEED_POSTS` de `js/seed-posts.js`.
2. El usuario lo carga desde `/admin` con el botón **"Cargar artículos nuevos"** (copia solo los que faltan, sin pisar los editados). **No escribas en Firebase directamente ni uses la cuenta de servicio.**
3. Actualiza `BLOG.md` si cambia el flujo.
4. Git: haz commit en la rama de trabajo solo si el usuario lo pide; para subirlo, push + PR a `main`. **No fusiones con `main` sin que el usuario lo pida expresamente.**

## 7. Revisión antes de entregar

- [ ] Se leyeron todas las fuentes y las discrepancias se resolvieron con el usuario.
- [ ] Lectura de 10 minutos o menos.
- [ ] Imágenes realistas, con la paleta, no SVG.
- [ ] Videos recientes, embebibles, pies sin "(español)" y similares.
- [ ] Sección `## Fuentes` al final.
- [ ] Enlaces internos con `slug` correcto.
- [ ] El texto no copia las fuentes.

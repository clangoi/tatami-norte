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
- Entrega en WebP (o PNG/JPG) en `assets/images/content/`, con una versión de unos 600 px de ancho (`nombre-600.webp`) como las existentes.
- **Usa las herramientas de creación de imágenes del chat** (las de la app de Claude) para generarlas, describiendo escena, encuadre, personas, vestimenta y la paleta de colores. Guarda el resultado en `assets/images/content/`.
- Si en la sesión no hay ninguna herramienta de creación de imágenes disponible, **no las sustituyas por SVG**: dile al usuario qué imágenes hacen falta (qué mostrar, encuadre, colores) y pídele que las genere en el chat o las aporte.
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

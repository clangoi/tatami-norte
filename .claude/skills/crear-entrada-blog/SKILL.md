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

Las imágenes de las entradas son **fotos reales encontradas online, recoloreadas con la paleta del sitio**. No se generan con IA, no se dibujan y **no se usan SVG ni esquemas de palitos**.

**Búsqueda**
- Busca fotos realistas, limpias y sin adornos que muestren justo lo que explica el texto (la técnica, la posición, el gesto). Revisa cada candidata abriéndola, no solo su título.
- Usa solo imágenes con **licencia que permita reutilizar y modificar** (Creative Commons, dominio público, o bancos como Unsplash, Pexels o Pixabay). Prefiere Wikimedia Commons, que da licencia y autor en la propia página. No uses fotos de sitios o redes con todos los derechos reservados.
- Descarta las que tengan texto, logos, marcas de agua, rostros de menores, o que muestren la técnica equivocada.
- Si varias imágenes comparan posiciones, elige fotos del mismo estilo y encuadre parecido para que la galería se vea coherente.
- Si no encuentras una foto adecuada con licencia libre, no la inventes: dile al usuario qué falta y propón alternativas.

**Recoloreado con la paleta** (`css/tokens.css`)
- Convierte la foto a escala de grises y aplica un **mapa de degradado (duotono/tritono)** con estas paradas: `0 %` tinta `#141a2b`, `30 %` azul `#2b3654`, `55 %` acero `#888D95`, `80 %` dorado `#D6BD8C`, `100 %` crema `#F6F2E7`. El bronce `#A98B5E` se puede usar como acento suave en los tonos medios cálidos.
- Resultado: sin ningún color fuera de la paleta, con contraste suficiente para que se lea la técnica (manos, agarres, posición). Ajusta niveles si queda plano u oscuro.
- Usa la herramienta disponible en la sesión (ImageMagick, sharp, Pillow o un `canvas` en el navegador). Trabaja sobre una copia: no modifiques el original descargado.
- El **fondo se conserva** tal como sale en la foto (ya recoloreado), salvo que el usuario pida expresamente recortar los sujetos.

**Archivos y atribución**
- Entrega WebP en `assets/images/content/`, con una versión de unos 600 px de ancho (`nombre-600.webp`), como las existentes.
- Cada imagen lleva texto alternativo y un pie con la atribución que exija la licencia (autor, licencia): `![descripción](/assets/images/content/archivo.webp "Texto. Foto: Autor, CC BY-SA 4.0.")`.
- Agrega cada foto a la sección `## Fuentes` con su enlace a la página original.
- Guarda un registro de cada imagen (URL original, autor, licencia, ajustes aplicados) en `docs/imagenes-blog.md`, para poder rehacerla o retirarla.

**Revisión antes de aceptar cada imagen**
- [ ] La licencia permite el uso y la modificación, y la atribución está en el pie y en Fuentes.
- [ ] Muestra lo que dice el texto (manos, agarre o posición correctos).
- [ ] Sin texto, logos ni marcas de agua.
- [ ] Solo colores de la paleta.
- [ ] Se lee bien en pantallas pequeñas.

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
- [ ] Imágenes: fotos online con licencia libre, recoloreadas con la paleta, con atribución; no SVG ni generadas.
- [ ] Videos recientes, embebibles, pies sin "(español)" y similares.
- [ ] Sección `## Fuentes` al final.
- [ ] Enlaces internos con `slug` correcto.
- [ ] El texto no copia las fuentes.

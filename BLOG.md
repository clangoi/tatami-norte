# Cómo publicar un artículo en el blog

Cada artículo es una página propia en `blog/`. El listado del blog, la portada ("Blog del dojo") y la sección "Sigue leyendo" de cada artículo se arman solos desde `js/posts.js`.

## 1. Crea la página

Copia `blog/_plantilla.html` y renómbrala con el nombre del artículo: solo minúsculas, números y guiones.

```
blog/como-hacer-un-buen-randori.html
```

La dirección final será `tusitio.cl/blog/como-hacer-un-buen-randori`.

En el archivo nuevo cambia:

| Qué | Dónde |
|---|---|
| Título | `<title>`, `data-site-title`, `og:title` y el `<h1>` |
| Resumen | las dos `description` (la normal y `og:description`) |
| Categoría | `<span class="cat">` |
| Fecha | `<time datetime="2026-10-01">1 oct 2026</time>` |
| Minutos de lectura | `<span>4 min de lectura</span>` |
| Letras de la portada | `<span class="big">JU</span>` (2 o 3 letras) |
| Patrón de la portada | `pat-0`, `pat-1`, `pat-2` o `pat-3` |
| Texto | dentro de `<div class="post-body">` |
| Relacionados | `data-current="como-hacer-un-buen-randori"` (el nombre del archivo, sin `.html`) |

### Formato del texto

```html
<p class="lede">Primer párrafo, un poco más grande.</p>
<h2>Subtítulo</h2>
<p>Párrafo normal con <strong>negritas</strong> y <a href="../judo.html">enlaces</a>.</p>
<ul><li>Lista</li><li>con viñetas</li></ul>
<blockquote>Una idea destacada.</blockquote>
```

## 2. Agrégalo al índice

En `js/posts.js`, agrega una entrada (el orden no importa, se ordenan por fecha):

```js
{
  slug: "como-hacer-un-buen-randori",
  title: "Cómo hacer un buen randori",
  cat: "Técnica", letter: "RN", date: "2026-10-01", read: 4,
  ex: "Resumen de una o dos líneas."
},
```

Usa el mismo `slug`, título, categoría y fecha que en la página.

## 3. Publica

```bash
git add -A
git commit -m "Nuevo artículo: Cómo hacer un buen randori"
git push
```

Vercel lo publica en menos de un minuto.

## Categorías actuales

Principiantes · Técnica · Nutrición · Mentalidad · Físico

Una categoría nueva aparece sola en los filtros del blog en cuanto un artículo la usa.

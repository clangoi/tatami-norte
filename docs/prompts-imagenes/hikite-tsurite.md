# Prompts de imágenes · Hikite y Tsurite

Cinco imágenes realistas para las entradas "Hikite: la mano que tira" y "Tsurite: la mano que eleva" (en `js/seed-posts.js`): dos para hikite y tres para tsurite. Reemplazan a los esquemas SVG.

**Cómo usarlos**

1. En el generador de imágenes del chat, adjunta o pega el enlace de la **imagen de referencia** y pega el prompt completo (el bloque en inglés; los generadores lo siguen mejor).
2. Genera varias versiones y elige la que cumpla la lista de revisión de abajo.
3. Pide el resultado **sin fondo, solo los sujetos** (PNG con transparencia). Guárdalo con el nombre indicado en `assets/images/content/` como WebP con transparencia, más una copia de 600 px de ancho `nombre-600.webp`. Si el generador no da transparencia, el prompt pide fondo blanco liso: quítalo después con una herramienta de recorte.
4. En el cuerpo de la entrada, cambia el `.svg` por el `-600.webp` (la sintaxis no cambia).

## Imagen de referencia (para las cinco)

- **Enlace:** https://upload.wikimedia.org/wikipedia/commons/4/49/WikiJudo-29.jpg
- **Página y licencia:** https://commons.wikimedia.org/wiki/File:WikiJudo-29.jpg · foto de Saidalefotografia, CC BY-SA 4.0.
- **Qué aporta:** dos judokas de perfil dentro de un dojo, uno con judogi azul oscuro y otro blanco, agarre de solapa y manga con las manos en su sitio, proporciones y caída de la tela reales.
- **Qué NO copiar de ella:** las caras, **el fondo (paredes, tatami, suelo, la tercera persona)**, ni el recorte negro de los bordes. Solo se toma la pose y la tela.

Si el generador no acepta enlaces, descarga la foto y adjúntala como imagen. La licencia exige atribuir al autor si se usa una copia; aquí solo es referencia de pose y no se publica.

## Bloque común (va al inicio de los cinco prompts)

```
PHOTOGRAPH STYLE: Realistic documentary sports photograph, shot on a full-frame camera with an 85mm lens at f/2.8, natural soft light, true-to-life skin tones and fabric texture. Clean composition. Sharp focus on the hands and the gi fabric. No filters, no HDR look, no illustration, no 3D render, no cartoon, no vector art.

SUBJECTS (keep identical in every image of the series):
- TORI: adult man in his 30s, athletic build, short dark hair, clean-shaven, calm and focused expression, barefoot. Wears a heavy cream-white judo gi (color close to #F6F2E7, slightly warm, no logos, no patches, no text) with a brown belt (color close to #A98B5E).
- UKE: adult man in his 30s, similar height, short dark hair, light stubble, relaxed expression, barefoot. Wears a dark navy-blue judo gi (color close to #1B2338, no logos, no patches, no text) with a brown belt (color close to #A98B5E).
- Both are correctly proportioned, with five fingers on each hand and natural anatomy. Hands and fingers are fully visible and anatomically correct.

COLOR PALETTE (use it for the whole scene, nothing outside it):
- Deep navy #1B2338 and darker ink #141a2b for shadows within the gi folds and for Uke's gi.
- Warm cream #F6F2E7 for Tori's gi and highlights.
- Steel gray #888D95 for neutral mid-tones in the fabric folds and skin shadows.
- Bronze #A98B5E for the belts.
- Soft gold #D6BD8C only as the warm tone of the light and the skin highlights.
- Color grade: muted, slightly desaturated, warm highlights and cool navy shadows. No bright red, green, orange or yellow anywhere.

BACKGROUND: NONE. Cut-out of the subjects only, on a fully TRANSPARENT background (PNG with alpha channel). No floor, no tatami, no wall, no dojo, no horizon, no gradient, no vignette, no cast shadow or ground shadow, no reflections, no props, no other people, no text, no logos. Clean, crisp edges around the two men and their gis, with no halo, no white or colored fringe, and no leftover background pixels. If the generator cannot output transparency, use a perfectly flat, uniform pure-white background (#FFFFFF) with no shadow so it can be removed afterwards.
```

## Imagen 1 · `kumikata-agarres.webp`

**Para qué sirve:** abre la entrada de hikite. Muestra el agarre completo: una mano en la solapa y la otra en la manga.

```
[Pegar aquí el BLOQUE COMÚN]

SHOT: Full-body side view, both men facing each other in a natural upright stance (shizen-hontai), about one arm's length apart, centered in the frame. Horizontal 8:5 aspect ratio, eye-level camera, both men fully visible from head to feet, with a small empty margin around them and nothing on the ground.

POSE: Tori (cream gi, on the left) holds Uke (navy gi, on the right) in a standard judo grip, as in the reference photo:
- Tori's RIGHT hand grips Uke's LAPEL at the chest, just below the collarbone, fingers closed around the fabric, elbow slightly bent and close to Tori's torso. This is the TSURITE (lifting hand).
- Tori's LEFT hand grips Uke's SLEEVE just above the elbow, fingers closed around the fabric, thumb on top. This is the HIKITE (pulling hand).
- Uke's arms hang naturally, relaxed, with Uke's right hand resting on Tori's sleeve. Both men keep a slight forward lean with knees softly bent.
- Both gis are tidy, with realistic creases where the hands pull the fabric.

KEEP IT CLEAN: no text, no arrows, no circles, no labels, no watermarks, no logos, no borders.

NEGATIVE: extra fingers, fused fingers, deformed hands, extra limbs, wrong grip, hands on the belt, cartoon, illustration, stick figure, text, arrows, overlays, background of any kind, floor, tatami, wall, shadow on the ground, spectators, bright colors, motion blur on the hands.
```

## Imagen 2 · `hikite-traccion.webp`

**Para qué sirve:** muestra que la tracción sale del tronco y no solo del brazo, y el desequilibrio (kuzushi) de Uke.

```
[Pegar aquí el BLOQUE COMÚN]

SHOT: Full-body side view, same two men, frozen at the instant Tori pulls. Horizontal 8:5 aspect ratio, eye-level camera, both fully visible, camera slightly lower than hip height so the lean reads clearly.

POSE: Tori (cream gi, left) has just stepped back with the left foot and turned the whole trunk backward, pulling with the HIKITE:
- Tori's LEFT hand holds Uke's SLEEVE above the elbow and is pulled down and back toward Tori's left hip, with the elbow bent and the forearm in line with the pull.
- Tori's RIGHT hand stays on Uke's lapel at chest level, elbow close to the body.
- Tori's shoulders, chest and hips are rotated together in the direction of the pull, showing that the movement comes from the trunk and legs, not only the arm.
- Uke (navy gi, right) is off-balance (kuzushi), leaning forward about 15 degrees toward Tori, weight on the toes, one foot beginning to step forward to recover. Uke's back is rounded slightly and his head is forward.
- No throw yet: both men remain on their feet.

KEEP IT CLEAN: no text, no arrows, no lines drawn over the photo, no labels, no watermarks, no logos, no borders.

NEGATIVE: Uke falling or airborne, throw already happening, extra fingers, deformed hands, hands on the belt, cartoon, illustration, stick figure, text, arrows, overlays, background of any kind, floor, tatami, wall, shadow on the ground, spectators, bright colors, heavy motion blur.
```

## Imágenes 3, 4 y 5 · fuerza del tsurite

Son **tres imágenes iguales en encuadre y personajes** que cambian solo la posición del brazo. En la entrada se muestran juntas, en fila (varias imágenes seguidas forman galería). Genéralas en la misma conversación para mantener el mismo Tori y el mismo Uke.

Bloque común de las tres, que va después del BLOQUE COMÚN:

```
SHOT: Waist-up side view, tight framing on Tori's upper body and gripping arm. Tori (cream gi) is on the left and faces right. Uke (navy gi) is only partly visible at the right edge: his chest, lapel and shoulder, with his face cropped out of the frame. Vertical 4:5 aspect ratio, eye-level camera. Tori's RIGHT hand holds Uke's LAPEL below the collarbone, fingers closed around the fabric. Tori's left arm is out of the frame or relaxed behind. Soft light on the hand, sleeve and lapel, which are the focus. Subjects only, on a transparent background.

KEEP IT CLEAN: no text, no arrows, no labels, no watermarks, no logos, no borders.

NEGATIVE: extra fingers, deformed hands, wrong hand, cartoon, illustration, stick figure, text, arrows, overlays, background of any kind, floor, wall, shadow, bright colors.
```

Y la pose de cada una:

### Imagen 3 · `tsurite-debil.webp` (brazo extendido)

```
POSE: Tori's right arm is FULLY EXTENDED straight forward at shoulder height, elbow locked and far from his torso, so the hand is as far from the body as possible. The shoulder is slightly hunched forward, and the arm looks stretched and weak, with no ability to lift. The sleeve is taut from shoulder to wrist.
```

### Imagen 4 · `tsurite-intermedio.webp` (codo a medio camino)

```
POSE: Tori's right elbow is BENT at about 90 degrees and held about a hand's width away from his ribs, with the forearm angled forward and slightly upward, so the hand reaches Uke's lapel at chest height. The arm looks moderately strong, neither fully extended nor tucked in.
```

### Imagen 5 · `tsurite-fuerte.webp` (codo al cuerpo, mano encima)

```
POSE: Tori's right ELBOW IS TUCKED AGAINST HIS OWN RIBS, touching the upper body, and the forearm points almost straight UP, so the gripping hand is directly above the elbow, at about chest or collarbone height. The wrist is firm and the shoulder is relaxed and low. The arm looks compact, stable and strong, ready to lift.
```

En la entrada de tsurite, la galería queda así (reemplaza la imagen actual):

```
![Tori con el brazo extendido: tsurite débil](/assets/images/content/tsurite-debil-600.webp "Brazo extendido: débil.")
![Tori con el codo a medio camino: tsurite intermedio](/assets/images/content/tsurite-intermedio-600.webp "Codo a medio camino: fuerza intermedia.")
![Tori con el codo al cuerpo y la mano encima: tsurite fuerte](/assets/images/content/tsurite-fuerte-600.webp "Codo al cuerpo, mano encima: fuerte.")
```

## Revisión antes de aceptar cada imagen

- [ ] Cada mano tiene cinco dedos y se ve natural; no hay manos de más.
- [ ] El agarre es el correcto: tsurite en la solapa (pecho), hikite en la manga (sobre el codo). Ninguna mano está en el cinturón.
- [ ] Judogi crema para Tori y azul marino para Uke, sin logos ni texto.
- [ ] Colores dentro de la paleta: sin rojos, verdes, naranjas ni amarillos fuertes.
- [ ] **Sin fondo**: solo los sujetos, con bordes limpios, sin suelo, sombra proyectada ni restos de fondo (verifícalo poniéndola sobre un color oscuro y uno claro).
- [ ] Sin texto, flechas ni marcas dentro de la imagen.
- [ ] En las imágenes 3 a 5, mismo Tori y misma luz; el único cambio es el brazo.
- [ ] En la imagen 5, el codo de verdad toca el cuerpo y la mano queda sobre él.

Si algo falla, no repitas todo: pide el cambio concreto ("misma imagen, pero con la mano derecha de Tori en la solapa") y vuelve a revisar.

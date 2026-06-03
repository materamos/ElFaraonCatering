# Guía de entrega de assets — El Faraón

Para la diseñadora. El objetivo es que lo que entregues entre a la web **sin
recortes, renombrados ni reinterpretaciones**. Si seguís los nombres, formatos y
tamaños de esta guía, el reemplazo es prácticamente 1:1.

Aplica a la **web pública**: la **landing** y los **menús**. Acompaña al
documento de [Design Tokens](./design-tokens.md) (colores y tipografías van por
ahí). El panel admin interno queda fuera de alcance.

---

## Reglas generales

- **Formato vectorial siempre que se pueda:** logo e íconos en **`.svg`**.
- **Fotos / imágenes de bitmap:** `.webp` (preferido) o `.png`. Evitar `.jpg`
  para imágenes con transparencia.
- **Nombres de archivo:** todo en **minúsculas, sin acentos, sin espacios**,
  separando con guion medio (`-`). Ej.: `plato-principal.svg`, no
  `Plato Principal.svg`.
- **Entregar el editable también:** además del export, dejar el archivo fuente
  (Figma / `.ai` / `.svg` editable) por si hay que ajustar tamaños.

---

## 1. Logo

| Variante | Formato | Detalle |
| --- | --- | --- |
| Logo principal | `.svg` | Vectorial, con márgenes mínimos limpios |
| Logo monocromo (1 color) | `.svg` | Para fondos donde el full color no rinde |
| Versión clara / oscura | `.svg` | Si el logo cambia según fondo claro u oscuro |

- Entregar con el **área de protección** (espacio libre alrededor) ya pensada.
- Si hay isotipo (solo símbolo) además del logo completo, entregarlo aparte: se
  reutiliza para favicons e íconos.

---

## 2. Favicons e íconos de app

Hoy viven en [`public/icons/`](../../public/icons). Reemplazos exactos:

| Archivo | Tamaño | Uso |
| --- | --- | --- |
| `favicon-32.png` | 32 × 32 px | Pestaña del navegador |
| `icon-192.png` | 192 × 192 px | Ícono Android / PWA |
| `apple-touch-icon.png` | 180 × 180 px | Ícono al guardar en iOS |

- Cuadrados exactos, **fondo no transparente** (un color de marca) para que el
  ícono de iOS no quede raro.
- Ideal entregar también un **SVG maestro** del isotipo del que se exportan
  estos PNG; así se regeneran a cualquier tamaño en el futuro.

---

## 3. Placeholders de platos (imágenes del menú)

Cuando un plato no tiene foto, se muestra una imagen genérica por categoría.
Viven en [`public/uploads/menu-placeholders/`](../../public/uploads/menu-placeholders)
y son **SVG**.

- **Proporción obligatoria: 4:3** (se recortan a ese marco). Diseñar dentro de
  4:3 para que nada quede cortado.
- **Mantener exactamente estos nombres de archivo** (reemplazo 1:1):

| Archivo | Categoría |
| --- | --- |
| `desayuno-snack.svg` | Desayuno / snack |
| `empanada.svg` | Empanadas |
| `ensalada.svg` | Ensaladas |
| `guarnicion.svg` | Guarniciones |
| `omelette.svg` | Omelette |
| `plato-principal.svg` | Plato principal |
| `promocion.svg` | Promociones |
| `tarta.svg` | Tartas |
| `tortilla.svg` | Tortilla |

> Si la nueva marca necesita **otra** categoría, avisá antes: agregar un
> placeholder nuevo requiere un cambio chico en el código además del archivo.

---

## 4. Fotos reales de platos (si las hay)

| Propiedad | Valor |
| --- | --- |
| Proporción | **4:3** |
| Formato | `.webp` (o `.png`) |
| Lado mayor sugerido | ~1200 px (suficiente para mobile y desktop) |
| Peso por imagen | objetivo < 200 KB |

El recorte final lo hace la web (`object-fit: cover`), pero entregar ya en 4:3
evita sorpresas de encuadre.

---

## 5. Tipografías (archivos)

Si la marca trae tipografías propias:

| Qué entregar | Detalle |
| --- | --- |
| Archivos `.woff2` | Uno por peso usado (ver pesos en Design Tokens: 600, 650, 700) |
| Licencia de uso web | Confirmar que la licencia permite uso embebido en web |
| Nombre exacto de la familia | Para declararla en el CSS |

- Preferimos `.woff2` **self-hosted** (se suben a `public/`) antes que Google
  Fonts: carga más rápido y no depende de terceros.
- Si una tipografía no tiene el peso `650`, indicá con cuál reemplazarla (`600`
  o `700`).

---

## 6. Checklist de entrega

- [ ] Paleta por **rol** con HEX (según [Design Tokens](./design-tokens.md), sección 1)
- [ ] Tipografías: archivos `.woff2` + nombre de familia + licencia
- [ ] Logo `.svg` (principal + monocromo + claro/oscuro si aplica)
- [ ] Isotipo `.svg` maestro
- [ ] Favicons: `favicon-32.png`, `icon-192.png`, `apple-touch-icon.png`
- [ ] Placeholders de platos en `.svg`, 4:3, con los nombres exactos de la lista
- [ ] Fotos reales (si hay) en 4:3, `.webp`
- [ ] Archivos fuente editables

---

## 7. Dónde va cada cosa (referencia para desarrollo)

| Asset | Destino en el repo |
| --- | --- |
| Favicons / íconos | [`public/icons/`](../../public/icons) |
| Placeholders de platos | [`public/uploads/menu-placeholders/`](../../public/uploads/menu-placeholders) |
| Tipografías `.woff2` | `public/` (carpeta de fuentes, a definir) |
| Logo en páginas | se integra en componentes / layout según diseño |

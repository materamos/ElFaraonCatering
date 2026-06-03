# Design Tokens — El Faraón

Este documento es el **contrato visual** entre diseño y desarrollo para la **web
pública**: la **landing** y los **menús**. Toda esa identidad se controla desde
un puñado de variables. Si el rebranding se piensa contra **estos nombres** (no
contra colores sueltos), bajar el diseño a la web se reduce a cambiar valores en
un solo bloque de código.

- **Fuente de verdad en código:** [`src/styles/global.css`](../../src/styles/global.css), bloque `:root` al inicio del archivo.
- **Cómo leer la tabla:** la columna *Rol* es el nombre estable; el valor cambia con el rebranding, el rol no.
- **Para la diseñadora:** organizá tu paleta en Figma con estos mismos roles/nombres. Entregá un HEX por cada rol.
- **Fuera de alcance:** el panel de administración interno (`/admin`) **no** es parte del diseño de marca. Ver sección 5.

---

## 1. Colores

| Token (variable CSS) | Rol en la interfaz | Valor actual | Dónde se ve |
| --- | --- | --- | --- |
| `--color-page` | Fondo de página | `#f8f8f6` | Fondo general del sitio |
| `--color-surface` | Superficie / tarjetas | `#ffffff` | Paneles, hoja de foto del plato |
| `--color-line` | Línea / borde | `#d9d9d2` | Separadores fuertes, bordes de panel |
| `--color-line-soft` | Línea suave | `#e8e8e2` | Separadores entre platos |
| `--color-ink` | Texto principal | `#20201d` | Títulos y texto destacado, precios |
| `--color-muted` | Texto secundario | `#66665f` | Descripciones, etiquetas, "eyebrows" |
| `--color-accent` | Acento | `#333333` | Foco de teclado (outline), detalles |
| `--color-success` | Estado positivo | `#2f6b4f` | Reservado para estados OK |
| `--color-danger` | Estado negativo | `#9a3f3b` | "No disponible", avisos de faltante |
| `--color-backdrop` | Fondo de overlay | `rgba(0,0,0,.46)` | Capa oscura detrás de la hoja de foto |

**Notas de uso**
- Hoy el acento es casi neutro (gris). Si la marca trae un color fuerte, este es
  el token a cambiar; revisá que el contraste del foco siga siendo visible.
- `--color-success` aún se usa poco; conviene que la marca igual lo defina para
  futuros estados (confirmaciones, disponible, etc.).
- **Contraste:** texto sobre fondo debe cumplir WCAG AA (relación ≥ 4.5:1 para
  texto normal, ≥ 3:1 para texto grande). Verificar especialmente
  `--color-muted` sobre `--color-page`.

---

## 2. Tipografía

| Token | Rol | Valor actual |
| --- | --- | --- |
| `--font-body` | Familia base (todo el texto) | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| `--font-display` *(propuesto)* | Familia para títulos | *(no existe aún)* |

Hoy **toda la tipografía es del sistema** (no hay fuentes propias). Cuando la
marca defina tipografías, hay dos decisiones:

1. **¿Una o dos familias?** Si los títulos llevan una tipografía distinta al
   cuerpo, conviene agregar un token nuevo `--font-display` y aplicarlo a los
   títulos. Si es una sola familia con distintos pesos, alcanza con `--font-body`.
2. **¿Cómo se cargan?** Recomendado: archivos **`.woff2` self-hosted** (más
   rápido y estable que Google Fonts). Ver detalle en la guía de entrega de assets.

### Pesos en uso
La interfaz usa estos pesos — la tipografía elegida debe tenerlos (o sus más
cercanos):

| Peso | Uso |
| --- | --- |
| `600` | Enlaces de índice, etiquetas |
| `650` | Títulos, texto destacado, enlaces |
| `700` | Etiquetas en mayúscula ("eyebrow"), precios, estados |

### Escala tipográfica (tamaños actuales)
Los títulos son **fluidos** (`clamp(mínimo, escala, máximo)`): crecen con el
ancho de pantalla. La diseñadora puede pensar en términos de mín/máx:

| Elemento | Tamaño (mín → máx) |
| --- | --- |
| Título de página / menú | `2.25rem → 3.6rem` |
| Título placeholder | `2rem → 3.5rem` |
| Título de sección | `1.45rem → 2rem` |
| Título de grupo | `1.2rem → 1.55rem` |
| Cuerpo de texto | `1rem` (line-height `1.65`) |
| Descripciones | `0.92rem – 0.95rem` |
| Etiqueta / eyebrow (mayúsculas) | `0.76rem`, `letter-spacing` normal |

---

## 3. Radios (esquinas redondeadas)

| Token | Rol | Valor actual |
| --- | --- | --- |
| `--radius-panel` | Esquinas de paneles y hojas | `0.75rem` |
| `--radius-small` | Esquinas chicas (botones, marcos de foto) | `0.45rem` |

---

## 4. Espaciado y layout (no tokenizado, pero útil saberlo)

No son variables todavía, pero marcan el "aire" del diseño actual:

- **Ancho de contenido:** la página se limita a `min(100% - 2rem, 68rem)`
  (`.page-shell`). El contenido no se estira más allá de ~68rem.
- **Proporción de fotos de platos:** `4 / 3` (marco `.photo-frame`). Cualquier
  foto o placeholder de plato se recorta a 4:3.
- **Ritmo vertical:** los espacios usan múltiplos de `0.25rem` (0.35, 0.45,
  0.75, 1, 1.25, 1.5, 2.25rem…). Mantener esa familia de valores ayuda a que
  todo se vea consistente.

---

## 5. Alcance: qué cubre (y qué no)

- **Cubre:** la **landing** y los **menús** (la web pública). Todo eso lee desde
  los tokens de marca de las secciones 1–4.
- **No cubre:** el **panel admin** (`/admin`), que es una herramienta interna.
  Tiene su **propio tema** (neutros cálidos + un verde de acción), autónomo y
  gestionado por desarrollo en [`admin.css`](../../src/admin/admin.css). No
  comparte la paleta de marca, así que un rebranding **no lo toca** y la
  diseñadora puede ignorarlo por completo.

> Nota técnica (no hace falta para diseñar): ninguna de las dos superficies tiene
> colores escritos a mano; todo lee desde tokens. El admin se mantiene
> deliberadamente separado para que los cambios de marca no afecten a una
> herramienta interna.

---

## 6. Cómo se aplica el rebranding (resumen para desarrollo)

1. La diseñadora entrega los valores nuevos por **rol** (sección 1 y 2).
2. Se actualiza el bloque `:root` en [`global.css`](../../src/styles/global.css) — ~12 valores.
3. Si hay tipografía propia: se agregan los `@font-face` / `<link>` y, si
   aplica, el token `--font-display`.
4. Se reemplazan assets (logo, favicons, placeholders) siguiendo la guía.
5. Se revisa en `npm run dev` o en un preview de Vercel.

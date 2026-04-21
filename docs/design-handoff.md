# Design Handoff: /menu

## Objetivo

Esta guia define como preparar y trasladar el diseno de Figma a la implementacion actual de `/menu`.

Esta primera version del handoff:

- cubre solo la superficie `/menu`
- esta escrita para diseno + desarrollo
- usa espanol para el contenido
- mantiene nombres tecnicos y referencias de archivos en ingles
- prioriza una guia practica antes que una spec visual extensa

El objetivo no es documentar toda una design system. El objetivo es que una persona pueda disenar el menu QR y que otra persona pueda implementarlo en Astro/Tailwind sin tener que reinterpretar decisiones importantes.

## Como usar esta guia

- Diseno usa este archivo para saber que piezas debe preparar en Figma y que restricciones de producto debe respetar.
- Desarrollo usa este archivo para decidir que baja a tokens, que baja a componentes y que debe seguir siendo contenido o estructura del sistema.
- Si Figma y codigo entran en conflicto, gana la necesidad operativa del menu: lectura rapida, mobile-first, contenido real y mantenimiento simple.

## Contexto del producto

`/menu` es la superficie operativa del buffet de El Faraon Catering para la experiencia QR dentro del edificio corporativo de Paramount+.

El menu actual es:

- mobile-first
- static-first
- informativo
- rapido de cargar
- de bajo mantenimiento

El menu actual no debe incorporar:

- checkout
- pagos online
- reservas
- cuentas de usuario
- flujos de carrito
- interacciones pesadas o dependientes de JavaScript

El menu no debe diseniarse como:

- una landing corporativa
- una web de restaurant orientada a marketing
- una experiencia de ecommerce

La prioridad es la lectura rapida y la claridad en contexto buffet.

## Restricciones de diseno

El diseno para `/menu` debe respetar estas reglas:

- priorizar uso en celular antes que desktop
- mantener jerarquia visual clara y escaneable
- soportar contenido variable proveniente del sistema de contenido
- evitar efectos visuales que ralenticen carga o compliquen mantenimiento
- separar visualmente la superficie operativa del futuro sitio institucional
- no depender de contenido perfecto o de longitud fija

El contenido real del menu hoy responde a este esquema:

- `name`
- `description` opcional
- `price`
- `available`
- `image` opcional para uso futuro

El diseno debe funcionar bien incluso si:

- un item no tiene descripcion
- un nombre ocupa mas de una linea
- un precio es visualmente mas largo que otro
- un item esta marcado como no disponible
- mas adelante se suma una imagen sin rehacer toda la tarjeta

## Estado actual del codigo

La implementacion actual concentra la capa visual en pocos archivos:

- `src/styles/global.css`: tokens base y clases reutilizables
- `src/pages/menu/index.astro`: layout general de `/menu`
- `src/components/DishCard.astro`: tarjeta de plato o bebida
- `src/components/MenuSection.astro`: encabezado de seccion + listado
- `src/components/MenuInfoPanel.astro`: bloque de informacion util

Hoy ya existen estos tokens y primitivas visuales:

- colores base en `:root`
- tipografia de cuerpo y display
- radios de panel y pill
- sombra base
- `page-shell`
- `surface-card`
- `eyebrow`
- `status-pill`

Esto significa que el handoff no parte de cero: el trabajo de diseno puede redefinir o refinar el sistema visual, pero deberia intentar aterrizarlo en tokens y componentes reutilizables.

## Mapa Figma -> codigo

### Layout general

La pagina `/menu` hoy se compone de:

1. hero operativo
2. panel de informacion util
3. listado de secciones
4. tarjetas de items por seccion

En codigo eso vive principalmente en `src/pages/menu/index.astro`.

### Piezas conceptuales del handoff

Estas son las piezas minimas que Figma debe definir y que desarrollo debe poder mapear a componentes reales:

| Pieza en Figma | Rol | Correspondencia actual en codigo |
| --- | --- | --- |
| `Menu Hero` | Presenta el menu operativo y su contexto | bloque superior en `src/pages/menu/index.astro` |
| `Menu Info Panel` | Resume informacion util para el usuario | `src/components/MenuInfoPanel.astro` |
| `Section Header` | Titulo y descripcion de cada grupo del menu | encabezado dentro de `src/components/MenuSection.astro` |
| `Dish Card` | Unidad base para cada item del menu | `src/components/DishCard.astro` |
| `Status Pill` | Estado disponible / no disponible | `status-pill` en `src/styles/global.css` y uso en `DishCard.astro` |
| `Price Row` | Fila final con precio y jerarquia economica | bloque inferior en `src/components/DishCard.astro` |

### Donde vive cada decision

- Tokens repetibles: `src/styles/global.css`
- Composicion general de pagina: `src/pages/menu/index.astro`
- UI reusable por pieza: `src/components/*.astro`
- Contenido variable del menu: `src/content/*`
- Entrada administrativa reservada: `public/admin/index.html`

Regla practica:

- si una decision se repite en varias piezas, debe vivir como token o abstraccion visual
- si una decision define estructura de una pieza, debe vivir en un componente
- si una decision cambia por plato, bebida o categoria, debe quedar como contenido y no hardcodeada como diseno fijo

## Entregables esperados desde Figma

El handoff de Figma deberia incluir, como minimo:

- frame principal mobile de `/menu`
- version tablet y desktop de referencia
- componentes separados para las piezas reutilizables
- variantes de estado cuando aplique
- definicion de colores, tipografias, radios, espaciados y sombras
- notas de comportamiento para contenido variable

Entrega recomendada:

- mobile base pensado para lectura rapida
- una referencia tablet
- una referencia desktop

No hace falta una maqueta para cada pagina del sitio, porque este handoff cubre solo `/menu`.

### Variantes y estados que Figma debe mostrar

- `Dish Card` disponible
- `Dish Card` no disponible
- `Dish Card` con descripcion
- `Dish Card` sin descripcion
- `Dish Card` contemplando imagen futura
- `Menu Info Panel` con varias filas
- `Section Header` con titulo y descripcion realista

### Tokens que Figma debe dejar explicitados

- color de fondo general
- color de superficie
- color de bordes
- color de texto principal
- color de texto secundario
- color de marca
- color para estado disponible
- color para estado no disponible
- fuente de cuerpo
- fuente de display
- radios principales
- sombra principal
- espaciados base

Si un valor visual se repite, debe salir explicitado como decision reusable y no escondido dentro de una sola pantalla.

## Edge cases obligatorios

Figma debe contemplar estos casos antes de dar el diseno por cerrado:

- nombre largo que ocupa dos lineas
- descripcion ausente
- estado no disponible
- precios de distinta longitud
- multiples secciones con densidad visual similar
- futura imagen opcional sin romper la composicion

Ademas, el diseno no debe asumir:

- cantidades fijas de items por seccion
- una sola longitud de texto
- que todos los platos esten disponibles
- que siempre existan imagenes

## Reglas para bajar a codigo

### Que debe bajar a tokens

Debe ir a `src/styles/global.css` todo lo que sea decision visual repetible:

- paleta base
- roles de color
- tipografias
- radios
- sombras
- clases utilitarias compartidas

### Que debe bajar a componentes

Debe bajar a componentes todo lo que sea UI reusable con estructura propia:

- tarjetas
- encabezados de seccion
- paneles informativos
- badges o pills de estado

### Que debe seguir siendo contenido

No debe codificarse como parte fija del diseno lo que en realidad cambia por contenido:

- nombre del plato
- descripcion
- precio
- disponibilidad
- categorias del menu

Eso debe seguir viniendo del contenido y del render actual.

### Que no debe quedar hardcodeado por el diseno

Evitar bajar desde Figma decisiones que vuelvan fragil la implementacion:

- alturas fijas para tarjetas con texto variable
- anchos pensados solo para una longitud de nombre
- espaciados que dependan de tener imagen siempre
- layouts que funcionen solo si todas las secciones tienen la misma cantidad de items
- estilos atados a una sola pantalla en vez de un sistema reusable

## Checklist de handoff

Antes de pasar el diseno a codigo, validar:

- el foco esta en `/menu` y no en la home institucional
- existe una version mobile clara
- existen referencias responsive suficientes
- estan definidas las piezas reutilizables
- estan definidos los tokens principales
- se contemplan estados disponible / no disponible
- se contempla descripcion opcional
- se contempla contenido largo
- el diseno no depende de JavaScript para funcionar
- el resultado sigue sintiendose operativo y no promocional

## Checklist de implementacion

Al bajar el handoff a Astro/Tailwind, validar:

- los tokens repetidos viven en `src/styles/global.css`
- el layout general de `/menu` se resuelve en `src/pages/menu/index.astro`
- cada pieza reusable vive en un componente claro
- no se agregan dependencias innecesarias
- no se acopla la UI a un CMS especifico
- no se mezcla la logica editorial con decisiones visuales
- la UI sigue siendo legible en celular
- el render sigue siendo mayormente estatico y liviano

## Fuera de alcance de este documento

Este handoff no cubre por ahora:

- `/`
- `/admin`
- una design system completa para todas las superficies futuras
- cambios de schema o nuevos campos editoriales

## Nota de mantenimiento

Este archivo debe tratarse como un living document. Si el proyecto suma nuevas superficies, nuevas piezas UI o una madurez visual mayor, la guia puede crecer. Mientras tanto, debe mantenerse corta, util y centrada en la implementacion real del menu QR.

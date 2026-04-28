# El Faraon Catering

Base tecnica para el sistema de menu digital de **El Faraon Catering**.

El foco actual del proyecto es la experiencia de menu QR para buffets operados por El Faraon Catering. Esta etapa es informativa: no incluye pedidos, pagos online, reservas, cuentas de usuario, carrito ni flujos de compra.

## Proposito

Construir un menu digital rapido, mobile-first y de bajo mantenimiento para la operacion diaria del buffet.

El proyecto tiene dos superficies separadas:

- `/`: placeholder de la futura presencia institucional.
- `/menu/`: placeholder de entrada general para menus.
- `/menu/corpo/`: menu operativo QR Corpo.
- `/menu/teleinde/`: menu operativo QR Teleinde.
- `/admin/`: placeholder estatico para el futuro panel editorial.

La superficie institucional no debe mezclarse con la experiencia operativa del menu.

## Estado actual

La base actual incluye:

- **Astro 5**
- **TypeScript**
- **Tailwind CSS 4**
- **Astro Content Collections**
- **YAML** para contenido
- **Node 20 LTS**
- **npm**
- despliegue estatico preparado para **Vercel**

Tambien incluye:

- perfiles de menu por ubicacion
- menu del dia independiente por ubicacion
- catalogo compartido para Corpo y Teleinde
- overrides acotados por menu
- soporte opcional para imagenes locales de items del menu
- un dialog liviano para ver fotos desde los menus publicos
- placeholder estatico para `/admin/`

En esta fase no hay CMS activo dentro del repo. **Keystatic** queda como candidato preliminar para una fase editorial posterior, pero no es una decision cerrada.

## Rutas

| Ruta | Estado | Proposito |
| --- | --- | --- |
| `/` | Placeholder | Futura web institucional |
| `/menu/` | Placeholder | Entrada general futura para menus |
| `/menu/corpo/` | Activa | Menu operativo Corpo |
| `/menu/teleinde/` | Activa | Menu operativo Teleinde |
| `/admin/` | Placeholder estatico | Futuro entrypoint editorial |

`vercel.json` mantiene redirects canonicos:

- `/menu` -> `/menu/`
- `/menu/corpo` -> `/menu/corpo/`
- `/menu/teleinde` -> `/menu/teleinde/`
- `/admin` -> `/admin/`

`/admin/` se sirve desde `public/admin/index.html`. No debe reintroducirse como pagina Astro mientras siga siendo un placeholder estatico.

## Estructura principal

```text
src/
  components/
    DishCard.astro
    MenuInfoPanel.astro
    MenuPage.astro
    MenuSection.astro
  content/
    menu-catalog-sections/
    menu-daily-sections/
    menu-overrides/
    menu-profiles/
  layouts/
    BaseLayout.astro
  pages/
    index.astro
    menu/
      index.astro
      corpo/index.astro
      teleinde/index.astro
  styles/
    global.css
  utils/
    menuContent.ts
    menuImage.ts
    menuPricing.ts
  content.config.ts
public/
  admin/
    index.html
  scripts/
    menu-photo-sheet.js
  uploads/
.nvmrc
astro.config.mjs
package.json
vercel.json
```

Directorios generados como `dist/`, `.astro/` y `node_modules/` no forman parte de la estructura fuente documentada.

## Modelo de contenido

El contenido vive en `src/content/` y usa archivos `.yaml`.

Colecciones activas:

- `menu-profiles`: primera card, contacto, datos utiles y pagos por menu.
- `menu-daily-sections`: menu del dia independiente por menu.
- `menu-catalog-sections`: catalogo compartido, sin menu del dia.
- `menu-overrides`: diferencias acotadas por menu.

El render final muestra primero el menu del dia del perfil y despues el catalogo compartido ordenado por `order`.

Estructura general de seccion:

```yaml
id: platos-principales
title: Platos principales con guarnicion
description: Texto opcional
note: Texto opcional
order: 20
items:
  - id: milanesa-peceto
    name: Milanesa de peceto
    available: true
    pricing:
      kind: fixed
      price:
        amount: 11000
```

Reglas principales:

- `id` es obligatorio en secciones, grupos, items, opciones y variantes.
- Los IDs son tecnicos, ASCII/kebab-case, y no se derivan de `name` o `title`.
- Una seccion debe usar `items` o `groups`, pero no ambos.
- Si una seccion usa `items`, cada item debe definir `pricing`.
- Si una seccion usa `groups`, un grupo puede definir `pricing` compartido.
- Si el grupo tiene `pricing`, sus items pueden omitirlo y heredan ese precio.
- Si un item dentro de un grupo define `pricing`, ese valor funciona como override.
- Si un grupo no tiene `pricing`, cada item del grupo debe definir el suyo.
- `available` es obligatorio en productos vendibles.
- `available` en variantes y opciones es opcional y por defecto se considera disponible.
- `note` sirve para aclaraciones visibles, no para reemplazar precios.

Tipos de precio soportados:

```yaml
pricing:
  kind: fixed
  price:
    amount: 7500
```

```yaml
pricing:
  kind: included
```

```yaml
pricing:
  kind: variants
  variants:
    - id: con-guarnicion
      name: Con guarnicion
      price:
        amount: 9000
    - id: sin-guarnicion
      name: Sin guarnicion
      price:
        amount: 7000
```

- Los montos se declaran siempre como numeros en `price.amount`.
- Las variantes son planas: no pueden contener otro `pricing` ni variantes anidadas.
- `image` es opcional en items y debe apuntar a un archivo local bajo `/uploads/`.
- No se aceptan URLs externas, data URLs, query strings ni fragments en `image`.
- Las extensiones permitidas son `.avif`, `.jpeg`, `.jpg`, `.png`, `.svg` y `.webp`.

Los SVG quedan reservados para placeholders o assets locales controlados por el repo.

## Overrides por menu

Los overrides no modifican la estructura del catalogo. Solo pueden cambiar:

- `available` en items.
- `pricing` en groups e items.
- `note` en groups e items.

Ejemplo:

```yaml
menuId: teleinde
sections:
  - id: bebidas
    groups:
      - id: linea-coca-cola
        pricing:
          kind: fixed
          price:
            amount: 2600
        items:
          - id: coca-cola
            available: false
            note: Sin stock temporal
```

Los overrides deben apuntar a IDs existentes. Si una referencia no existe, el build falla.

## Imagenes del menu

El menu soporta imagenes opcionales por item.

Cuando un item tiene `image`, `DishCard.astro` muestra la accion `Ver foto`. Esa accion usa `public/scripts/menu-photo-sheet.js` para abrir un `dialog` liviano. El enlace conserva `href` al archivo local como fallback.

Las imagenes deben colocarse en `public/uploads/` y referenciarse desde YAML con path publico:

```yaml
image: /uploads/example-photo.webp
```

## Desarrollo local

### Requisitos

- Node `20.x`
- npm `>=10`

La version esperada de Node tambien esta declarada en `.nvmrc` y en `package.json`.

### Instalacion

```bash
npm install
```

### Servidor de desarrollo

```bash
npm run dev
```

Rutas utiles en local:

- `http://localhost:4321/`
- `http://localhost:4321/menu/`
- `http://localhost:4321/menu/corpo/`
- `http://localhost:4321/menu/teleinde/`
- `http://localhost:4321/admin/`

### Preview de build

```bash
npm run preview
```

## Validacion

Antes de considerar completa una modificacion, ejecutar:

```bash
npm run build
npm run check
```

Estos comandos son la validacion minima del proyecto.

## Despliegue

La fase actual esta preparada para despliegue estatico en **Vercel**.

Restricciones de esta etapa:

- no hay SSR
- no hay adapter de servidor
- no hay funciones server-side
- no hay CMS activo
- no hay escritura editorial desde `/admin/` ni desde el sitio publico

## Estado editorial

No hay CMS activo en esta etapa. El contenido se edita actualmente como YAML versionado en `src/content/`, con GitHub como fuente de verdad y Vercel como destino de deploy estatico.

El repo ya no incluye:

- Decap CMS
- servicios de autenticacion editorial del stack anterior
- integracion de escritura al repo del stack anterior
- templates de correo del stack anterior
- configuracion de deploy repo-managed del stack anterior

## Fuera de alcance actual

No agregar estas capacidades salvo pedido explicito:

- online ordering
- checkout o pagos online
- WhatsApp ordering
- reservas
- cuentas de usuario
- carrito
- SSR
- serverless functions
- CMS, auth o flujos de escritura editorial

## Decisiones tecnicas actuales

- Se usa **Astro 5** para mantener compatibilidad con **Node 20**.
- Se usa **Tailwind CSS 4** mediante el plugin de Vite.
- El sitio sigue siendo **static-first**.
- La superficie publica prioritaria es `/menu/corpo/`.
- `/menu/` queda como placeholder de entrada general para menus.
- `/admin/` se mantiene como placeholder estatico en `public/admin/`.
- `vercel.json` conserva la canonicalizacion de `/menu`, `/menu/corpo`, `/menu/teleinde` y `/admin`.
- **Keystatic** sigue fuera de alcance en esta etapa y queda como candidato preliminar, no como decision cerrada.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

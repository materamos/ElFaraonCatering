# El Faraon Catering

Sistema de menu digital QR para los buffets operados por **El Faraon Catering** en los dos edificios de **Teleinde**.

El proyecto esta orientado al uso cotidiano en contexto laboral, con una experiencia rapida, clara y mobile-first para tecnicos, produccion, oficinas y personal que consulta el menu desde el telefono.

La fase actual es informativa. No incluye pedidos, pagos online, reservas, cuentas de usuario, carrito ni flujos de compra.

## Resumen del proyecto

El objetivo es mantener un menu digital liviano, rapido y de bajo mantenimiento para consultar platos, bebidas, precios y disponibilidad desde codigos QR.

El proyecto tiene dos superficies separadas:

- **Menu QR operativo**: experiencia principal, mobile-first y orientada al uso diario en buffet.
- **Futura web institucional**: superficie futura para presencia institucional, separada funcional y visualmente del menu operativo.

La superficie institucional no debe mezclarse con la experiencia operativa del menu. El menu debe seguir siendo practico, directo y pensado para consulta rapida.

## Estado actual

Esta seccion resume el estado vigente del sistema:

- `/menu/corpo/` es el menu operativo principal.
- `/menu/teleinde/` esta activo como parte del modelo multi-locacion.
- `/menu/` sigue siendo un placeholder de entrada general para menus.
- `/` sigue siendo un placeholder institucional futuro.
- `/admin/` sigue siendo un placeholder estatico sin funcionalidad, servido desde `public/admin/index.html`.
- YAML es la fuente de verdad del menu: perfiles, catalogo, menu diario, precios, textos, opciones, overrides e imagenes locales.
- Supabase es solo overlay de disponibilidad, consumido por JavaScript cliente para reflejar estado operativo.
- El sistema funciona completamente sin Supabase; si faltan variables, falla la red o los datos no son validos, queda el estado definido en YAML.
- Static-first permite extensiones cliente no bloqueantes. El build y el deploy siguen siendo estaticos en Vercel.
- No hay CMS activo dentro del repo.
- No hay pedidos online, checkout, pagos online, WhatsApp ordering, carrito, reservas ni cuentas de usuario.

## Rutas principales

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

## Stack tecnico

La base actual usa:

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
- dialog liviano para ver fotos desde los menus publicos
- overlay progresivo de disponibilidad con Supabase
- placeholder estatico para `/admin/`

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

## Estructura del proyecto

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
  scripts/
    menuAvailabilityOverlay.ts
  styles/
    global.css
  types/
    menu.ts
  utils/
    menuContent.ts
    menuImage.ts
    menuPricing.ts
  content.config.ts
public/
  admin/
    index.html
  icons/
  scripts/
    menu-photo-sheet.js
  uploads/
docs/
  supabase-availability-overlay.sql
.nvmrc
astro.config.mjs
package.json
vercel.json
```

Directorios generados como `dist/`, `.astro/` y `node_modules/` no forman parte de la estructura fuente documentada.

## Modelo de contenido

El contenido vive en `src/content/` y usa archivos `.yaml`.

YAML es la fuente de verdad del menu. Define perfiles, catalogo, menu diario, precios, textos, opciones, overrides estructurales e imagenes locales.

Colecciones activas:

- `menu-profiles`: primera card, contacto, datos utiles y pagos por menu.
- `menu-daily-sections`: menu del dia independiente por menu.
- `menu-catalog-sections`: catalogo compartido, sin menu del dia.
- `menu-overrides`: diferencias acotadas por menu.

El render final muestra primero el menu del dia del perfil y despues el catalogo compartido ordenado por `order`.

Estructura general de seccion:

```yaml
sectionId: platos-principales
title: Platos principales con guarnicion
description: Texto opcional
note: Texto opcional
order: 20
items:
  - itemId: milanesa-peceto
    name: Milanesa de peceto
    available: true
    pricing:
      kind: fixed
      price:
        amount: 11000
```

Reglas principales:

- `sectionId` es obligatorio en secciones.
- `groupId` es obligatorio en grupos.
- `itemId` es obligatorio en items vendibles.
- `id` se mantiene en perfiles, datos auxiliares, opciones y variantes.
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

Reglas de precios e imagenes:

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
  - sectionId: bebidas
    groups:
      - groupId: linea-coca-cola
        pricing:
          kind: fixed
          price:
            amount: 2600
        items:
          - itemId: coca-cola
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

## Supabase availability overlay

Supabase es solo overlay de disponibilidad. El cliente lo consume como extension progresiva para reflejar el estado operativo de disponibilidad sin cambiar la estructura del menu.

Reglas de esta fase:

- YAML sigue siendo la fuente de verdad del menu.
- Supabase solo puede cambiar disponibilidad visual mediante `available_override`.
- Si no hay fila en Supabase para un item, se usa el valor `available` del YAML.
- Si faltan variables, Supabase falla o devuelve datos invalidos, el menu queda como vino del YAML.
- El sistema funciona completamente sin Supabase.
- El cliente usa `fetch` directo contra la REST API publica; no usa `@supabase/supabase-js`.
- No hay Storage, imagenes live, precios live, menu del dia live ni `/admin/` propio.

Variables publicas esperadas:

```bash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

El SQL inicial para crear tablas y politicas esta en `docs/supabase-availability-overlay.sql`. Ese archivo puede contener piezas preparatorias de auth/escritura para una futura administracion del overlay de disponibilidad, pero eso no significa que exista CMS activo ni `/admin/` funcional.

## Estado editorial

No hay CMS activo en esta etapa. El contenido se edita actualmente como YAML versionado en `src/content/`, con YAML como fuente de verdad del menu, GitHub como fuente versionada y Vercel como destino de deploy estatico.

Supabase queda limitado al estado operativo de disponibilidad consumido por el overlay cliente. No administra perfiles, catalogo, menu diario, precios, textos, imagenes ni contenido editorial.

El repo ya no incluye:

- Decap CMS
- servicios de autenticacion editorial del stack anterior
- integracion de escritura al repo del stack anterior
- templates de correo del stack anterior
- configuracion de deploy repo-managed del stack anterior

**Keystatic** queda como candidato preliminar para una fase editorial posterior, pero no es una decision cerrada.

## Despliegue

La fase actual esta preparada para despliegue estatico en **Vercel**. El proyecto es static-first con extensiones cliente no bloqueantes.

Restricciones de esta etapa:

- no hay SSR
- no hay adapter de servidor
- no hay funciones server-side
- no hay CMS activo
- no hay escritura editorial desde `/admin/` ni desde el sitio publico
- Supabase no es CMS, no es backend principal y no es fuente de verdad del menu

## Fuera de alcance

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
- El sitio sigue siendo **static-first** con extensiones cliente no bloqueantes.
- La superficie publica prioritaria es `/menu/corpo/`.
- `/menu/teleinde/` esta activo como parte del modelo multi-locacion.
- `/menu/` queda como placeholder de entrada general para menus.
- YAML es la fuente de verdad del menu.
- Supabase es solo overlay de disponibilidad.
- El sistema funciona completamente sin Supabase.
- `/admin/` se mantiene como placeholder estatico en `public/admin/`.
- `vercel.json` conserva la canonicalizacion de `/menu`, `/menu/corpo`, `/menu/teleinde` y `/admin`.
- **Keystatic** sigue fuera de alcance en esta etapa y queda como candidato preliminar, no como decision cerrada.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

## Proceso de trabajo

El proyecto se desarrolla con iteracion asistida por Codex, prompts estructurados y validacion mediante `npm run build` y `npm run check`.

El uso de Codex no reemplaza criterios tecnicos. Las decisiones de arquitectura, producto y alcance se mantienen explicitas en la documentacion del proyecto.

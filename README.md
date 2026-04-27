# El Faraon Catering

Base tecnica para el sistema de menu digital de **El Faraon Catering**.

El foco actual del proyecto es la experiencia de menu QR para el buffet dentro del edificio corporativo de **Paramount+**. Esta etapa es informativa: no incluye pedidos, pagos online, reservas, cuentas de usuario, carrito ni flujos de compra.

## Proposito

Construir un menu digital rapido, mobile-first y de bajo mantenimiento para la operacion diaria del buffet.

El proyecto tiene dos superficies separadas:

- `/menu/`: menu operativo QR, prioridad actual.
- `/`: placeholder de la futura presencia institucional.

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

- rutas principales para `/`, `/menu/` y `/admin/`
- una coleccion tipada `menu-sections` para el menu operativo
- contenido YAML real contrastado con el local
- soporte opcional para imagenes locales de items del menu
- un dialog liviano para ver fotos desde `/menu/`
- placeholder estatico para `/admin/`

En esta fase no hay CMS activo dentro del repo. **Keystatic** queda como candidato preliminar para una fase editorial posterior, pero la decision final queda pendiente de validarlo contra el modelo YAML definitivo.

## Rutas

| Ruta | Estado | Proposito |
| --- | --- | --- |
| `/` | Placeholder | Futura web institucional |
| `/menu/` | Activa | Menu operativo del buffet |
| `/admin/` | Placeholder estatico | Futuro entrypoint editorial |

`vercel.json` mantiene redirects canonicos:

- `/menu` -> `/menu/`
- `/admin` -> `/admin/`

`/admin/` se sirve desde `public/admin/index.html`. No debe reintroducirse como pagina Astro mientras siga siendo un placeholder estatico.

## Estructura principal

```text
src/
  components/
    DishCard.astro
    MenuInfoPanel.astro
    MenuSection.astro
  content/
    menu-sections/
  layouts/
    BaseLayout.astro
  pages/
    index.astro
    menu/index.astro
  styles/
    global.css
  utils/
    menuImage.ts
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

Coleccion activa:

- `src/content/menu-sections/`

Cada archivo representa una seccion visible del menu y se ordena con `order`.

Estructura general:

```yaml
title: string
description: string # optional
note: string # optional
order: number
items: array # para secciones simples
groups: array # para secciones agrupadas
```

Reglas principales:

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
  amount: 7500
```

```yaml
pricing:
  kind: pending
```

```yaml
pricing:
  kind: included
  label: Incluida como opción
```

```yaml
pricing:
  kind: variants
  variants:
    - name: Con guarnición
      amount: 9000
    - name: Sin guarnición
      amount: 7000
```

- Las variantes son planas: no pueden contener otro `pricing` ni variantes anidadas.
- Para variantes con precio pendiente se usa `pending: true`.
- `image` es opcional en items y debe apuntar a un archivo local bajo `/uploads/`.
- No se aceptan URLs externas, data URLs, query strings ni fragments en `image`.
- Las extensiones permitidas son `.avif`, `.jpeg`, `.jpg`, `.png`, `.svg` y `.webp`.

Los SVG quedan reservados para placeholders o assets locales controlados por el repo.

## Imagenes del menu

El menu ya soporta imagenes opcionales por item.

Cuando un item tiene `image`, `DishCard.astro` muestra la accion `Ver foto`. Esa accion usa `public/scripts/menu-photo-sheet.js` para abrir un `dialog` liviano en `/menu/`. El enlace conserva `href` al archivo local como fallback.

Las imagenes deben colocarse en `public/uploads/` y referenciarse desde YAML con path publico:

```yaml
image: /uploads/example-photo.webp
```

## Desarrollo local

### Requisitos

- Node `20.x`
- npm `>=10`

La version esperada de Node tambien esta declarada en `.nvmrc` y en `package.json`.

Si acabas de instalar Node en Windows, conviene cerrar y volver a abrir la terminal antes de ejecutar comandos para que `node` y `npm` queden disponibles en el `PATH`.

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

El despliegue esperado puede usar URLs `*.vercel.app` hasta conectar un dominio propio.

## Estado editorial

El repo ya no incluye:

- Decap CMS
- servicios de autenticacion editorial del stack anterior
- integracion de escritura al repo del stack anterior
- templates de correo del stack anterior
- configuracion de deploy repo-managed del stack anterior

No hay CMS activo en esta etapa. El contenido se edita actualmente como YAML versionado en `src/content/menu-sections/`, con GitHub como fuente de verdad y Vercel como destino de deploy estatico.

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
- La superficie publica prioritaria es `/menu/`.
- `/admin/` se mantiene como placeholder estatico en `public/admin/`.
- `vercel.json` conserva la canonicalizacion de `/menu` y `/admin`.
- **Keystatic** sigue fuera de alcance en esta etapa y queda como candidato preliminar, no como decision cerrada.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

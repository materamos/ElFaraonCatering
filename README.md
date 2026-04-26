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
- colecciones tipadas para platos, guarniciones y bebidas
- contenido YAML inicial para validar render y tipado
- soporte opcional para imagenes locales de items del menu
- un dialog liviano para ver fotos desde `/menu/`
- placeholder estatico para `/admin/`

En esta fase no hay CMS activo dentro del repo. **Keystatic** queda pendiente para una fase editorial posterior.

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
    daily-dishes/
    fixed-dishes/
    side-dishes/
    drinks/
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

Colecciones activas:

- `src/content/daily-dishes/`
- `src/content/fixed-dishes/`
- `src/content/side-dishes/`
- `src/content/drinks/`

Los items con precio (`daily-dishes`, `fixed-dishes` y `drinks`) usan este esquema:

```yaml
name: string
description: string # optional
price: number
available: boolean
image: string # optional
```

Las guarniciones (`side-dishes`) usan este esquema:

```yaml
name: string
description: string # optional
available: boolean
image: string # optional
```

Reglas actuales:

- `available` controla si el item se muestra como disponible o no disponible.
- `price` es obligatorio para platos del dia, minutas y bebidas.
- `price` no existe en guarniciones.
- `image` es opcional y debe apuntar a un archivo local bajo `/uploads/`.
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
- no hay escritura editorial desde el repo

El despliegue esperado puede usar URLs `*.vercel.app` hasta conectar un dominio propio.

## Estado editorial

El repo ya no incluye:

- Decap CMS
- servicios de autenticacion editorial del stack anterior
- integracion de escritura al repo del stack anterior
- templates de correo del stack anterior
- configuracion de deploy repo-managed del stack anterior

La edicion de contenido queda temporalmente fuera del repo hasta la siguiente fase de migracion editorial.

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
- **Keystatic** sigue fuera de alcance en esta etapa.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

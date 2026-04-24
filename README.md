# El Faraon Catering

Base tecnica actual para el sistema de menu digital de **El Faraon Catering**.

El foco del proyecto sigue siendo la experiencia de menu QR para el buffet dentro del edificio corporativo de **Paramount+**. Esta version sigue siendo **informativa**: no incluye pedidos, pagos, reservas, cuentas ni flujos de compra.

## Estado actual

La base del proyecto hoy incluye:

- **Astro 5**
- **TypeScript**
- **Tailwind CSS 4**
- **Astro Content Collections**
- **YAML** para contenido
- **Node 20 LTS**
- **npm**

En esta fase ya existen:

- la ruta `/` como placeholder institucional
- la ruta `/menu` como superficie operativa principal
- la ruta `/admin` reservada como placeholder de panel en migracion
- colecciones tipadas para `daily-dishes`, `fixed-dishes`, `side-dishes` y `drinks`
- contenido YAML de ejemplo para validar render y tipado
- una UI minima mobile-first con JavaScript acotado y servido desde origen propio

En esta fase ya no existe un CMS operativo dentro del repo. El hosting objetivo de esta etapa es **Vercel** con despliegue estatico, mientras que **Keystatic** queda para una fase posterior.

## Objetivo del proyecto

Construir un menu digital rapido, simple y de bajo mantenimiento para la operacion del buffet.

## Alcance de esta etapa

La etapa actual cubre:

- estructura del proyecto
- rutas principales
- sistema visual inicial
- modelado tipado del contenido
- render estatico del menu
- reserva de la ruta `/admin` para la futura herramienta editorial
- preparacion para despliegue estatico en Vercel

Todavia no incluye:

- un CMS operativo
- imagenes reales de platos
- multiples locaciones
- integracion de Keystatic
- conexion de dominio propio

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
  uploads/
.nvmrc
vercel.json
```

## Rutas disponibles

- `/` -> placeholder para la futura web institucional
- `/menu` -> menu operativo del buffet
- `/admin` -> placeholder temporal del futuro panel administrativo

## Hosting actual

La fase actual queda preparada para **Vercel** como host del sitio estatico.

En esta etapa:

- el despliegue esperado usa URLs generadas `*.vercel.app`
- `/admin` sigue siendo solo un placeholder
- no hay SSR
- no hay CMS activo

## Modelo de contenido actual

Los platos y bebidas con precio usan un esquema simple y estricto:

```yaml
name: string
description: string # opcional
price: number
available: boolean
image: string # opcional, solo path local en /uploads
```

Las minutas tambien requieren `price`, igual que los platos del dia y las bebidas.

Las guarniciones usan un esquema mas simple, sin `price`, porque se muestran como opciones de acompanamiento.

Si se usa `image`, el valor debe apuntar a un archivo local bajo `/uploads/` con extension `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` o `.svg`. Los SVG quedan reservados para placeholders locales controlados por el repo. No se aceptan URLs externas ni data URLs.

Colecciones activas:

- `src/content/daily-dishes/`
- `src/content/fixed-dishes/`
- `src/content/side-dishes/`
- `src/content/drinks/`

## Desarrollo local

### Requisitos

- Node `20.x`
- npm

Si acabas de instalar Node en Windows, conviene cerrar y volver a abrir la terminal antes de ejecutar comandos para que `node` y `npm` queden disponibles en el `PATH`.

### Instalacion

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

Las rutas canonicas publicas quedan en `/menu/` y `/admin/`.

Para ver el placeholder editorial en local:

```text
http://localhost:4321/admin/
```

### Validacion

```bash
npm run build
npm run check
```

## Estado editorial

El repo ya no incluye:

- Decap CMS
- servicios de autenticacion editorial del stack anterior
- integracion de escritura al repo del stack anterior
- templates de correo del stack anterior
- configuracion de deploy repo-managed del stack anterior

La edicion de contenido queda temporalmente fuera del repo hasta la siguiente fase de migracion.

## Decisiones tecnicas actuales

- Se usa **Astro 5** para mantener compatibilidad con **Node 20**.
- El sitio sigue planteado como **static-first** para la superficie publica.
- El host objetivo de esta fase es **Vercel** con despliegue estatico.
- No hay hidratacion de componentes en esta etapa.
- `/admin` se mantiene servido desde `public/admin/` para reservar el acceso futuro del CMS sin reintroducir una pagina Astro en esa ruta.
- `vercel.json` conserva la canonicalizacion de `/menu` -> `/menu/` y `/admin` -> `/admin/`.
- **Keystatic** sigue fuera de alcance en esta etapa.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

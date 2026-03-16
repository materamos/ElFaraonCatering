# El Faraon Catering

Base tecnica inicial para el sistema de menu digital de **El Faraon Catering**.

El foco actual del proyecto es la experiencia de menu QR para el buffet dentro del edificio corporativo de **Paramount+**. Esta primera version es **informativa**: no incluye pedidos, pagos, reservas, cuentas ni flujos de compra.

## Estado actual

La base del proyecto ya esta creada con:

- **Astro 5**
- **TypeScript**
- **Tailwind CSS 4**
- **Astro Content Collections**
- **YAML** para contenido
- **Node 20 LTS**
- **npm**

En este hito ya existen:

- la ruta `/` como placeholder institucional
- la ruta `/menu` como superficie operativa principal
- la ruta `/admin` como espacio reservado para Decap CMS
- colecciones tipadas para `daily-dishes`, `fixed-dishes`, `side-dishes` y `drinks`
- contenido YAML de ejemplo para validar render y tipado
- una UI minima mobile-first sin JavaScript del lado cliente

## Objetivo del proyecto

Construir un menu digital rapido, simple y de bajo mantenimiento que pueda ser actualizado por personal no tecnico a traves de un CMS en una etapa posterior.

## Alcance de esta etapa

La etapa actual cubre solo la base tecnica del sitio:

- estructura del proyecto
- rutas principales
- sistema visual inicial
- modelado tipado del contenido
- render estatico del menu

Todavia no incluye:

- Decap CMS operativo
- Netlify configurado
- autenticacion
- imagenes reales de platos
- multiples locaciones

## Estructura principal

```text
src/
  components/
    DishCard.astro
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
    admin/index.astro
  styles/
    global.css
  content.config.ts
```

## Rutas disponibles

- `/` -> placeholder para la futura web institucional
- `/menu` -> menu operativo del buffet
- `/admin` -> placeholder reservado para Decap CMS

## Modelo de contenido actual

Cada item de menu usa un esquema simple y estricto:

```yaml
name: string
description: string # opcional
price: number
available: boolean
image: string # opcional
```

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

### Validacion

```bash
npm run build
npm run check
```

## Decisiones tecnicas actuales

- Se uso **Astro 5** para mantener compatibilidad con **Node 20**.
- El proyecto se creo manualmente en lugar de usar `create-astro@latest`, porque las versiones mas nuevas del generador ya exigen Node 22 o superior.
- El sitio esta planteado como **static-first**.
- No hay hidratacion de componentes en esta etapa.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

## Proximo paso sugerido

El siguiente hito natural es integrar **Decap CMS** sobre esta base para que el contenido YAML pueda editarse desde `/admin` sin tocar codigo.

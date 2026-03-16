# El Faraon Catering

Base tecnica inicial para el sistema de menu digital de **El Faraon Catering**.

El foco actual del proyecto es la experiencia de menu QR para el buffet dentro del edificio corporativo de **Paramount+**. Esta primera version es **informativa**: no incluye pedidos, pagos, reservas, cuentas ni flujos de compra.

## Estado actual

La base del proyecto ya esta creada con:

- **Astro 5**
- **TypeScript**
- **Tailwind CSS 4**
- **Astro Content Collections**
- **Decap CMS**
- **Netlify config**
- **YAML** para contenido
- **Node 20 LTS**
- **npm**

En este hito ya existen:

- la ruta `/` como placeholder institucional
- la ruta `/menu` como superficie operativa principal
- la ruta `/admin` como panel real de Decap CMS
- colecciones tipadas para `daily-dishes`, `fixed-dishes`, `side-dishes` y `drinks`
- contenido YAML de ejemplo para validar render y tipado
- una UI minima mobile-first sin JavaScript del lado cliente
- configuracion repo-managed para deploy en Netlify

## Objetivo del proyecto

Construir un menu digital rapido, simple y de bajo mantenimiento que pueda ser actualizado por personal no tecnico a traves de un CMS.

## Alcance de esta etapa

La etapa actual cubre solo la base tecnica del sitio:

- estructura del proyecto
- rutas principales
- sistema visual inicial
- modelado tipado del contenido
- render estatico del menu
- CMS conectado por archivos estaticos en `/admin`
- configuracion base de despliegue para Netlify

Todavia no incluye:

- imagenes reales de platos
- multiples locaciones
- configuracion final en el panel de Netlify

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
  styles/
    global.css
  content.config.ts
public/
  admin/
    config.yml
    index.html
  uploads/
.nvmrc
netlify.toml
```

## Rutas disponibles

- `/` -> placeholder para la futura web institucional
- `/menu` -> menu operativo del buffet
- `/admin` -> panel de administracion de Decap CMS

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

## CMS y despliegue

La integracion de Decap CMS ya esta preparada en el repo con:

- `public/admin/index.html`
- `public/admin/config.yml`
- `backend: git-gateway`
- rama `main`
- edicion directa de las cuatro colecciones YAML

La configuracion de Netlify tambien ya esta preparada en:

- `netlify.toml`
- `.nvmrc`
- `package.json` con `engines.node = 20.x`

### Pasos manuales pendientes en Netlify

Para que `/admin` funcione en produccion, todavia falta completar estas acciones en el panel de Netlify:

1. Conectar el repositorio y desplegar desde `main`.
2. Verificar que use `npm run build` y publique `dist`.
3. Activar **Identity**.
4. Dejar el registro en modo invitacion.
5. Activar el proveedor externo **GitHub** dentro de Identity.
6. Activar **Git Gateway**.
7. Invitar a los editores que van a administrar el menu.

Una vez hecho eso, el flujo esperado es:

1. Entrar en `/admin`.
2. Iniciar sesion.
3. Editar una coleccion.
4. Guardar.
5. Esperar el redeploy automatico.
6. Ver el cambio reflejado en `/menu`.

## Decisiones tecnicas actuales

- Se uso **Astro 5** para mantener compatibilidad con **Node 20**.
- El proyecto se creo manualmente en lugar de usar `create-astro@latest`, porque las versiones mas nuevas del generador ya exigen Node 22 o superior.
- El sitio esta planteado como **static-first**.
- No hay hidratacion de componentes en esta etapa.
- `/admin` se sirve desde `public/admin/` para seguir la integracion estandar de Decap CMS y evitar conflictos de rutas con Astro.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

## Proximo paso sugerido

El siguiente hito natural es validar el flujo completo en Netlify y despues reemplazar el contenido de ejemplo por el menu real del buffet.

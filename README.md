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
- despliegue productivo validado en Netlify
- flujo CMS validado de punta a punta

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
  identity-emails/
    invitation.html
    confirmation.html
    recovery.html
    email-change.html
  uploads/
.nvmrc
netlify.toml
```

## Rutas disponibles

- `/` -> placeholder para la futura web institucional
- `/menu` -> menu operativo del buffet
- `/admin` -> panel de administracion de Decap CMS

## URLs publicas

- Sitio: `https://elfaraoncatering.netlify.app`
- Menu: `https://elfaraoncatering.netlify.app/menu/`
- Admin: `https://elfaraoncatering.netlify.app/admin/`

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

La integracion de Decap CMS ya esta operativa en el repo con:

- `public/admin/index.html`
- `public/admin/config.yml`
- `backend: git-gateway`
- rama `main`
- edicion directa de las cuatro colecciones YAML

La configuracion de Netlify tambien ya esta versionada en:

- `netlify.toml`
- `.nvmrc`
- `package.json` con `engines.node = 20.x`
- templates de Identity en `public/identity-emails/`

### Estado validado en produccion

El flujo actual ya fue probado con exito:

1. Entrar en `/admin`.
2. Iniciar sesion.
3. Editar una coleccion.
4. Guardar.
5. Esperar el redeploy automatico.
6. Ver el cambio reflejado en `/menu`.

Validaciones confirmadas:

- Decap CMS escribe commits en `main`
- Netlify redepliega automaticamente
- Astro sigue leyendo bien los YAML
- `/menu` no se rompe con los cambios editoriales

### Invitaciones y recuperacion de acceso

Para evitar que los enlaces de Netlify Identity abran la raiz del sitio en lugar de `/admin`, el repo ahora incluye templates HTML para:

- invitacion
- confirmacion
- recuperacion de contraseña
- cambio de email

Cada template envia al usuario a `/admin/#...` con el token correcto.

En Netlify hay que asociarlos en:

`Project configuration -> Identity -> Emails`

Paths recomendados:

- `/identity-emails/invitation.html`
- `/identity-emails/confirmation.html`
- `/identity-emails/recovery.html`
- `/identity-emails/email-change.html`

## Decisiones tecnicas actuales

- Se uso **Astro 5** para mantener compatibilidad con **Node 20**.
- El proyecto se creo manualmente en lugar de usar `create-astro@latest`, porque las versiones mas nuevas del generador ya exigen Node 22 o superior.
- El sitio esta planteado como **static-first**.
- No hay hidratacion de componentes en esta etapa.
- `/admin` se sirve desde `public/admin/` para seguir la integracion estandar de Decap CMS y evitar conflictos de rutas con Astro.
- Los correos de Netlify Identity deben apuntar a `/admin/#...` usando los templates publicados en `public/identity-emails/`.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

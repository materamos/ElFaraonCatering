# El Faraon Catering

Sistema de menu digital QR para los buffets operados por **El Faraon Catering** en los edificios de **Teleinde**.

El proyecto esta orientado al uso cotidiano en contexto laboral, con una experiencia rapida, clara y mobile-first para tecnicos, produccion, oficinas y personal que consulta el menu desde el telefono.

La fase actual es informativa. No incluye pedidos, pagos online, reservas, cuentas de usuario, carrito ni flujos de compra.

## Estado actual

- `/menu/corpo/` es el menu operativo principal.
- `/menu/teleinde/` esta activo como parte del modelo multi-locacion.
- `/menu/` sigue siendo un placeholder de entrada general para menus.
- `/` sigue siendo un placeholder institucional futuro.
- `/admin/` sigue siendo un placeholder estatico sin funcionalidad, servido desde `public/admin/index.html`.
- Supabase `menu_content` es la fuente estructural build-time del menu.
- El sitio sigue siendo static-first y se genera como output `"static"` en Astro.
- El overlay runtime de disponibilidad sigue separado y se consume desde JavaScript cliente.
- No hay CMS activo dentro del repo.

El rollback a la etapa anterior con archivos YAML se hace desde Git usando el tag `yaml-rollback-2026-05-02`.

## Stack tecnico

- Astro 5
- TypeScript
- Tailwind CSS 4
- Node 20 LTS
- npm
- Supabase Postgres para contenido estructural build-time
- Vercel static deployment

## Desarrollo local

### Requisitos

- Node `20.x`
- npm `>=10`
- `SUPABASE_DB_URL` disponible para build y validacion estructural, por entorno o `.env.local`

### Instalacion

```bash
npm install
```

### Variables de entorno locales

El repo incluye `.env.local` para desarrollo y auditoria local. Ese archivo esta ignorado por Git.

Completar la URL privada de Postgres en esta linea:

```bash
SUPABASE_DB_URL="postgresql://..."
```

No usar prefijo `PUBLIC_` para `SUPABASE_DB_URL`. Los scripts Node cargan `.env.local` si existe y no pisan variables ya definidas en el entorno.

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

## Scripts npm

| Script | Uso |
| --- | --- |
| `npm run dev` | Levanta Astro en desarrollo. |
| `npm run build` | Genera el sitio estatico en `dist/` leyendo `menu_content` en build-time. |
| `npm run check` | Ejecuta `astro check` con limite de memoria ampliado. |
| `npm run preview` | Sirve el build localmente para revision. |
| `npm run menu:validate` | Valida contenido estructural y hardening esperado en Supabase. Requiere `SUPABASE_DB_URL`. |
| `npm run verify:dist-secrets` | Revisa `dist/` para detectar marcadores de secretos despues del build. |

Validacion recomendada:

```bash
npm run menu:validate
npm run build
npm run verify:dist-secrets
npm run check
```

`SUPABASE_DB_URL` es una variable privada de build/validacion. No debe exponerse al cliente ni formar parte de variables `PUBLIC_*`.

## Estructura del proyecto

```text
src/
  components/
    DishCard.astro
    MenuInfoPanel.astro
    MenuPage.astro
    MenuSection.astro
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
    menuSupabaseContent.ts
public/
  admin/
    index.html
  icons/
  scripts/
    menu-photo-sheet.js
  uploads/
scripts/
  menu-content-supabase.mjs
  validate-menu-supabase.mjs
  verify-dist-secrets.mjs
docs/
  supabase/
    README.md
    availability-overlay.sql
    daily-service-data.sql
    hardening.sql
    schema-diagram.md
    schema.sql
    audits/
      database-audit.sql
      menu-schema-audit.sql
```

Directorios generados como `dist/`, `.astro/` y `node_modules/` no forman parte de la estructura fuente documentada.

## Modelo de contenido

El contenido estructural vive en el schema Supabase `menu_content` y se lee solo durante el build de Astro.

El lector build-time arma la misma forma que consumen `MenuPage`, `MenuSection` y `DishCard`:

- perfiles por menu
- servicio del dia compartido
- configuracion `grill_enabled` por local
- lista fija de parrilla
- catalogo compartido
- overrides por menu
- grupos e items
- precios `fixed`, `included` y `variants`
- opciones
- imagenes locales bajo `/uploads/`

Reglas principales:

- Los IDs tecnicos son ASCII/kebab-case y estables.
- `menu_daily_menu` define el plato principal vigente del menu del dia con nombre, descripcion opcional, disponibilidad y precio.
- `menu_daily_service_settings` define por local si la propiedad `grill_enabled` esta activa.
- Si `grill_enabled` es `false`, el local muestra tres opciones: el plato principal compartido, `Menu del dia + bebida` y `Menu del dia vegetariano`.
- Si `grill_enabled` es `true`, el local aplica la variante de parrilla al servicio del dia y muestra `menu_grill_items`.
- Cada local puede mostrar menu del dia o parrilla, nunca ambas a la vez.
- `menu_grill_items` contiene la lista fija de parrilla; la disponibilidad de cada producto puede cambiar por datos build-time u overlay runtime.
- `menu_sections` contiene solo secciones del catalogo compartido; no modela el servicio diario por local.
- Cuando ambos locales muestran menu del dia, el plato principal es el mismo para ambos.
- Los precios son globales para todos los locales; no se cambian mediante overrides por menu.
- La disponibilidad es individual por local/menu.
- Las secciones definen `items` o `groups`, no ambos.
- Los items directos deben definir precio.
- Un grupo puede definir precio compartido.
- Un item dentro de un grupo puede omitir precio para heredar o definir precio para sobrescribir.
- Si un grupo no tiene precio compartido, cada item del grupo debe definir el suyo.
- Las variantes son planas y sus montos son numericos.
- Los overrides por menu solo ajustan disponibilidad y notas sobre estructura existente.
- Las imagenes deben ser paths locales bajo `/uploads/`.

## Supabase

Hay dos superficies Supabase separadas:

- `menu_content`: fuente estructural build-time del menu.
- overlay runtime de disponibilidad: extension cliente no bloqueante para disponibilidad operativa.

El overlay runtime no administra estructura, textos, precios, imagenes ni menu diario. Si el overlay falla, el menu estatico generado en build-time sigue disponible.

Variables publicas del overlay:

```bash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Variable privada de build/validacion:

```bash
SUPABASE_DB_URL=
```

En local puede definirse en `.env.local`; en Vercel debe configurarse como variable privada de build.

SQL disponible:

- `docs/supabase/README.md`: flujo local-first, orden de ejecucion y reglas de aplicacion remota.
- `docs/supabase/schema-diagram.md`: diagrama ERD Mermaid del schema estructural y overlay runtime.
- `docs/supabase/schema.sql`: schema estructural `menu_content`.
- `docs/supabase/daily-service-data.sql`: datos base para configuracion diaria y parrilla.
- `docs/supabase/availability-overlay.sql`: base del overlay runtime de disponibilidad.
- `docs/supabase/hardening.sql`: hardening idempotente de constraints e indices.
- `docs/supabase/audits/menu-schema-audit.sql`: auditoria read-only de constraints e indices esperados.
- `docs/supabase/audits/database-audit.sql`: auditoria read-only de inventario, exposicion, objetos inesperados y hallazgos de datos.

Flujo local-first para cambios de base:

1. Versionar el SQL propuesto dentro de `docs/supabase/`.
2. Actualizar `docs/supabase/schema-diagram.md` si cambia el esquema o una relacion.
3. Ejecutar primero los audits read-only contra la base apuntada por `SUPABASE_DB_URL`.
4. Ejecutar `npm run menu:validate`, `npm run build`, `npm run verify:dist-secrets` y `npm run check`.
5. Aplicar SQL mutante en Supabase remoto solo si los audits y validaciones pasan.

## Estado operativo

No hay CMS activo dentro del repo en esta etapa. Supabase `menu_content` es la base prevista para un CMS operativo limitado a menu del dia, modo parrilla, disponibilidad y precios globales.

No existe flujo de escritura desde `/admin/`, auth editorial, roles editoriales ni administracion de contenido dentro del sitio publico.

Un CMS editorial amplio sigue fuera de alcance y requeriria una decision de arquitectura separada.

## Despliegue

La fase actual esta preparada para despliegue estatico en **Vercel**. El proyecto es static-first con extensiones cliente no bloqueantes.

Restricciones de esta etapa:

- no hay SSR
- no hay adapter de servidor
- no hay funciones server-side
- no hay CMS activo dentro del repo
- no hay escritura editorial desde `/admin/` ni desde el sitio publico
- no hay consultas estructurales desde el navegador

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
- CMS editorial amplio, auth o flujos de escritura editorial

## Decisiones tecnicas actuales

- Se usa **Astro 5** para mantener compatibilidad con **Node 20**.
- Se usa **Tailwind CSS 4** mediante el plugin de Vite.
- El sitio sigue siendo **static-first** con extensiones cliente no bloqueantes.
- Supabase `menu_content` es la fuente estructural build-time.
- El overlay runtime de disponibilidad queda separado de la estructura del menu.
- `/admin/` se mantiene como placeholder estatico en `public/admin/`.
- `vercel.json` conserva la canonicalizacion de `/menu`, `/menu/corpo`, `/menu/teleinde` y `/admin`.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

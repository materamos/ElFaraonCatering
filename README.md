# El Faraon Catering

Sistema de menu digital QR para los buffets operados por **El Faraon Catering** en los dos edificios de **Telefe**.

El proyecto esta orientado al uso cotidiano en contexto laboral, con una experiencia rapida, clara y mobile-first para tecnicos, produccion, oficinas y personal que consulta el menu desde el telefono.

La fase actual es informativa. No incluye pedidos, pagos online, reservas, cuentas de usuario, carrito ni flujos de compra.

## Estado actual

- `/menu/corpo/` es el menu operativo principal.
- `/menu/teleinde/` esta activo como parte del modelo multi-locacion.
- `/menu/` es un placeholder de entrada general para menus.
- `/` es un placeholder institucional.
- `/admin/` es el CMS operativo estatico de contenido de menu para empleados.
- Supabase `menu_content` es la fuente estructural y operativa build-time del menu.
- Astro usa output estatico por default y no hay adapter de servidor.
- El overlay runtime de disponibilidad esta separado y se consume desde JavaScript cliente.
- `public.staff_users` define empleados y roles operativos.
- `/admin/` lee y escribe mediante RPCs Supabase controladas, sin grants directos sobre `menu_content`.
- El admin activo cubre un punto intermedio de CMS: disponibilidad, servicio del dia, parrilla, contenido de menu fijo, opciones de subcategorias, precios y publicacion, sin convertirse en un CMS editorial amplio.

## Stack tecnico

- Astro 6
- TypeScript
- Tailwind CSS 4
- Node 22 LTS
- npm
- Supabase Postgres para contenido estructural y operativo build-time
- Supabase Edge Function `publish-menu-changes` para publicacion operativa
- Vercel static deployment

## Desarrollo local

### Requisitos

- Node `22.x`
- npm `>=10`
- `SUPABASE_DB_URL` disponible para build y validacion estructural, por entorno o `.env.local`

### Instalacion

```bash
npm install
```

### Variables de entorno locales

El repo puede usar `.env.local` para desarrollo y auditoria local. Ese archivo esta ignorado por Git.

Variables publicas usadas por el menu y el admin:

```bash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Variable privada de build y validacion:

```bash
SUPABASE_DB_URL="postgresql://..."
```

No usar prefijo `PUBLIC_` para `SUPABASE_DB_URL`. Los scripts Node cargan `.env.local` si existe y no pisan variables ya definidas en el entorno.

Variable opcional para auditorias CLI contra la Management API de Supabase:

```bash
SUPABASE_ACCESS_TOKEN=
```

Usarla solo en entorno local o sesion de terminal. No es una variable del sitio ni de la Edge Function, y no debe exponerse como `PUBLIC_*`.

Secretos de la Edge Function `publish-menu-changes`:

```bash
VERCEL_DEPLOY_HOOK_URL=
PUBLISH_ALLOWED_ORIGINS=
PUBLISH_COOLDOWN_SECONDS=60
```

La funcion tambien lee variables de runtime de Supabase Functions:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

En el proyecto remoto, `npm run supabase -- secrets list` confirma que esos nombres estan disponibles junto con los secretos custom de publicacion. Ese comando requiere `SUPABASE_ACCESS_TOKEN` o una sesion previa con `supabase login`. No deben exponerse como variables `PUBLIC_*` ni usarse desde el browser.

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
| `npm run supabase -- <args>` | Ejecuta Supabase CLI local del proyecto. |
| `npm run supabase:link` | Vincula el checkout local con un proyecto Supabase remoto. Requiere project ref y credenciales. |
| `npm run supabase:migrations` | Lista migraciones locales/remotas con Supabase CLI. Requiere proyecto vinculado o `-- --db-url`. |
| `npm run supabase:functions:deploy` | Despliega solo la Edge Function aprobada `publish-menu-changes` con `--no-verify-jwt`. |

Validacion recomendada para cambios de app, Supabase o contenido build-time:

```bash
npm run menu:validate
npm run build
npm run verify:dist-secrets
npm run check
```

## Estructura del proyecto

```text
src/
  admin/
    admin.css
    admin.ts
    adminApi.ts
    adminOperations.ts
    adminSession.ts
    adminTypes.ts
    adminUtils.ts
    adminView.ts
  components/
    CompactMenuItem.astro
    DishCard.astro
    MenuInfoPanel.astro
    MenuPage.astro
    MenuSection.astro
  layouts/
    BaseLayout.astro
  pages/
    admin/index.astro
    index.astro
    menu/
      index.astro
      corpo/index.astro
      teleinde/index.astro
  styles/
    global.css
  types/
    menu.ts
  utils/
    menuContent.ts
    menuImage.ts
    menuPricing.ts
    menuSupabaseContent.ts
    menuSupabaseSnapshot.mjs
public/
  icons/
  scripts/
    menu-availability-overlay.js
    menu-photo-sheet.js
  uploads/
scripts/
  load-local-env.mjs
  menu-content-supabase.mjs
  validate-menu-supabase.mjs
  verify-dist-secrets.mjs
supabase/
  config.toml
  functions/
    publish-menu-changes/
  migrations/
docs/
  supabase/
    README.md
    schema-diagram.md
    audits/
```

Directorios generados como `dist/`, `.astro/` y `node_modules/` no forman parte de la estructura fuente documentada.

## Modelo de contenido

El contenido estructural y operativo vive en el schema Supabase `menu_content` y se lee durante el build de Astro.

El lector build-time arma la forma que consumen `MenuPage`, `MenuSection` y `DishCard`:

- perfiles por menu
- servicio del dia compartido
- servicio activo por local con `service_kind`
- familias de parrilla con variantes
- catalogo compartido
- items directos por seccion
- precios `fixed`, `included` y `variants`
- opciones
- imagenes locales bajo `/uploads/`

Reglas principales:

- Los IDs tecnicos son ASCII/kebab-case y estables. Las altas desde `/admin/` usan IDs generados por RPC server-side; no se derivan del nombre visible en el browser.
- `menu_daily_items` define las dos opciones reales del menu del dia: menu comun y menu vegetariano.
- `menu_profile_service_settings` define por local si el servicio activo es `daily-menu` o `grill`.
- Si `service_kind` es `daily-menu`, el local muestra las dos opciones de `menu_daily_items`.
- Si `service_kind` es `grill`, el local muestra `menu_grill_families` como items visibles con variantes de `menu_grill_catalog_items`.
- Cada local puede mostrar menu del dia o parrilla, nunca ambas a la vez.
- `menu_grill_catalog_items` conserva las variantes de parrilla; `variant_name` define la etiqueta visible de cada variante.
- `menu_catalog_sections` contiene solo secciones del catalogo compartido; no modela el servicio diario por local.
- Cuando ambos locales muestran menu del dia, comparten el mismo plato principal.
- Los precios son globales para todos los locales.
- La disponibilidad operativa es individual por local/menu y vive solo en `public.menu_availability_overlays`.
- Las secciones contienen directamente sus `items`.
- Cada item define su propio precio; no hay grupos ni precios heredados.
- Las variantes son planas y sus montos son numericos.
- Las imagenes deben ser paths locales bajo `/uploads/`.
- `menu_catalog_item_images` es la unica fuente de imagenes del catalogo fijo; `order_index = 0` identifica la principal y los indices siguientes definen el resto.
- Menu del dia y parrilla no admiten imagenes.

## Frontera build-time/runtime

- Menu del dia, descripcion, servicio activo por local, precios globales, catalogo, secciones, imagenes y textos estructurales son datos build-time.
- `/admin/` puede editar parte de esos datos en Supabase, pero cada cambio build-time requiere rebuild/deploy para impactar el menu publico.
- El unico dato editable en runtime sin rebuild es la disponibilidad por local mediante `public.menu_availability_overlays`.
- Las columnas build-time `available` se conservan solo por compatibilidad interna y deben permanecer en `true`; "No disponible" nace como overlay runtime.
- Los items con opciones exponen el target padre y tambien cada opcion con target runtime compuesto como `item-id-option-id`, por ejemplo `tortilla-con-cebolla`.
- El cliente del menu no consulta estructura, precios, menu del dia, servicio activo, catalogo, secciones, imagenes ni textos estructurales.

## Supabase

Superficies Supabase del proyecto:

- `menu_content`: fuente estructural y operativa build-time del menu.
- `public.menu_availability_overlays`: overlay runtime de disponibilidad.
- `public.staff_users`: empleados y roles para el admin operativo.
- RPCs publicas controladas: lectura del admin y escrituras operativas.
- `app_private.menu_publish_requests`: auditoria privada de publicaciones y fingerprint del contenido solicitado desde `/admin/`.
- `publish-menu-changes`: Supabase Edge Function server-side que dispara el Vercel Deploy Hook.

El overlay runtime no administra estructura, textos, precios, imagenes ni menu diario. Si no existe overlay para un item, el menu estatico generado en build-time lo trata como disponible.

Roles operativos:

- `operator`: edita todo lo que permite `/admin/`, para todos los locales, y puede publicar cambios.
- `admin`: hereda permisos operativos y puede gestionar empleados a nivel de base/RPC. El sitio no tiene una pantalla de gestion de empleados.

El primer `admin` se crea exclusivamente mediante SQL privilegiado; `service_role` no tiene acceso directo a `public.staff_users` y el bootstrap no se realiza desde browser RLS.

RPCs y funciones relevantes:

- `get_admin_operational_state()`: lectura controlada para `/admin/`.
- `set_menu_availability_overlay(...)` y `clear_menu_availability_overlay(...)`: cambios runtime de disponibilidad.
- `set_daily_menu(...)`, `set_profile_service_kind(...)`, `add_grill_product(...)`, `update_grill_product(...)`, `delete_grill_product(...)`, `add_grill_item(...)`, `update_grill_item(...)`, `delete_grill_item(...)`, `add_catalog_item(...)`, `update_catalog_item(...)`, `delete_catalog_item(...)`, `add_catalog_item_option(...)`, `update_catalog_item_option(...)`, `delete_catalog_item_option(...)`, `set_global_fixed_price(...)` y `set_global_price_variant(...)`: cambios build-time que requieren publicacion y no editan disponibilidad.
- `can_edit_availability(text)`, `can_edit_menu_content()`, `can_manage_staff()` y `can_publish_menu()`: helpers de permisos.
- `reserve_menu_publish_request(...)` y `complete_menu_publish_request(...)`: helpers `security definer` service-role-only usados por la Edge Function.

Las RPCs operativas devuelven `ok`, `changed`, `requires_redeploy`, `operation` y `message`. Las respuestas de publicacion pueden incluir `cooldown_seconds_remaining`.

Las funciones publicas del admin son wrappers `security invoker`; los cuerpos `security definer` viven en `app_private`, fuera de los schemas expuestos por PostgREST. La excepcion actual son los helpers publicos de publicacion `reserve_menu_publish_request(...)` y `complete_menu_publish_request(...)`, revocados para `anon` y `authenticated` y ejecutables solo por `service_role`; no son RPCs del browser ni del admin.

`publish-menu-changes` valida la sesion Supabase Auth del empleado, verifica `can_publish_menu()`, aplica cooldown global, registra auditoria privada y llama el Vercel Deploy Hook desde secretos de Supabase Functions. Cada publicacion aceptada registra un fingerprint del contenido build-time para auditoria. Durante el build, `/admin/` embebe el fingerprint del contenido desplegado y lo compara contra el estado actual de Supabase para mostrar pendientes; por eso un deploy remoto tambien deja el estado limpio si se construyo con la BBDD actualizada. La URL del hook es credencial y nunca debe llegar al browser ni versionarse. No se usa `pg_net` para publicar.

La proteccion contra passwords filtradas se habilita en Supabase Auth settings del proyecto, no por migracion SQL.

SQL disponible:

- `supabase/migrations/`: baseline prelanzamiento y migraciones posteriores; es la ubicacion canonica para Supabase CLI.
- `docs/supabase/README.md`: flujo local-first, orden de ejecucion y reglas de aplicacion remota.
- `docs/supabase/schema-diagram.md`: diagrama Mermaid del schema estructural y runtime operativo.
- `docs/supabase/audits/`: auditorias read-only.

Flujo local-first para cambios de base:

1. Versionar migraciones aplicables dentro de `supabase/migrations/`; conservar documentacion y auditorias read-only dentro de `docs/supabase/`.
2. Actualizar `docs/supabase/schema-diagram.md` si cambia el esquema o una relacion.
3. Ejecutar primero los audits read-only contra la base apuntada por `SUPABASE_DB_URL`.
4. Ejecutar `npm run menu:validate`, `npm run build`, `npm run verify:dist-secrets` y `npm run check`.
5. Aplicar SQL mutante en Supabase remoto solo si los audits y validaciones pasan.

Baseline prelanzamiento:

- `20260606235844_prelaunch_baseline.sql` crea una base nueva con el modelo, contenido build-time, RPCs, permisos y hardening vigentes.
- El tag `supabase-prelaunch-history-2026-06-06` preserva la historia incremental anterior.
- El baseline no incluye usuarios Auth, filas de `staff_users`, overlays de disponibilidad ni logs de publicacion.
- No ejecutar el baseline sobre una base existente. Las bases ya desplegadas deben alinear solo su historial despues de verificar equivalencia.
- Todo cambio posterior debe agregarse como una nueva migracion incremental.

## CMS operativo de menu

`/admin/` es una ruta Astro estatica con cliente TypeScript. Usa Supabase Auth mediante `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`.

El alcance buscado es un CMS operativo de contenido de menu: mas amplio que un panel de disponibilidad, pero todavia acotado al dominio del menu QR. No administra paginas institucionales, contenido de marketing, cuentas de clientes ni flujos comerciales. Salvo disponibilidad, los cambios que toca siguen siendo datos build-time y requieren publicacion/rebuild para verse en el menu publico.

El admin permite:

- iniciar sesion y cerrar sesion
- recuperar y cambiar la contrasena del usuario staff
- leer el estado operativo via `get_admin_operational_state()`
- editar disponibilidad
- editar el menu del dia base
- cambiar el servicio activo por local entre `daily-menu` y `grill`
- agregar, renombrar y eliminar productos de parrilla, y agregar, editar o eliminar sus opciones/precios
- agregar, editar nombre/descripcion y eliminar items puntuales del menu fijo dentro de secciones existentes
- agregar, editar nombre y eliminar opciones de items del menu fijo que ya usan sabores, como empanadas o tartas, sin permitir que una subcategoria quede sin sabores
- en `Menu fijo`, la seccion operativa `tartas-tortillas-omelettes` se muestra como `Tartas, tortillas y omelettes`, incluye tartas, tortilla y omelette, y solo permite administrar sabores en items que ya usan opciones; `empanadas` tambien permite solo administrar sabores de `empanadas`
- las guarniciones se administran como opciones incluidas salvo `guarnicion-sola`, que conserva precio fijo; el admin no expone precios para esas altas incluidas y las nuevas opciones se insertan antes de la ultima opcion existente
- editar menu del dia y parrilla desde `Servicio`; `Menu fijo` queda para el catalogo estable compartido y sus precios globales
- solicitar publicacion mediante `publish-menu-changes`

El link de recuperacion de contrasena vuelve a `/admin/`, donde el cliente lee el token de Supabase Auth y permite definir una nueva contrasena. Supabase Auth debe permitir la URL de redirect de produccion `https://elfaraoncatering.vercel.app/admin/` y, para pruebas locales, `http://localhost:4321/admin/`.

No existe administracion de empleados en la UI actual. No existe CMS editorial amplio. La edicion de parrilla trata las familias como productos visibles y permite crear, renombrar o eliminar productos completos, ademas de administrar sus opciones y precios. No permite reordenar productos u opciones, editar IDs tecnicos, editar disponibilidad ni administrar imagenes; los IDs nuevos se generan del lado de Supabase. Las altas y los renombrados rechazan nombres visibles duplicados dentro del mismo contexto operativo con mensajes aptos para el operador. La edicion de items del menu fijo no permite crear, eliminar, renombrar ni reordenar secciones, ni reordenar opciones, ni editar disponibilidad. En las ubicaciones de solo sabores (`Tartas, tortillas y omelettes` y `Empanadas`) tampoco permite agregar, editar ni eliminar items. Los precios se editan con los RPCs globales de precios, presentados dentro de la pantalla del menu correspondiente, excepto en el editorial de guarniciones incluidas.

## Despliegue

La fase actual esta preparada para despliegue estatico en **Vercel**. El proyecto es static-first con extensiones cliente no bloqueantes.

Restricciones de esta etapa:

- no hay SSR
- no hay adapter de servidor
- no hay Vercel Functions ni funciones server-side del sitio Astro
- hay una Supabase Edge Function aislada para publicacion operativa
- `/admin/` es estatico y no agrega SSR ni server output
- no hay escritura editorial amplia desde `/admin/` ni desde el sitio publico; `/admin/` se limita al CMS operativo de contenido de menu
- no hay consultas directas desde el navegador a `menu_content` o `app_private`

`vercel.json` define headers de seguridad y canonicaliza `/menu`, `/menu/corpo`, `/menu/teleinde` y `/admin` hacia sus rutas con slash final.

## Fuera de alcance

No agregar estas capacidades salvo pedido explicito:

- online ordering
- checkout o pagos online
- WhatsApp ordering
- reservas
- cuentas de usuario publicas
- carrito
- SSR
- Vercel serverless functions
- nuevas Supabase Edge Functions fuera de `publish-menu-changes`
- CMS editorial amplio, auth no operativa o flujos de escritura editorial fuera del contenido operativo de menu

## Decisiones tecnicas actuales

- Se usa **Astro 6** con **Node 22 LTS**.
- Se usa **Tailwind CSS 4** mediante el plugin de Vite.
- El sitio sigue siendo **static-first** con extensiones cliente no bloqueantes.
- Supabase `menu_content` es la fuente estructural build-time.
- El overlay runtime de disponibilidad queda separado de la estructura del menu.
- `/admin/` es una ruta Astro estatica con cliente TypeScript y Supabase Auth.
- La publicacion operativa se concentra en la Supabase Edge Function `publish-menu-changes`.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- El contenido visible para usuarios esta en **espanol**.

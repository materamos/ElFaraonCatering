# El Faraon Catering

Sistema de menu digital QR para los buffets operados por **El Faraon Catering** en los dos edificios de **Telefe**.

El proyecto esta orientado al uso cotidiano en contexto laboral, con una experiencia rapida, clara y mobile-first para tecnicos, produccion, oficinas y personal que consulta el menu desde el telefono.

La fase actual es informativa. No incluye pedidos, pagos online, reservas, cuentas de usuario, carrito ni flujos de compra. Los accesos de WhatsApp, cuando existen, son solo vias de contacto para informacion; no son un flujo de pedidos.

## Estado actual

- `/menu/corpo/` es el menu operativo principal.
- `/menu/teleinde/` esta activo como parte del modelo multi-locacion.
- `/menu/` redirige temporalmente a `/` y no lista accesos publicos a menus por ubicacion.
- `/` es la landing institucional publica.
- `/admin/` es el CMS operativo estatico de contenido de menu para empleados.
- Supabase `menu_content` es la fuente estructural y operativa build-time del menu.
- Astro usa output estatico por default y no hay adapter de servidor.
- El overlay runtime de disponibilidad esta separado y se consume desde JavaScript cliente.
- `public.staff_users` define empleados y roles operativos.
- `/admin/` lee y escribe mediante RPCs Supabase controladas, sin grants directos sobre `menu_content`.
- El admin activo cubre un punto intermedio de CMS: disponibilidad, servicio del dia, parrilla, contenido de menu fijo, opciones de subcategorias, precios y publicacion, sin convertirse en un CMS editorial amplio.

## Stack tecnico

- Astro 7
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
| `npm run check:js` | Ejecuta `node --check` sobre JS/MJS fuera del typecheck de Astro. |
| `npm run lint` | Ejecuta ESLint sobre TypeScript, scripts y la Edge Function aprobada. |
| `npm run test:admin` | Ejecuta tests puntuales de reglas, selectores, contratos de render y operaciones del admin. |
| `npm run test:menu` | Ejecuta tests del overlay publico de disponibilidad. |
| `npm run preview` | Sirve el build localmente para revision. |
| `npm run menu:validate` | Valida contenido estructural y hardening esperado en Supabase. Requiere `SUPABASE_DB_URL`. |
| `npm run verify:dist-secrets` | Revisa `dist/` para detectar marcadores de secretos despues del build. |
| `npm run supabase:audit` | Ejecuta los audits SQL read-only y falla ante risks, diagnostics o estados estructurales no esperados. Requiere `SUPABASE_DB_URL`. |
| `npm run supabase -- <args>` | Ejecuta Supabase CLI local del proyecto. |
| `npm run supabase:link` | Vincula el entorno local con un proyecto Supabase remoto. Requiere project ref y credenciales. |
| `npm run supabase:migrations` | Lista migraciones locales/remotas con Supabase CLI. Requiere proyecto vinculado o `-- --db-url`. |
| `npm run supabase:functions:deploy` | Despliega solo la Edge Function aprobada `publish-menu-changes` con `--no-verify-jwt`. |

Validacion recomendada:

- `npm run test:admin` para cambios en admin UI, reglas, selectores u operaciones.
- `npm run test:menu` para cambios en el overlay publico de disponibilidad.
- `npm run check` para cambios TypeScript/Astro.
- `npm run check:js` para cambios en `public/scripts/`, `scripts/` o utilidades `.mjs`.
- `npm run lint` para TypeScript, scripts publicos, utilidades y Supabase Edge Functions.
- `npm run build` y luego `npm run verify:dist-secrets` antes de entregar cambios de app.
- `npm run supabase:audit` y `npm run menu:validate` cuando cambie Supabase, el shape del menu o contenido build-time.

Secuencia completa para cambios que tocan app y contenido build-time:

```bash
npm run supabase:audit
npm run menu:validate
npm run test:admin
npm run test:menu
npm run check:js
npm run lint
npm run build
npm run verify:dist-secrets
npm run check
```

En CI, los PRs de Dependabot ejecutan solo las gates que no requieren secrets:
`check`, `check:js`, `lint`, `test:admin` y `test:menu`. Las gates que dependen de Supabase remoto
(`menu:validate`, `supabase:audit`, `build` y `verify:dist-secrets`) se omiten
para Dependabot porque `build` necesita `SUPABASE_DB_URL` para prerenderizar el
hash de publicacion de `/admin/`.

## Estructura del proyecto

```text
src/
  admin/
    main.ts
    styles.css
    api/
      client.ts
      sessionStorage.ts
    app/
      actionHandlers.ts
      availabilityActionHandlers.ts
      confirmations.ts
      deleteActionHandlers.ts
      eventHandlers.ts
      formHandlers.ts
      formState.ts
      publicationState.ts
      publishActionHandlers.ts
      session.ts
    core/
      adminState.ts
      contracts.ts
      format.ts
      forms.ts
      responses.ts
      rules.ts
      selectors.ts
      types.ts
      url.ts
      viewState.ts
    operations/
      availability.ts
      catalog.ts
      grill.ts
      helpers.ts
      index.ts
      prices.ts
      publish.ts
      service.ts
      types.ts
    views/
      account.ts
      auth.ts
      availability.ts
      fixedMenu.ts
      html.ts
      passwordToggle.ts
      prices.ts
      renderer.ts
      service.ts
      shell.ts
  components/
    CompactMenuItem.astro
    DishCard.astro
    MenuPage.astro
    MenuSection.astro
  layouts/
    BaseLayout.astro
  pages/
    admin/index.astro
    index.astro
    menu/
      corpo/index.astro
      teleinde/index.astro
  styles/
    global.css
  types/
    menu.ts
  utils/
    menuContent.ts
    menuImagePath.d.mts
    menuImagePath.mjs
    menuPricing.ts
    menuSupabaseContent.ts
    menuSupabaseSnapshot.mjs
public/
  brand/
  fonts/
  icons/
  scripts/
    menu-availability-overlay.js
    menu-index-sticky.js
    menu-photo-sheet.js
  uploads/
scripts/
  audit-supabase-readonly.mjs
  check-js-syntax.mjs
  load-local-env.mjs
  menu-content-supabase.mjs
  optimize-menu-images.mjs
  test-admin-helpers.mjs
  test-admin-operations.mjs
  test-admin-render-contracts.mjs
  test-admin-rules-selectors.mjs
  test-menu-availability-overlay.mjs
  validate-menu-supabase.mjs
  verify-dist-secrets.mjs
supabase/
  config.toml
  functions/
    _shared/
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
- `app_private.menu_change_events`: auditoria privada de cambios build-time aplicados por RPCs del admin, enlazados a la publicacion exitosa que los incluye.
- `publish-menu-changes`: Supabase Edge Function server-side que dispara el Vercel Deploy Hook.

El overlay runtime no administra estructura, textos, precios, imagenes ni menu diario. Si no existe overlay para un item, el menu estatico generado en build-time lo trata como disponible.

Roles operativos:

- `operator`: edita todo lo que permite `/admin/`, para todos los locales, y puede publicar cambios.
- `admin`: hereda permisos operativos y puede gestionar empleados a nivel de base/RPC. El sitio no tiene una pantalla de gestion de empleados.

`staff_users.default_availability_profile_id` puede definir el local que aparece seleccionado por defecto en el filtro de disponibilidad de `/admin/`. Es solo una preferencia de UI: no limita permisos ni cambia que `operator` pueda editar todos los locales.

El primer `admin` se crea exclusivamente mediante SQL privilegiado; `service_role` no tiene acceso directo a `public.staff_users` y el bootstrap no se realiza desde browser RLS.

RPCs y funciones relevantes:

- `get_admin_operational_state()`: lectura controlada para `/admin/`.
- `set_menu_availability_overlay(...)` y `clear_menu_availability_overlay(...)`: cambios runtime de disponibilidad.
- `set_daily_menu(...)`, `set_profile_service_kind(...)`, `add_grill_product(...)`, `update_grill_product(...)`, `delete_grill_product(...)`, `add_grill_item(...)`, `update_grill_item(...)`, `delete_grill_item(...)`, `add_catalog_item(...)`, `update_catalog_item(...)`, `delete_catalog_item(...)`, `add_catalog_item_option(...)`, `update_catalog_item_option(...)`, `delete_catalog_item_option(...)`, `set_global_fixed_price(...)` y `set_global_price_variant(...)`: cambios build-time que requieren publicacion y no editan disponibilidad.
- `can_edit_availability(text)`, `can_edit_menu_content()`, `can_manage_staff()` y `can_publish_menu()`: helpers de permisos.
- `reserve_menu_publish_request(...)` y `complete_menu_publish_request(...)`: helpers `security definer` service-role-only usados por la Edge Function.

Las RPCs operativas devuelven `ok`, `changed`, `requires_redeploy`, `operation` y `message`. Las respuestas de publicacion pueden incluir `cooldown_seconds_remaining`.

Las funciones publicas del admin son wrappers `security invoker`; los cuerpos `security definer` viven en `app_private`, fuera de los schemas expuestos por PostgREST. La excepcion actual son los helpers publicos de publicacion `reserve_menu_publish_request(...)` y `complete_menu_publish_request(...)`, revocados para `anon` y `authenticated` y ejecutables solo por `service_role`; no son RPCs del browser ni del admin.

`publish-menu-changes` valida la sesion Supabase Auth del empleado, verifica `can_publish_menu()`, aplica cooldown global, registra auditoria privada y llama el Vercel Deploy Hook desde secretos de Supabase Functions. Cada publicacion aceptada registra un fingerprint del contenido build-time para auditoria. Las RPCs build-time del admin registran eventos privados con usuario, operacion, parametros y hash resultante; al completarse una publicacion exitosa, esos eventos quedan asociados al request de publicacion. La disponibilidad runtime queda fuera de ese log de deploy. Durante el build, `/admin/` embebe el fingerprint del contenido desplegado y lo compara contra el estado actual de Supabase para mostrar pendientes; por eso un deploy remoto tambien deja el estado limpio si se construyo con la BBDD actualizada. La URL del hook es credencial y nunca debe llegar al browser ni versionarse. No se usa `pg_net` para publicar.

La proteccion contra passwords filtradas se habilita en Supabase Auth settings del proyecto, no por migracion SQL.

SQL disponible:

- `supabase/migrations/`: baseline unica de prelanzamiento para bases nuevas; es la ubicacion canonica para Supabase CLI.
- `docs/supabase/README.md`: flujo local-first, orden de ejecucion y reglas de aplicacion remota.
- `docs/supabase/schema-diagram.md`: diagrama Mermaid del schema estructural y runtime operativo.
- `docs/supabase/audits/`: auditorias read-only.

Flujo local-first para cambios de base:

1. Versionar migraciones aplicables dentro de `supabase/migrations/`; conservar documentacion y auditorias read-only dentro de `docs/supabase/`.
2. Actualizar `docs/supabase/schema-diagram.md` si cambia el esquema o una relacion.
3. Ejecutar primero `npm run supabase:audit` contra la base apuntada por `SUPABASE_DB_URL`.
4. Ejecutar `npm run menu:validate`, `npm run build`, `npm run verify:dist-secrets` y `npm run check`.
5. Aplicar SQL mutante en Supabase remoto solo si los audits y validaciones pasan.

Baseline prelanzamiento:

- `20260707000000_prelaunch_baseline.sql` crea una base nueva con el modelo, contenido build-time, RPCs, permisos, auditoria privada, publicacion y hardening vigentes.
- El tag `supabase-prelaunch-history-2026-07-07` preserva la historia incremental anterior al squash de handoff.
- El baseline no incluye usuarios Auth, filas de `staff_users`, overlays de disponibilidad ni logs de publicacion o cambios.
- No ejecutar el baseline sobre una base existente. Las bases ya desplegadas deben alinear solo su historial despues de verificar equivalencia.
- Todo cambio posterior debe agregarse como una nueva migracion incremental.

Audit de entrega Supabase:

- Ultimo audit remoto read-only ejecutado para el handoff: `npm run supabase:audit`, `npm run menu:validate`, `npm run check:js`, `npm run verify:dist-secrets`, `npm run supabase -- db advisors --db-url <SUPABASE_DB_URL>` y `npm run supabase -- db lint --db-url <SUPABASE_DB_URL> --schema public,menu_content,app_private --fail-on none`.
- El remoto actual usa PostgreSQL 17.6 y conserva el historial pre-squash completo. Eso es esperado para la base existente; no aplicar la baseline unica sobre ese remoto.
- La superficie publica anon queda limitada a las columnas publicas de `public.menu_availability_overlays`. `menu_content`, `app_private`, `staff_users`, RPCs admin y la Edge Function de publicacion quedan bloqueados sin sesion/rol adecuado.
- El hash build-time actual de Supabase y el hash embebido en `/admin/` desplegado deben coincidir. No usar el ultimo `app_private.menu_publish_requests` como fuente unica para decidir si hay publicacion pendiente, porque puede existir un deploy externo que ya haya dejado el sitio alineado.
- En el handoff, revisar manualmente en Supabase Dashboard la configuracion que no vive en SQL: redirects de Auth, leaked password protection si el plan lo soporta, estado de usuarios staff, y secretos de `publish-menu-changes`.

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
- en `Menu fijo`, la seccion operativa `tartas-tortillas-omelettes` se muestra como tres ubicaciones separadas de admin: `Tartas`, `Tortillas` y `Omelettes`, manteniendo el mismo `section_id` tecnico; `empanadas` tambien permite solo administrar sabores de `empanadas`
- las guarniciones se administran como opciones incluidas salvo `guarnicion-sola`, que conserva precio fijo; el admin no expone precios para esas altas incluidas y las nuevas opciones se insertan antes de la ultima opcion existente
- editar menu del dia y parrilla desde `Servicio`; `Menu fijo` queda para el catalogo estable compartido y sus precios globales
- solicitar publicacion mediante `publish-menu-changes`

El link de recuperacion de contrasena vuelve a `/admin/`, donde el cliente lee el token de Supabase Auth y permite definir una nueva contrasena. Supabase Auth debe permitir la URL de redirect de produccion `https://elfaraoncatering.vercel.app/admin/` y, para pruebas locales, `http://localhost:4321/admin/`.

### Pruebas Auth y emails

Los flujos de `/admin/` usan Supabase Auth y pueden enviar emails reales, por ejemplo recuperacion de contrasena, invitaciones, confirmacion, magic links u OTP si se habilitan. En desarrollo o auditorias con browser contra el proyecto remoto, evitar direcciones inventadas porque los rebotes pueden afectar la deliverability del proyecto.

Para pruebas normales de login, usar primero un usuario staff real existente. Si es indispensable probar un flujo que envia email, usar una casilla real controlada con plus addressing, pero no versionar la direccion. Si se crean usuarios temporales, eliminarlos o revocarlos al terminar; esa limpieza no evita rebotes de emails que ya fueron enviados.

No existe administracion de empleados en la UI actual. No existe CMS editorial amplio. La edicion de parrilla trata las familias como productos visibles y permite crear, renombrar o eliminar productos completos, ademas de administrar sus opciones y precios. No permite reordenar productos u opciones, editar IDs tecnicos, editar disponibilidad ni administrar imagenes; los IDs nuevos se generan del lado de Supabase. Las altas y los renombrados rechazan nombres visibles duplicados dentro del mismo contexto operativo con mensajes aptos para el operador. La edicion de items del menu fijo no permite crear, eliminar, renombrar ni reordenar secciones, ni reordenar opciones, ni editar disponibilidad. En las ubicaciones de solo sabores (`Tartas`, `Tortillas`, `Omelettes` y `Empanadas`) tampoco permite agregar, editar ni eliminar items. Los precios se editan con los RPCs globales de precios, presentados dentro de la pantalla del menu correspondiente, excepto en el editorial de guarniciones incluidas.

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

`vercel.json` define headers de seguridad, marca `/menu/corpo/`, `/menu/teleinde/` y `/admin/` como no indexables, redirige temporalmente `/menu` y `/menu/` hacia `/`, y canonicaliza `/menu/corpo`, `/menu/teleinde` y `/admin` hacia sus rutas con slash final.

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

Los links `wa.me` del menu quedan permitidos solo como contacto informativo. No deben presentarse ni evolucionar como pedidos por WhatsApp, mensajes prearmados de compra, derivacion de carrito o reemplazo de checkout sin una decision explicita de alcance.

## Decisiones tecnicas actuales

- Se usa **Astro 7** con **Node 22 LTS**.
- Se usa **Tailwind CSS 4** mediante el plugin de Vite.
- El sitio sigue siendo **static-first** con extensiones cliente no bloqueantes.
- Supabase `menu_content` es la fuente estructural build-time.
- El overlay runtime de disponibilidad queda separado de la estructura del menu.
- `/admin/` es una ruta Astro estatica con cliente TypeScript y Supabase Auth.
- La publicacion operativa se concentra en la Supabase Edge Function `publish-menu-changes`.
- Los nombres tecnicos, archivos y componentes estan en **ingles**.
- Dentro de carpetas que ya dan contexto, los archivos no repiten ese contexto: por ejemplo `admin/views/service.ts`, `admin/operations/catalog.ts` y `admin/operations/index.ts`.
- El contenido visible para usuarios esta en **espanol**.

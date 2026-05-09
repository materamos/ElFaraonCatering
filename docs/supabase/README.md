# Supabase local-first workflow

Esta carpeta contiene la definicion versionada de la base Supabase usada por el
menu QR. Los archivos SQL no se eliminan despues de ejecutarse: documentan el
estado esperado, permiten auditar drift y dejan una ruta reproducible para revisar
o reconstruir la base.

## Superficies

- `menu_content`: fuente privada de estructura y operacion build-time.
- `public.menu_availability_overlays`: unico overlay runtime sin rebuild.
- `public.staff_users`: usuarios autenticados, roles y alcance por perfil para el CMS operativo.
- `public.editor_profiles`: tabla legacy temporal usada solo para backfill hacia `staff_users`.
- `public.get_admin_operational_state()`: RPC de lectura controlada para `/admin/`.
- RPCs operativas: unica superficie de escritura para disponibilidad, servicio activo, menu del dia y precios.
- `publish-menu-changes`: Supabase Edge Function server-side para publicar cambios build-time sin exponer el Deploy Hook.

Supabase puede respaldar un CMS operativo, pero "CMS editable" no significa
"runtime editable". Salvo disponibilidad, todo cambio operativo en Supabase
requiere rebuild/deploy para impactar `/menu/corpo/` y `/menu/teleinde/`.

## Modelo activo

El modelo activo de `menu_content` es plano y orientado al dominio real:

- Perfiles, facts y pagos se leen en build-time.
- `menu_daily_items` contiene las cuatro opciones reales del menu del dia: comun, comun con bebida, vegetariano y vegetariano con bebida.
- `menu_profile_service_settings.service_kind` define por local `daily-menu` o `grill`.
- `menu_catalog_sections`, `menu_catalog_groups`, `menu_catalog_items` y `menu_catalog_item_options` contienen el catalogo estable.
- `menu_grill_families` y `menu_grill_catalog_items` contienen la lista fija de parrilla.
- `menu_prices` y `menu_price_variants` contienen precios globales build-time.

La primera migracion remota al modelo plano conservo tablas legacy para validar
deploy. La migracion posterior `20260506002000_drop_legacy_menu_content_model.sql`
elimina esas tablas despues de confirmar que el loader activo no las usa.

## Frontera build-time/runtime

Editables build-time con rebuild requerido:

- menu del dia base: nombre, descripcion y nota
- servicio activo por local: `daily-menu` o `grill`
- precios globales en `menu_prices` y `menu_price_variants`
- catalogo, grupos, secciones, imagenes y textos estructurales

Editable runtime sin rebuild:

- disponibilidad por local usando exclusivamente `public.menu_availability_overlays`

Permisos del CMS operativo:

- `staff_users.role = 'availability_editor'`: puede editar disponibilidad; si `profile_id` es null, aplica a todos los perfiles; si no, solo a ese perfil.
- `staff_users.role = 'menu_editor'`: puede publicar cambios build-time mediante flujos seguros futuros.
- `staff_users.role = 'admin'`: puede gestionar empleados y hereda los permisos operativos.
- `editor_profiles` no debe usarse para policies nuevas; queda solo como origen de migracion.
- El primer `admin` debe crearse por SQL privilegiado o service role; luego los admins pueden gestionar empleados desde el CMS futuro.
- Las RPCs operativas devuelven `ok`, `changed`, `requires_redeploy`, `operation` y `message`.
- `staff_users` y sus helpers (`can_edit_availability(text)`, `can_manage_staff()`, `can_publish_menu()`) son precondicion obligatoria para instalar `operational-edit-rpcs.sql`.
- `can_edit_menu_content()` se introduce en la fase de RPCs operativas; no es precondicion de la migracion de `staff_users`.
- `publish-menu-changes` usa `can_publish_menu()` para autorizar publicacion, registra auditoria minima privada en `app_private` y llama el Vercel Deploy Hook desde secretos de Supabase Functions. No usa `pg_net`.
- `/admin/` lee estado operativo mediante `get_admin_operational_state()` y escribe solo mediante RPCs operativas; no hay grants client-facing sobre `menu_content` ni `app_private`.

No implementar consultas runtime para menu del dia, precios, servicio activo,
catalogo, grupos, secciones, imagenes ni textos estructurales.

## Archivos

Archivos que modifican schema o datos:

- `schema.sql`: estado limpio esperado del schema privado `menu_content`.
- `daily-service-data.sql`: defaults del servicio diario y parrilla fija para bases nuevas.
- `availability-overlay.sql`: tablas, funciones, indices y policies del overlay runtime y roles de staff.
- `operational-edit-rpcs.sql`: RPCs de edicion operativa para disponibilidad, servicio activo, menu del dia y precios.
- `hardening.sql`: constraints e indices idempotentes del modelo activo.

Migraciones operativas:

- `../../supabase/migrations/`: cambios incrementales aplicables a bases existentes y ubicacion canonica para Supabase CLI, incluyendo `20260508000000_add_staff_users.sql`, `20260508001000_add_operational_edit_rpcs.sql`, `20260508002000_harden_security_definer_search_path.sql`, `20260508003000_add_publish_menu_changes_support.sql` y `20260508004000_add_admin_operational_state_rpc.sql`.

Archivos read-only:

- `audits/menu-schema-audit.sql`: revisa tablas, constraints, indices y diagnosticos del modelo activo.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion, policies y hallazgos.
- `schema-diagram.md`: mapa versionado de `menu_content` y overlay runtime.

Esta carpeta conserva documentacion tecnica, snapshots, SQL de referencia y auditorias. No contiene las migraciones operativas del proyecto.

## Orden recomendado

Para una base nueva:

1. Ejecutar `schema.sql`.
2. Cargar perfiles/catalogo base.
3. Ejecutar `daily-service-data.sql`.
4. Ejecutar `availability-overlay.sql` si se usara el overlay runtime.
5. Ejecutar `operational-edit-rpcs.sql` si se usara el CMS operativo.
6. Ejecutar `hardening.sql`.
7. Ejecutar `audits/menu-schema-audit.sql`.
8. Ejecutar `audits/database-audit.sql`.
9. Ejecutar validaciones del repo.

Para una base existente:

1. Ejecutar primero los SQL de `audits/`.
2. Resolver cualquier fila que bloquee constraints o indices.
3. Revisar y versionar el SQL idempotente que se quiere aplicar.
4. Aplicar `../../supabase/migrations/20260506000000_flatten_menu_content_model.sql` para crear y poblar el modelo activo.
5. Ejecutar `hardening.sql`.
6. Volver a ejecutar audits y validaciones.
7. Validar deploy.
8. Aplicar `../../supabase/migrations/20260506002000_drop_legacy_menu_content_model.sql` solo despues de confirmar que no quedan dependencias activas.
9. Aplicar `../../supabase/migrations/20260507000000_dedupe_menu_content_indexes.sql` para descartar indices unique redundantes que duplicaban los auto-generados por las clausulas `unique (...)` y la constraint vestigial `(id, item_id)` en `menu_catalog_items`. Idempotente.
10. Aplicar `../../supabase/migrations/20260508000000_add_staff_users.sql` para migrar permisos de overlay desde `editor_profiles` hacia `staff_users`.
11. Aplicar `../../supabase/migrations/20260508001000_add_operational_edit_rpcs.sql` para instalar las RPCs operativas y el modelo de cuatro opciones del menu del dia.
12. Aplicar `../../supabase/migrations/20260508002000_harden_security_definer_search_path.sql` para endurecer el `search_path` de funciones `security definer` ya instaladas.
13. Aplicar `../../supabase/migrations/20260508003000_add_publish_menu_changes_support.sql` para crear el log privado y helpers internos de `publish-menu-changes`.
14. Aplicar `../../supabase/migrations/20260508004000_add_admin_operational_state_rpc.sql` para instalar la lectura controlada del admin operativo.

## Variables

- `SUPABASE_DB_URL`: conexion privada Postgres para build y validacion. Puede vivir en `.env.local` y nunca debe ser `PUBLIC_*`.
- `PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase para el overlay runtime.
- `PUBLIC_SUPABASE_ANON_KEY`: anon key publica para leer el overlay runtime con RLS.
- `VERCEL_DEPLOY_HOOK_URL`: secreto de Supabase Functions para `publish-menu-changes`; es credencial.
- `PUBLISH_ALLOWED_ORIGINS`: origins permitidos por CORS para la Edge Function, separados por coma.
- `PUBLISH_COOLDOWN_SECONDS`: cooldown global de publicacion; default recomendado `60`.

## Supabase CLI

El CLI esta instalado como dependencia de desarrollo del repo. Usar npm para fijar
la version del proyecto:

```bash
npm run supabase -- --version
npm run supabase:link -- --project-ref <project-ref>
npm run supabase:migrations
npm run supabase:functions:deploy
```

`npm run supabase:functions:deploy` despliega solo `publish-menu-changes` con
`--no-verify-jwt`, que coincide con `supabase/config.toml`. Es la unica Edge
Function aprobada para esta arquitectura. Configurar secretos con el CLI remoto,
por ejemplo:

```bash
npm run supabase -- secrets set VERCEL_DEPLOY_HOOK_URL=...
```

No versionar tokens, passwords, `.env.local` ni archivos temporales generados por
Supabase CLI.

## Flujo local primero

1. Versionar migraciones aplicables en `../../supabase/migrations/`; conservar en esta carpeta SQL de referencia, documentacion y auditorias.
2. Actualizar `schema-diagram.md` si cambia una tabla, columna clave o relacion.
3. Actualizar este README si cambia el orden de ejecucion o la superficie Supabase.
4. Correr los audits read-only contra la base apuntada por `SUPABASE_DB_URL`.
5. Correr:

```bash
npm run menu:validate
npm run build
npm run verify:dist-secrets
npm run check
```

No aplicar SQL mutante en Supabase remoto si los audits muestran bloqueos conocidos
o si `npm run menu:validate` falla.

## Cambios futuros

- No editar el estado remoto desde el dashboard sin reflejarlo en SQL versionado.
- Preferir SQL idempotente para cambios futuros.
- Mantener nombres tecnicos ASCII/kebab-case donde corresponda.
- Usar `staff_users` y funciones helper para permisos nuevos del CMS operativo; no reusar `editor_profiles` para nuevas policies.
- Usar RPCs operativas para escrituras desde el browser; no otorgar grants directos sobre `menu_content`.
- Usar `get_admin_operational_state()` para lectura del admin; no consultar `menu_content` ni `app_private` desde el browser.
- Usar `publish-menu-changes` para publicacion; no exponer el Vercel Deploy Hook, no usar `pg_net` y no otorgar grants client-facing sobre `app_private`.
- No agregar SSR, Vercel Functions, CMS editorial amplio, auth editorial ni queries estructurales desde el navegador por cambios en esta carpeta.

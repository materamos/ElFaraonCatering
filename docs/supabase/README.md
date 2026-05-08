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
deploy. La migracion posterior `2026-05-06-drop-legacy-menu-content-model.sql`
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

No implementar consultas runtime para menu del dia, precios, servicio activo,
catalogo, grupos, secciones, imagenes ni textos estructurales.

## Archivos

Archivos que modifican schema o datos:

- `schema.sql`: estado limpio esperado del schema privado `menu_content`.
- `daily-service-data.sql`: defaults del servicio diario y parrilla fija para bases nuevas.
- `availability-overlay.sql`: tablas, funciones, indices y policies del overlay runtime y roles de staff.
- `operational-edit-rpcs.sql`: RPCs de edicion operativa para disponibilidad, servicio activo, menu del dia y precios.
- `hardening.sql`: constraints e indices idempotentes del modelo activo.
- `migrations/`: cambios incrementales para bases existentes, incluyendo `2026-05-08-add-staff-users.sql`, `2026-05-08-add-operational-edit-rpcs.sql`, `2026-05-08-harden-security-definer-search-path.sql` y `2026-05-08-add-publish-menu-changes-support.sql`.

Archivos read-only:

- `audits/menu-schema-audit.sql`: revisa tablas, constraints, indices y diagnosticos del modelo activo.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion, policies y hallazgos.
- `schema-diagram.md`: mapa versionado de `menu_content` y overlay runtime.

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
4. Aplicar `migrations/2026-05-06-flatten-menu-content-model.sql` para crear y poblar el modelo activo.
5. Ejecutar `hardening.sql`.
6. Volver a ejecutar audits y validaciones.
7. Validar deploy.
8. Aplicar `migrations/2026-05-06-drop-legacy-menu-content-model.sql` solo despues de confirmar que no quedan dependencias activas.
9. Aplicar `migrations/2026-05-07-dedupe-menu-content-indexes.sql` para descartar indices unique redundantes que duplicaban los auto-generados por las clausulas `unique (...)` y la constraint vestigial `(id, item_id)` en `menu_catalog_items`. Idempotente.
10. Aplicar `migrations/2026-05-08-add-staff-users.sql` para migrar permisos de overlay desde `editor_profiles` hacia `staff_users`.
11. Aplicar `migrations/2026-05-08-add-operational-edit-rpcs.sql` para instalar las RPCs operativas y el modelo de cuatro opciones del menu del dia.
12. Aplicar `migrations/2026-05-08-harden-security-definer-search-path.sql` para endurecer el `search_path` de funciones `security definer` ya instaladas.
13. Aplicar `migrations/2026-05-08-add-publish-menu-changes-support.sql` para crear el log privado y helpers internos de `publish-menu-changes`.

## Variables

- `SUPABASE_DB_URL`: conexion privada Postgres para build y validacion. Puede vivir en `.env.local` y nunca debe ser `PUBLIC_*`.
- `PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase para el overlay runtime.
- `PUBLIC_SUPABASE_ANON_KEY`: anon key publica para leer el overlay runtime con RLS.
- `VERCEL_DEPLOY_HOOK_URL`: secreto de Supabase Functions para `publish-menu-changes`; es credencial.
- `PUBLISH_ALLOWED_ORIGINS`: origins permitidos por CORS para la Edge Function, separados por coma.
- `PUBLISH_COOLDOWN_SECONDS`: cooldown global de publicacion; default recomendado `60`.

## Flujo local primero

1. Hacer cambios en SQL versionado dentro de esta carpeta.
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
- Usar `publish-menu-changes` para publicacion; no exponer el Vercel Deploy Hook, no usar `pg_net` y no otorgar grants client-facing sobre `app_private`.
- No agregar SSR, Vercel Functions, CMS editorial amplio, auth editorial ni queries estructurales desde el navegador por cambios en esta carpeta.

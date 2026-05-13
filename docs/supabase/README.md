# Supabase local-first workflow

Esta carpeta contiene documentacion tecnica, snapshots SQL de referencia y auditorias para la base Supabase del menu QR.

Las migraciones operativas reales viven en `../../supabase/migrations/`. No agregar migraciones nuevas dentro de `docs/supabase/`.

## Superficies activas

- `menu_content`: fuente privada de estructura y operacion build-time.
- `public.menu_availability_overlays`: unico overlay runtime sin rebuild.
- `public.staff_users`: empleados, roles y alcance por perfil para el admin operativo.
- `public.editor_profiles`: tabla legacy usada solo como origen de backfill hacia `staff_users`.
- `public.get_admin_operational_state()`: RPC de lectura controlada para `/admin/`.
- RPCs operativas: unica superficie de escritura browser para disponibilidad, servicio activo, menu del dia y precios.
- `app_private.menu_publish_requests`: log privado y reserva de publicaciones.
- `publish-menu-changes`: Supabase Edge Function server-side para publicar cambios build-time sin exponer el Deploy Hook.

Supabase respalda un admin operativo, pero "editable" no significa "runtime editable". Salvo disponibilidad, todo cambio operativo en Supabase requiere rebuild/deploy para impactar `/menu/corpo/` y `/menu/teleinde/`.

## Modelo activo

El modelo activo de `menu_content` es plano y orientado al dominio real:

- Perfiles, facts y pagos se leen en build-time.
- `menu_daily_items` contiene las dos opciones reales del menu del dia: comun y vegetariano.
- `menu_profile_service_settings.service_kind` define por local `daily-menu` o `grill`.
- `menu_catalog_sections`, `menu_catalog_groups`, `menu_catalog_items` y `menu_catalog_item_options` contienen el catalogo estable.
- `menu_grill_families` contiene los items visibles de parrilla y `menu_grill_catalog_items` contiene sus variantes con precio y disponibilidad.
- `menu_prices` y `menu_price_variants` contienen precios globales build-time.

Las tablas legacy del modelo anterior fueron eliminadas por `20260506002000_drop_legacy_menu_content_model.sql` despues de validar que el loader activo ya no dependia de ellas. El tag historico `yaml-rollback-2026-05-02` existe solo como rollback al estado file-backed anterior; YAML no es fuente activa.

## Frontera build-time/runtime

Editables build-time con rebuild requerido:

- menu del dia base: nombre, descripcion y nota
- servicio activo por local: `daily-menu` o `grill`
- precios globales en `menu_prices` y `menu_price_variants`
- catalogo, grupos, secciones, imagenes y textos estructurales

Editable runtime sin rebuild:

- disponibilidad por local usando exclusivamente `public.menu_availability_overlays`

No implementar consultas runtime para menu del dia, precios, servicio activo, catalogo, grupos, secciones, imagenes ni textos estructurales.

## Permisos y admin

- `staff_users.role = 'availability_editor'`: puede editar disponibilidad; si `profile_id` es null, aplica a todos los perfiles; si no, solo a ese perfil.
- `staff_users.role = 'menu_editor'`: puede editar datos operativos build-time y publicar cambios.
- `staff_users.role = 'admin'`: hereda permisos operativos y puede gestionar staff a nivel de base/RPC.
- El sitio actual no tiene pantalla de gestion de empleados.
- `editor_profiles` no debe usarse para policies nuevas; queda solo como origen de migracion.
- El primer `admin` debe crearse por SQL privilegiado o service role; no se bootstrapea desde browser RLS.
- `/admin/` lee estado operativo mediante `get_admin_operational_state()` y escribe solo mediante RPCs operativas.
- No hay grants client-facing sobre `menu_content` ni `app_private`.

Las RPCs operativas devuelven `ok`, `changed`, `requires_redeploy`, `operation` y `message`. La publicacion puede devolver `cooldown_seconds_remaining`.

`staff_users` y sus helpers (`can_edit_availability(text)`, `can_manage_staff()`, `can_publish_menu()`) son precondicion obligatoria para instalar las RPCs operativas. `can_edit_menu_content()` se introduce en la fase de RPCs operativas; no es precondicion de la migracion de `staff_users`.

`publish-menu-changes` usa `can_publish_menu()` para autorizar publicacion, reserva/completa solicitudes mediante helpers privados, registra auditoria en `app_private` y llama el Vercel Deploy Hook desde secretos de Supabase Functions. No usa `pg_net`.

## Archivos en esta carpeta

Snapshots y SQL de referencia:

- `schema.sql`: estado limpio esperado del schema privado `menu_content`.
- `daily-service-data.sql`: defaults del servicio diario y parrilla fija para bases nuevas o reconstrucciones controladas.
- `availability-overlay.sql`: tablas, funciones, indices y policies del overlay runtime y roles de staff.
- `operational-edit-rpcs.sql`: RPCs de edicion operativa para disponibilidad, servicio activo, menu del dia y precios.
- `hardening.sql`: constraints e indices idempotentes del modelo activo.

Auditorias read-only:

- `audits/menu-schema-audit.sql`: revisa tablas, constraints, indices y diagnosticos del modelo activo.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion, policies, helpers y hallazgos.

Documentacion:

- `schema-diagram.md`: mapa Mermaid de `menu_content`, overlay runtime, admin operativo y publicacion.

Los archivos de esta carpeta sirven para revisar, auditar o reconstruir con control manual. No reemplazan la historia canonica de `../../supabase/migrations/`.

## Migraciones canonicas

Las migraciones aplicables a bases existentes viven en `../../supabase/migrations/` y deben mantenerse en orden cronologico:

| Migracion | Proposito |
| --- | --- |
| `20260504000000_drop_menu_prices_currency.sql` | Elimina currency del modelo de precios. |
| `20260506000000_flatten_menu_content_model.sql` | Crea y puebla el modelo plano activo. |
| `20260506001000_consolidate_daily_service_model.sql` | Consolida el servicio diario. |
| `20260506002000_drop_legacy_menu_content_model.sql` | Elimina tablas legacy del modelo anterior. |
| `20260506003000_remove_menu_override_pricing.sql` | Elimina pricing override no usado por el modelo actual. |
| `20260507000000_dedupe_menu_content_indexes.sql` | Quita indices redundantes del modelo activo. |
| `20260508000000_add_staff_users.sql` | Agrega `staff_users`, helpers y overlay runtime. |
| `20260508001000_add_operational_edit_rpcs.sql` | Agrega RPCs operativas y modelo operativo del menu del dia. |
| `20260508002000_harden_security_definer_search_path.sql` | Endurece `search_path` de funciones `security definer`. |
| `20260508003000_add_publish_menu_changes_support.sql` | Agrega `app_private` y helpers privados de publicacion. |
| `20260508004000_add_admin_operational_state_rpc.sql` | Agrega lectura controlada del admin operativo. |
| `20260508005000_disambiguate_availability_rpc_arguments.sql` | Desambigua argumentos de RPCs de disponibilidad. |
| `20260508006000_remove_availability_upsert_ambiguity.sql` | Evita ambiguedad en upsert de disponibilidad. |
| `20260509001000_remove_service_kind_profile_id_ambiguity.sql` | Desambigua `profile_id` en cambio de servicio activo. |
| `20260509002000_revoke_staff_users_trigger_helper_execute.sql` | Revoca execute client-facing del trigger helper de staff. |
| `20260509003000_add_publish_cooldown_remaining.sql` | Agrega segundos restantes al contrato de cooldown de publicacion. |
| `20260509004000_limit_availability_overlay_public_select.sql` | Limita la lectura publica del overlay a las columnas que consume el cliente. |
| `20260512000000_add_grill_variant_names.sql` | Agrega etiquetas cortas de variantes de parrilla. |
| `20260513000000_update_admin_grill_variant_targets.sql` | Expone nombres cortos y precios de variantes de parrilla en el RPC admin. |
| `20260513001000_remove_daily_menu_drink_options.sql` | Elimina las opciones con bebida del menu del dia y actualiza el RPC de edicion. |
| `20260513002000_order_admin_availability_targets.sql` | Ordena disponibilidad del admin por orden editorial de secciones, grupos, familias e items. |

## Orden recomendado

Para una base existente:

1. Ejecutar primero los SQL de `audits/` contra la base apuntada por `SUPABASE_DB_URL`.
2. Resolver cualquier fila que bloquee constraints, indices o permisos esperados.
3. Versionar el cambio aplicable en `../../supabase/migrations/`.
4. Aplicar migraciones con Supabase CLI o SQL revisado, manteniendo orden cronologico.
5. Volver a ejecutar audits.
6. Ejecutar validaciones del repo.
7. Aplicar cambios remotos solo si audits y validaciones pasan.

Para una base nueva:

1. Preferir la ruta canonica de Supabase CLI con `../../supabase/migrations/`.
2. Usar los snapshots de `docs/supabase/*.sql` solo para reconstrucciones manuales controladas o auditorias.
3. Si se usan snapshots manualmente, verificar despues contra `audits/menu-schema-audit.sql`, `audits/database-audit.sql` y `npm run menu:validate`.
4. No asumir que un snapshot aislado representa toda la superficie operativa si existen migraciones posteriores.

## Variables

- `SUPABASE_DB_URL`: conexion privada Postgres para build y validacion. Puede vivir en `.env.local` y nunca debe ser `PUBLIC_*`.
- `PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase para overlay runtime y admin.
- `PUBLIC_SUPABASE_ANON_KEY`: anon key publica para overlay runtime, Auth y RPCs controladas.
- `SUPABASE_URL`: variable de runtime disponible para Supabase Functions; `publish-menu-changes` la usa server-side.
- `SUPABASE_ANON_KEY`: variable de runtime disponible para Supabase Functions; `publish-menu-changes` la usa para validar la sesion del empleado.
- `SUPABASE_SERVICE_ROLE_KEY`: variable de runtime disponible para Supabase Functions; `publish-menu-changes` la usa solo server-side para helpers privados de publicacion.
- `VERCEL_DEPLOY_HOOK_URL`: secreto de Supabase Functions para `publish-menu-changes`; es credencial.
- `PUBLISH_ALLOWED_ORIGINS`: origins permitidos por CORS para la Edge Function, separados por coma.
- `PUBLISH_COOLDOWN_SECONDS`: cooldown global de publicacion; default recomendado `60`.

En este proyecto remoto, `npm run supabase -- secrets list` confirma esos nombres para el runtime de Functions. No exponer `SUPABASE_SERVICE_ROLE_KEY` ni `VERCEL_DEPLOY_HOOK_URL` como `PUBLIC_*`.

## Supabase CLI

El CLI esta instalado como dependencia de desarrollo del repo. Usar npm para fijar la version del proyecto:

```bash
npm run supabase -- --version
npm run supabase:link -- --project-ref <project-ref>
npm run supabase:migrations
npm run supabase:functions:deploy
```

`npm run supabase:functions:deploy` despliega solo `publish-menu-changes` con `--no-verify-jwt`, que coincide con `supabase/config.toml`. Es la unica Edge Function aprobada para esta arquitectura.

Configurar secretos con el CLI remoto, por ejemplo:

```bash
npm run supabase -- secrets set VERCEL_DEPLOY_HOOK_URL=...
```

No versionar tokens, passwords, `.env.local` ni archivos temporales generados por Supabase CLI.

## Flujo local primero

1. Versionar migraciones aplicables en `../../supabase/migrations/`; conservar en esta carpeta SQL de referencia, documentacion y auditorias.
2. Actualizar `schema-diagram.md` si cambia una tabla, columna clave, relacion o superficie runtime.
3. Actualizar este README si cambia el orden de ejecucion o la superficie Supabase.
4. Correr los audits read-only contra la base apuntada por `SUPABASE_DB_URL`.
5. Correr:

```bash
npm run menu:validate
npm run build
npm run verify:dist-secrets
npm run check
```

No aplicar SQL mutante en Supabase remoto si los audits muestran bloqueos conocidos o si `npm run menu:validate` falla.

## Cambios futuros

- No editar el estado remoto desde el dashboard sin reflejarlo en SQL versionado.
- Preferir SQL idempotente para cambios futuros cuando sea compatible con la migracion.
- Mantener nombres tecnicos ASCII/kebab-case donde corresponda.
- Usar `staff_users` y funciones helper para permisos nuevos del admin operativo; no reusar `editor_profiles` para nuevas policies.
- Usar RPCs operativas para escrituras desde el browser; no otorgar grants directos sobre `menu_content`.
- Usar `get_admin_operational_state()` para lectura del admin; no consultar `menu_content` ni `app_private` desde el browser.
- Usar `publish-menu-changes` para publicacion; no exponer el Vercel Deploy Hook, no usar `pg_net` y no otorgar grants client-facing sobre `app_private`.
- No agregar SSR, Vercel Functions, CMS editorial amplio, auth editorial ni queries estructurales desde el navegador por cambios en esta carpeta.

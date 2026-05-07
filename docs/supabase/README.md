# Supabase local-first workflow

Esta carpeta contiene la definicion versionada de la base Supabase usada por el
menu QR. Los archivos SQL no se eliminan despues de ejecutarse: documentan el
estado esperado, permiten auditar drift y dejan una ruta reproducible para revisar
o reconstruir la base.

## Superficies

- `menu_content`: fuente privada de estructura y operacion build-time.
- `public.menu_availability_overlays`: unico overlay runtime sin rebuild.
- `public.editor_profiles`: lista minima de usuarios autenticados que pueden editar overlays.

Supabase puede respaldar un CMS operativo, pero "CMS editable" no significa
"runtime editable". Salvo disponibilidad, todo cambio operativo en Supabase
requiere rebuild/deploy para impactar `/menu/corpo/` y `/menu/teleinde/`.

## Modelo activo

El modelo activo de `menu_content` es plano y orientado al dominio real:

- Perfiles, facts y pagos se leen en build-time.
- `menu_daily_items` contiene las tres opciones reales del menu del dia.
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

No implementar consultas runtime para menu del dia, precios, servicio activo,
catalogo, grupos, secciones, imagenes ni textos estructurales.

## Archivos

Archivos que modifican schema o datos:

- `schema.sql`: estado limpio esperado del schema privado `menu_content`.
- `daily-service-data.sql`: defaults del servicio diario y parrilla fija para bases nuevas.
- `availability-overlay.sql`: tablas, indices y policies del overlay runtime.
- `hardening.sql`: constraints e indices idempotentes del modelo activo.
- `migrations/`: cambios incrementales para bases existentes.

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
5. Ejecutar `hardening.sql`.
6. Ejecutar `audits/menu-schema-audit.sql`.
7. Ejecutar `audits/database-audit.sql`.
8. Ejecutar validaciones del repo.

Para una base existente:

1. Ejecutar primero los SQL de `audits/`.
2. Resolver cualquier fila que bloquee constraints o indices.
3. Revisar y versionar el SQL idempotente que se quiere aplicar.
4. Aplicar `migrations/2026-05-06-flatten-menu-content-model.sql` para crear y poblar el modelo activo.
5. Ejecutar `hardening.sql`.
6. Volver a ejecutar audits y validaciones.
7. Validar deploy.
8. Aplicar `migrations/2026-05-06-drop-legacy-menu-content-model.sql` solo despues de confirmar que no quedan dependencias activas.

## Variables

- `SUPABASE_DB_URL`: conexion privada Postgres para build y validacion. Puede vivir en `.env.local` y nunca debe ser `PUBLIC_*`.
- `PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase para el overlay runtime.
- `PUBLIC_SUPABASE_ANON_KEY`: anon key publica para leer el overlay runtime con RLS.

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
- No agregar SSR, serverless functions, CMS editorial amplio, auth editorial ni queries estructurales desde el navegador por cambios en esta carpeta.

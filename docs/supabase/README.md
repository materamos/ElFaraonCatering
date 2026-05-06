# Supabase local-first workflow

Esta carpeta contiene la definicion versionada de la base Supabase usada por el menu QR.
Los archivos SQL no se eliminan despues de ejecutarse: documentan el estado esperado,
permiten auditar drift y dejan una ruta reproducible para reconstruir o revisar la base.

## Superficies

- `menu_content`: fuente privada del menu operativo, leida por el build para estructura y precios.
- `public.menu_availability_overlays`: overlay runtime de disponibilidad, leido desde el cliente.
- `public.editor_profiles`: lista minima de usuarios autenticados que pueden editar overlays.

`menu_content` puede respaldar un CMS operativo limitado para menu del dia, parrilla,
disponibilidad y precios globales. No debe consultarse directamente desde el navegador
ni convertirse en un CMS editorial amplio sin una decision de arquitectura separada.

## Archivos

Archivos que modifican schema o datos:

- `schema.sql`: crea el schema estructural `menu_content`.
- `daily-service-data.sql`: inserta defaults del menu diario y parrilla fija.
- `availability-overlay.sql`: crea tablas, indices y policies del overlay runtime.
- `hardening.sql`: agrega constraints e indices idempotentes para bases existentes.
- `migrations/`: cambios incrementales versionados para bases existentes.

Reglas operativas relevantes:

- El menu del dia vigente vive en una sola fila compartida por los locales.
- `grill_enabled` decide por local si el servicio diario muestra menu del dia o parrilla.
- Los precios son globales; los overrides por local no pueden cambiar precios.
- La disponibilidad puede variar por local/menu.

Archivos read-only:

- `audits/menu-schema-audit.sql`: revisa constraints, indices y duplicados esperados.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion, policies y hallazgos.
- `schema-diagram.md`: mapa versionado principal para entender schemas, relaciones fisicas, relaciones logicas y statuses de auditoria.

## Orden recomendado

Para una base nueva:

1. Ejecutar `schema.sql`.
2. Ejecutar `daily-service-data.sql`.
3. Ejecutar `availability-overlay.sql` si se usara el overlay runtime.
4. Ejecutar `hardening.sql`.
5. Ejecutar `audits/menu-schema-audit.sql`.
6. Ejecutar `audits/database-audit.sql`.
7. Ejecutar validaciones del repo.

Para una base existente:

1. Ejecutar primero los SQL de `audits/`.
2. Resolver cualquier fila que bloquee constraints o indices.
3. Revisar y versionar el SQL idempotente que se quiere aplicar.
4. Si el cambio vive en `migrations/`, revisar el archivo completo antes de aplicarlo.
5. Aplicarlo en Supabase solo despues de validar localmente.
6. Volver a ejecutar audits y validaciones.

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

No aplicar `hardening.sql` ni nuevos SQL mutantes en Supabase remoto si los audits
muestran bloqueos conocidos o si `npm run menu:validate` falla.

## Cambios futuros

- No editar el estado remoto desde el dashboard sin reflejarlo en SQL versionado.
- Preferir SQL idempotente para cambios futuros.
- Mantener nombres tecnicos ASCII/kebab-case donde corresponda.
- No agregar SSR, serverless functions, CMS editorial amplio, auth editorial ni queries estructurales desde el navegador por cambios en esta carpeta.

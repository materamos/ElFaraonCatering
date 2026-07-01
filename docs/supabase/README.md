# Supabase local-first workflow

Esta carpeta contiene documentacion tecnica y auditorias read-only para la base Supabase del menu QR.

Las migraciones operativas reales viven en `../../supabase/migrations/`. No agregar migraciones nuevas dentro de `docs/supabase/`.
Los snapshots y SQL mutantes de referencia fueron retirados para evitar duplicar el baseline canonico.

## Superficies activas

- `menu_content`: fuente privada de estructura y operacion build-time.
- `public.menu_availability_overlays`: unico overlay runtime sin rebuild.
- `public.staff_users`: empleados y roles para el CMS operativo de menu.
- `public.get_admin_operational_state()`: RPC de lectura controlada para `/admin/`.
- RPCs operativas: unica superficie de escritura browser para disponibilidad, servicio activo, menu del dia, parrilla, contenido de menu fijo, opciones de subcategorias, precios y publicacion.
- `app_private.menu_publish_requests`: log privado, reserva de publicaciones y fingerprint del contenido solicitado desde `/admin/`.
- `app_private.menu_change_events`: log privado de cambios build-time hechos por RPCs del admin, con usuario, operacion, parametros y asociacion a la publicacion exitosa que los incluye.
- `publish-menu-changes`: Supabase Edge Function server-side para publicar cambios build-time sin exponer el Deploy Hook.

Supabase respalda un CMS operativo de contenido de menu, pero "editable" no significa "runtime editable". Salvo disponibilidad, todo cambio operativo en Supabase requiere rebuild/deploy para impactar `/menu/corpo/` y `/menu/teleinde/`. El alcance es intermedio: administra contenido del menu QR, no paginas institucionales ni CMS editorial amplio.

## Modelo activo

El modelo activo de `menu_content` es plano y orientado al dominio real:

- Perfiles y facts se leen en build-time. Pagos se modela como el fact `pagos`.
- `menu_daily_items` contiene las dos opciones reales del menu del dia: comun y vegetariano.
- `menu_profile_service_settings.service_kind` define por local `daily-menu` o `grill`.
- `menu_catalog_sections`, `menu_catalog_items` y `menu_catalog_item_options` contienen el catalogo estable plano.
- `menu_grill_families` contiene los items visibles de parrilla y `menu_grill_catalog_items` contiene sus variantes con precio.
- `menu_prices` y `menu_price_variants` contienen precios globales build-time.

Las tablas y columnas legacy del modelo anterior no existen en la baseline activa. Su historial incremental permanece preservado en el tag `supabase-prelaunch-history-2026-06-06`. El tag historico `yaml-rollback-2026-05-02` existe solo como rollback al estado file-backed anterior; YAML no es fuente activa.

## Frontera build-time/runtime

Editables build-time con rebuild requerido:

- menu del dia base: nombre y descripcion
- servicio activo por local: `daily-menu` o `grill`
- precios globales en `menu_prices` y `menu_price_variants`
- catalogo, secciones, imagenes y textos estructurales

`menu_catalog_item_images` es la unica fuente de paths de imagen y aplica solo
al catalogo fijo. El orden cero identifica la imagen principal. Menu diario y
parrilla no soportan imagenes.

Los facts de perfil pueden incluir links de contacto, por ejemplo WhatsApp,
solo para consultas informativas. Esos links no representan pedidos por
WhatsApp ni habilitan flujos de compra, carrito, checkout o reservas.

Editable runtime sin rebuild:

- disponibilidad por local usando exclusivamente `public.menu_availability_overlays`

Las columnas build-time `available` se conservan solo por compatibilidad interna y deben permanecer en `true`. La ausencia de overlay significa disponible; `No disponible` se expresa con una fila runtime en `public.menu_availability_overlays`.

Los items con opciones exponen el target padre y tambien cada opcion. Cada opcion de catalogo se expone al overlay con un ID compuesto `item-id-option-id`, por ejemplo `tortilla-con-cebolla`, sin agregar columnas al schema runtime.

No implementar consultas runtime para menu del dia, precios, servicio activo, catalogo, secciones, imagenes ni textos estructurales.

## Permisos y admin

- `staff_users.role = 'operator'`: puede editar todo lo que permite `/admin/`, para todos los perfiles, incluyendo publicar cambios.
- `staff_users.role = 'admin'`: hereda permisos operativos y puede gestionar staff a nivel de base/RPC.
- `staff_users.default_availability_profile_id`: preferencia opcional para el local seleccionado por defecto en el filtro de disponibilidad de `/admin/`; no restringe permisos.
- El sitio actual no tiene pantalla de gestion de empleados.
- `editor_profiles` fue eliminada luego del backfill inicial; no debe recrearse ni usarse para permisos.
- El primer `admin` debe crearse exclusivamente por SQL privilegiado; `service_role` no tiene acceso directo a `public.staff_users` y el bootstrap no se realiza desde browser RLS.
- `/admin/` lee estado operativo mediante `get_admin_operational_state()` y escribe solo mediante RPCs operativas.
- `/admin/` es un CMS operativo de contenido de menu: puede cubrir disponibilidad, servicio activo, menu del dia, productos de parrilla y sus opciones, contenido de menu fijo, opciones de subcategorias, precios y publicacion, sin abrir escritura editorial general.
- `/admin/` permite recuperar y cambiar contrasena con Supabase Auth; el redirect de recuperacion debe volver a `/admin/`.
- La edicion de parrilla trata `menu_grill_families` como productos visibles y `menu_grill_catalog_items` como opciones: puede agregar un producto con su primera opcion, renombrar o eliminar productos completos, y agregar, editar o eliminar opciones manteniendo al menos una opcion por producto. No administra orden, IDs tecnicos, disponibilidad ni imagenes. La edicion de menu fijo puede agregar items, editar nombre/descripcion y eliminar items dentro de secciones existentes, y agregar, editar nombre y eliminar opciones de items que ya usan sabores, sin dejar una lista vacia; no edita disponibilidad, IDs tecnicos, orden, secciones ni reordenamiento de opciones. Cada item fijo conserva su propio `pricing_key`. Los IDs nuevos se generan en RPCs server-side, no desde nombres visibles en el browser. Las altas y los renombrados rechazan nombres visibles duplicados dentro del mismo contexto operativo con mensajes controlados. Los precios se editan desde RPCs globales de precios presentados en la pantalla del menu correspondiente.
- No hay grants client-facing sobre `menu_content` ni tablas de `app_private`.

Redirects requeridos en Supabase Auth:

- `https://elfaraoncatering.vercel.app/admin/`
- `http://localhost:4321/admin/` para pruebas locales

### Pruebas Auth remotas y deliverability

Las auditorias SQL read-only, como `npm run supabase:audit`, usan `SUPABASE_DB_URL`, no crean usuarios Auth y no envian emails. El riesgo de rebotes viene de pruebas browser/Auth contra el proyecto remoto cuando se disparan flujos de Supabase Auth que mandan email real.

Para auditorias con Codex, agent-browser u otra automatizacion, usar primero un usuario staff real existente cuando solo se necesite iniciar sesion y recorrer `/admin/`. No crear usuarios Auth temporales en remoto con emails ficticios, no controlados o adivinados. Evitar `signup`, invitaciones, recovery, magic links y OTP contra remoto si la direccion puede rebotar.

Si es indispensable probar un flujo remoto que envia email, usar una casilla real controlada con plus addressing, por ejemplo `cuenta-real+elfaraon-testing@gmail.com`, sin versionar direcciones personales. Al finalizar, eliminar o revocar cualquier usuario temporal creado; esto limpia el acceso, pero no anula emails ya enviados ni previene rebotes previos.

Las RPCs operativas devuelven `ok`, `changed`, `requires_redeploy`, `operation` y `message`. La publicacion puede devolver `cooldown_seconds_remaining`.

Las funciones publicas del admin deben quedar como wrappers `security invoker`. Los cuerpos `security definer` que necesitan leer o escribir datos protegidos viven en `app_private`, fuera de los schemas expuestos por PostgREST.

Excepcion actual: `public.reserve_menu_publish_request(...)` y `public.complete_menu_publish_request(...)` son helpers `security definer` para la Edge Function `publish-menu-changes`, revocados para `anon` y `authenticated`, y ejecutables solo por `service_role`. No son RPCs del browser ni del admin; moverlos a `app_private` queda reservado para un refactor explicito.

La baseline crea `staff_users` y sus helpers de permisos antes de las RPCs operativas que dependen de ellos. `can_edit_menu_content()` forma parte de la superficie RPC operativa y debe conservar su wrapper y contrato de privilegios actuales.

`publish-menu-changes` usa `can_publish_menu()` para autorizar publicacion, reserva/completa solicitudes mediante helpers service-role-only, registra auditoria y fingerprint de contenido en `app_private`, y llama el Vercel Deploy Hook desde secretos de Supabase Functions. Las RPCs build-time del admin registran eventos privados de cambio; al completarse una publicacion exitosa, esos eventos quedan asociados al request de publicacion. La disponibilidad runtime no participa de ese log de deploy. No usa `pg_net`.

`get_admin_operational_state()` expone el fingerprint actual del contenido build-time. Durante el build, `/admin/` embebe el fingerprint del contenido desplegado y el cliente compara ambos para decidir si hay publicacion pendiente. El banner no debe depender de un flag local de edicion en la sesion ni del ultimo publish registrado desde admin.

La alerta `auth_leaked_password_protection` no se resuelve con SQL del repo: se habilita en la configuracion de Supabase Auth del proyecto, si el plan lo soporta.

## Archivos en esta carpeta

Auditorias read-only:

- `audits/menu-schema-audit.sql`: revisa tablas, constraints, indices y diagnosticos del modelo activo.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion, policies, helpers y hallazgos.

Documentacion:

- `schema-diagram.md`: mapa Mermaid de `menu_content`, overlay runtime, admin operativo y publicacion.

Los archivos de esta carpeta sirven para revisar y auditar. No reemplazan la historia canonica de `../../supabase/migrations/`.

## Baseline canonico

La migracion activa para bases nuevas es:

| Migracion | Proposito |
| --- | --- |
| `20260606235844_prelaunch_baseline.sql` | Crea schemas, tablas, contenido build-time, funciones, RPCs, fingerprint, RLS, policies, grants, hardening y assertions del estado prelanzamiento. |
| `20260630203051_staff_default_availability_profile.sql` | Agrega el perfil predeterminado de disponibilidad para staff. |
| `20260630204047_fix_staff_default_availability_null.sql` | Ajusta la nulabilidad del perfil predeterminado de disponibilidad. |
| `20260701001506_publish_change_events.sql` | Registra eventos privados de cambios build-time del admin y los asocia a publicaciones exitosas. |

La historia incremental anterior fue retirada del directorio activo y esta
preservada por el tag anotado `supabase-prelaunch-history-2026-06-06`. No
mantener una copia legacy dentro del arbol de trabajo.

El baseline incluye el contenido actual de `menu_content` preservando IDs y
sincronizando las secuencias identity. Crea vacias estas superficies operativas:

- `public.staff_users`
- `public.menu_availability_overlays`
- `app_private.menu_publish_requests`
- `app_private.menu_change_events`

No incluye `auth.users`, secretos de Functions ni configuracion remota de Auth.
El primer admin debe crearse primero en Supabase Auth y luego insertarse en
`public.staff_users` exclusivamente mediante SQL privilegiado. `service_role`
no tiene acceso directo a esa tabla.

No ejecutar el baseline sobre una base existente. Para un remoto que ya tiene
el estado equivalente, primero validar esquema, contenido, funciones, permisos,
policies y fingerprint; despues reparar solo la tabla de historial de
migraciones. Toda modificacion futura debe ser una migracion incremental nueva
posterior al baseline.

## Orden recomendado

Para una base existente:

1. Ejecutar primero los SQL de `audits/` contra la base apuntada por `SUPABASE_DB_URL`.
2. Resolver cualquier fila que bloquee constraints, indices o permisos esperados.
3. Crear una migracion incremental posterior al baseline.
4. Aplicar solo migraciones posteriores pendientes; nunca ejecutar el baseline sobre esa base.
5. Volver a ejecutar audits.
6. Ejecutar validaciones del repo.
7. Aplicar cambios remotos solo si audits y validaciones pasan.

Para una base nueva:

1. Aplicar `../../supabase/migrations/` mediante Supabase CLI.
2. Confirmar que el baseline y cualquier migracion posterior terminan sin errores.
3. Ejecutar `audits/menu-schema-audit.sql`, `audits/database-audit.sql` y `npm run menu:validate`.
4. Crear el primer usuario en Supabase Auth y bootstrappear su fila `admin` mediante SQL privilegiado.
5. Configurar secretos y desplegar `publish-menu-changes`.

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
- `SUPABASE_ACCESS_TOKEN`: token local opcional para comandos de Supabase Management API, como `secrets list`; no pertenece al runtime del sitio ni de Functions.

En este proyecto remoto, `npm run supabase -- secrets list` confirma esos nombres para el runtime de Functions. Ese comando requiere `SUPABASE_ACCESS_TOKEN` o una sesion previa con `supabase login`. No exponer `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK_URL` ni `SUPABASE_ACCESS_TOKEN` como `PUBLIC_*`.

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

1. Versionar migraciones aplicables en `../../supabase/migrations/`; conservar en esta carpeta documentacion y auditorias read-only.
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
- Usar `staff_users` y funciones helper para permisos del CMS operativo de menu; no recrear `editor_profiles`.
- Usar RPCs operativas para escrituras desde el browser; no otorgar grants directos sobre `menu_content`.
- Usar `get_admin_operational_state()` para lectura del admin; no consultar `menu_content` ni `app_private` desde el browser.
- Usar `publish-menu-changes` para publicacion; no exponer el Vercel Deploy Hook, no usar `pg_net`, no exponer `app_private` por PostgREST y no otorgar grants sobre sus tablas.
- Ejecutar `npm run supabase:audit` antes de deploy o cambios de permisos; el audit falla si `app_private` o `menu_content` quedan expuestos por PostgREST/Data API.
- No agregar SSR, Vercel Functions, CMS editorial amplio, auth editorial ni queries estructurales desde el navegador por cambios en esta carpeta. Las ampliaciones del CMS deben permanecer dentro del contenido operativo de menu y seguir pasando por RPCs.

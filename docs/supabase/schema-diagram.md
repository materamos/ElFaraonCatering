# Supabase database map

Este mapa documenta el modelo activo del menu QR. Supabase se usa como fuente estructural y operativa build-time; la unica superficie runtime sin rebuild es el overlay de disponibilidad.

Las columnas `available` dentro de `menu_content` son compatibilidad interna y deben permanecer en `true`. La disponibilidad operativa real se modela solo como excepcion runtime en `public.menu_availability_overlays`.

Fuentes versionadas:

- `schema.sql`: snapshot limpio esperado del schema privado `menu_content`.
- `../../supabase/migrations/`: historia canonica de migraciones operativas aplicables.
- `availability-overlay.sql`: referencia del overlay runtime, `staff_users` y helpers base.
- `operational-edit-rpcs.sql`: referencia de RPCs de escritura operativa.
- `hardening.sql`: referencia de constraints e indices idempotentes.
- `audits/menu-schema-audit.sql`: auditoria read-only del modelo activo.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion y hallazgos.

Ver `README.md` en esta carpeta para el orden completo de migraciones.

## Mapa de schemas

```mermaid
flowchart TD
  DB[(Supabase Postgres)]

  DB --> MC["menu_content<br/>estructura y operacion build-time"]
  DB --> PUB["public<br/>overlay runtime, staff y RPCs"]
  DB --> PRIV["app_private<br/>auditoria privada e implementaciones definer"]
  DB --> AUTH["auth<br/>Supabase-managed"]

  MC --> BUILD["Astro build<br/>SUPABASE_DB_URL"]
  BUILD --> STATIC["HTML/JS estatico<br/>/menu/corpo y /menu/teleinde"]
  PUB --> MENU_CLIENT["Cliente menu<br/>solo disponibilidad"]
  PUB --> ADMIN_CLIENT["/admin/ estatico<br/>RPCs operativas"]
  AUTH -. "staff autenticado" .-> PUB
  PUB -. "publish-menu-changes" .-> PRIV

  classDef structural fill:#eef6ff,stroke:#1f4f82,color:#102a43;
  classDef runtime fill:#f3f8ee,stroke:#446b2f,color:#223815;
  classDef private fill:#fff4e5,stroke:#8a5a13,color:#3f2c09;
  classDef platform fill:#f6f6f6,stroke:#777,color:#333;

  class MC,BUILD,STATIC structural;
  class PUB,MENU_CLIENT,ADMIN_CLIENT runtime;
  class PRIV private;
  class AUTH platform;
```

## ERD resumido: `menu_content`

El ERD muestra las tablas y columnas de dominio mas relevantes. `schema.sql` sigue siendo la referencia exacta de constraints, defaults y checks.

```mermaid
erDiagram
  MENU_PROFILES {
    text id PK
    text eyebrow
    text title
    text description
    text info_title
  }

  MENU_PROFILE_FACTS {
    text profile_id PK,FK
    text fact_id PK
    text label
    text value
    text link_text
    text link_href
    int order_index
  }

  MENU_PRICES {
    text pricing_key PK
    text kind
    int amount
  }

  MENU_PRICE_VARIANTS {
    text pricing_key PK,FK
    text variant_id PK
    text name
    int amount
    bool available
    int order_index
  }

  MENU_DAILY_ITEMS {
    bigint id PK
    text item_id
    text name
    text description
    text note
    bool available
    text pricing_key FK
    int order_index
  }

  MENU_PROFILE_SERVICE_SETTINGS {
    text profile_id PK,FK
    text service_kind
  }

  MENU_CATALOG_SECTIONS {
    bigint id PK
    text section_id
    text title
    text description
    text note
    text content_kind
    text presentation
    int order_index
  }

  MENU_CATALOG_GROUPS {
    bigint id PK
    text section_id FK
    text group_id
    text title
    text description
    text note
    text pricing_key FK
    int order_index
  }

  MENU_CATALOG_ITEMS {
    bigint id PK
    text section_id FK
    text group_id
    text item_id
    text name
    text description
    text note
    text image_path
    bool available
    text pricing_key FK
    int order_index
  }

  MENU_CATALOG_ITEM_OPTIONS {
    bigint catalog_item_id PK,FK
    text option_id PK
    text name
    text description
    text note
    bool available
    int order_index
  }

  MENU_GRILL_FAMILIES {
    text family_id PK
    text title
    int order_index
  }

  MENU_GRILL_CATALOG_ITEMS {
    bigint id PK
    text family_id FK
    text item_id
    text name
    text variant_name
    text description
    text note
    text image_path
    bool available
    text pricing_key FK
    int order_index
  }

  MENU_PROFILES ||--o{ MENU_PROFILE_FACTS : physical
  MENU_PROFILES ||--|| MENU_PROFILE_SERVICE_SETTINGS : physical

  MENU_PRICES ||--o{ MENU_PRICE_VARIANTS : physical
  MENU_PRICES ||--o{ MENU_DAILY_ITEMS : physical
  MENU_PRICES ||--o{ MENU_CATALOG_GROUPS : physical
  MENU_PRICES ||--o{ MENU_CATALOG_ITEMS : physical
  MENU_PRICES ||--o{ MENU_GRILL_CATALOG_ITEMS : physical

  MENU_CATALOG_SECTIONS ||--o{ MENU_CATALOG_GROUPS : physical
  MENU_CATALOG_SECTIONS ||--o{ MENU_CATALOG_ITEMS : physical
  MENU_CATALOG_ITEMS ||--o{ MENU_CATALOG_ITEM_OPTIONS : physical

  MENU_GRILL_FAMILIES ||--o{ MENU_GRILL_CATALOG_ITEMS : physical
```

## Runtime operativo

```mermaid
flowchart LR
  AUTH_USERS["auth.users<br/>Supabase-managed"]
  STAFF["public.staff_users<br/>roles y alcance"]
  EDITORS["public.editor_profiles<br/>legacy backfill"]
  OVERLAYS["public.menu_availability_overlays<br/>disponibilidad runtime"]
  READ_RPC["get_admin_operational_state()<br/>lectura admin"]
  WRITE_RPCS["RPCs operativas<br/>edicion controlada"]
  EDGE["Supabase Edge Function<br/>publish-menu-changes"]
  PRIVATE["app_private<br/>auditoria privada e implementaciones definer"]
  VERCEL["Vercel Deploy Hook<br/>secreto en Functions"]
  ADMIN_UI["/admin/ estatico<br/>cliente TypeScript"]
  STATIC["HTML estatico<br/>data-menu-id / data-section-id / data-item-id"]

  AUTH_USERS -->|"FK fisica: user_id"| STAFF
  AUTH_USERS -->|"FK fisica: user_id"| EDITORS
  AUTH_USERS -->|"FK fisica: updated_by"| OVERLAYS
  EDITORS -. "backfill legacy" .-> STAFF
  STAFF -. "RLS helper: can_edit_availability" .-> OVERLAYS
  STAFF -. "helpers de permisos" .-> READ_RPC
  STAFF -. "helpers de permisos" .-> WRITE_RPCS
  STAFF -. "can_publish_menu" .-> EDGE
  ADMIN_UI -->|"leer estado"| READ_RPC
  ADMIN_UI -->|"acciones del admin"| WRITE_RPCS
  READ_RPC -->|"estado operativo filtrado"| ADMIN_UI
  WRITE_RPCS -->|"writes controlados"| OVERLAYS
  WRITE_RPCS -->|"writes build-time"| MENU_CONTENT["menu_content"]
  EDGE -->|"reserve/complete"| PRIVATE
  EDGE -->|"POST server-side"| VERCEL
  OVERLAYS -. "IDs logicos" .-> STATIC

  classDef runtime fill:#f3f8ee,stroke:#446b2f,color:#223815;
  classDef structural fill:#eef6ff,stroke:#1f4f82,color:#102a43;
  classDef private fill:#fff4e5,stroke:#8a5a13,color:#3f2c09;
  classDef platform fill:#f6f6f6,stroke:#777,color:#333;

  class STAFF,EDITORS,OVERLAYS,READ_RPC,WRITE_RPCS,EDGE,ADMIN_UI runtime;
  class STATIC,MENU_CONTENT structural;
  class PRIVATE private;
  class AUTH_USERS,VERCEL platform;
```

## Frontera build-time/runtime

- `menu_content` se lee para el menu publico solo durante build/validacion con `SUPABASE_DB_URL`.
- Menu del dia, notas, servicio activo por local, catalogo, secciones, grupos, imagenes y precios son datos build-time.
- Las columnas build-time `available` no representan faltantes operativos; se conservan siempre `true` por compatibilidad.
- `menu_daily_items` modela dos opciones planas: comun y vegetariano.
- `/admin/` puede editar datos operativos build-time, pero esos cambios requieren rebuild/deploy para impactar el menu publico.
- La edicion de menu fijo desde `/admin/` esta limitada a altas y bajas de items puntuales dentro de secciones o grupos existentes.
- `public.menu_availability_overlays` es el unico dato editable en runtime sin rebuild.
- La ausencia de overlay equivale a disponible; marcar disponible en admin debe limpiar el overlay.
- Los items con opciones exponen target padre y targets de opcion; las opciones usan IDs compuestos `item-id-option-id` como `item_id` del overlay.
- `public.staff_users` define roles operativos (`availability_editor`, `menu_editor`, `admin`) y alcance por perfil.
- Las escrituras del admin deben pasar por RPCs operativas con respuesta `ok`, `changed`, `requires_redeploy`, `operation` y `message`.
- Las RPCs publicas del admin son wrappers `security invoker`; las implementaciones privilegiadas viven en `app_private`, que no debe exponerse por PostgREST.
- `publish-menu-changes` es la frontera server-side para publicar cambios build-time: valida Auth, usa `can_publish_menu()`, registra auditoria privada y llama el Deploy Hook desde secretos.
- `public.editor_profiles` es legacy temporal y no debe respaldar nuevas policies.
- El cliente no debe consultar estructura, precios, menu del dia, servicio activo, catalogo, grupos, secciones, imagenes ni textos estructurales.

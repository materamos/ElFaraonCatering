# Supabase database map

Este mapa documenta el modelo activo del menu QR. Supabase se usa como fuente
estructural y operativa build-time; la unica superficie runtime sin rebuild es el
overlay de disponibilidad.

Fuentes versionadas:

- `schema.sql`: estado limpio esperado del schema privado `menu_content`.
- `migrations/2026-05-07-flatten-menu-content-model.sql`: primera migracion remota al modelo plano.
- `migrations/2026-05-07-drop-legacy-menu-content-model.sql`: limpieza de tablas legacy despues de validar deploy.
- `availability-overlay.sql`: unica superficie runtime en `public`.
- `audits/menu-schema-audit.sql`: auditoria read-only del modelo activo.
- `audits/database-audit.sql`: inventario amplio de objetos, exposicion y hallazgos.

## Mapa de schemas

```mermaid
flowchart TD
  DB[(Supabase Postgres)]

  DB --> MC["menu_content<br/>estructura y operacion build-time"]
  DB --> PUB["public<br/>overlay runtime limitado"]
  DB --> AUTH["auth<br/>Supabase-managed"]

  MC --> BUILD["Astro build<br/>SUPABASE_DB_URL"]
  BUILD --> STATIC["HTML/JS estatico<br/>/menu/corpo y /menu/teleinde"]
  PUB --> CLIENT["Cliente runtime<br/>solo disponibilidad"]
  AUTH -. "editores autorizados" .-> PUB

  classDef project fill:#eef6ff,stroke:#1f4f82,color:#102a43;
  classDef runtime fill:#f3f8ee,stroke:#446b2f,color:#223815;
  classDef platform fill:#f6f6f6,stroke:#777,color:#333;

  class MC,BUILD,STATIC project;
  class PUB,CLIENT runtime;
  class AUTH platform;
```

## ERD activo: `menu_content`

```mermaid
erDiagram
  MENU_PROFILES {
    text id PK
    text title
    text info_title
  }

  MENU_PROFILE_FACTS {
    text profile_id PK,FK
    text fact_id PK
    int order_index
  }

  MENU_PROFILE_PAYMENTS {
    text profile_id PK,FK
    text payment_id
  }

  MENU_PROFILE_PAYMENT_METHODS {
    text profile_id PK,FK
    text method
    int order_index PK
  }

  MENU_PRICES {
    text pricing_key PK
    text kind
    int amount
  }

  MENU_PRICE_VARIANTS {
    text pricing_key PK,FK
    text variant_id PK
    int amount
    bool available
  }

  MENU_DAILY_ITEMS {
    bigint id PK
    text item_id
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
    text content_kind
    int order_index
  }

  MENU_CATALOG_GROUPS {
    bigint id PK
    text section_id FK
    text group_id
    text pricing_key FK
    int order_index
  }

  MENU_CATALOG_ITEMS {
    bigint id PK
    text section_id FK
    text group_id
    text item_id
    text pricing_key FK
    int order_index
  }

  MENU_CATALOG_ITEM_OPTIONS {
    bigint catalog_item_id PK,FK
    text option_id PK
    bool available
    int order_index
  }

  MENU_GRILL_FAMILIES {
    text family_id PK
    int order_index
  }

  MENU_GRILL_CATALOG_ITEMS {
    bigint id PK
    text family_id FK
    text item_id
    text pricing_key FK
    int order_index
  }

  MENU_PROFILES ||--o{ MENU_PROFILE_FACTS : physical
  MENU_PROFILES ||--|| MENU_PROFILE_PAYMENTS : physical
  MENU_PROFILE_PAYMENTS ||--o{ MENU_PROFILE_PAYMENT_METHODS : physical
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

## Overlay runtime: `public`

```mermaid
flowchart LR
  AUTH_USERS["auth.users<br/>Supabase-managed"]
  EDITORS["public.editor_profiles<br/>editores activos"]
  OVERLAYS["public.menu_availability_overlays<br/>disponibilidad runtime"]

  STATIC["HTML estatico<br/>data-menu-id / data-section-id / data-item-id"]

  AUTH_USERS -->|"FK fisica: user_id"| EDITORS
  AUTH_USERS -->|"FK fisica: updated_by"| OVERLAYS
  OVERLAYS -. "IDs logicos" .-> STATIC

  classDef runtime fill:#f3f8ee,stroke:#446b2f,color:#223815;
  classDef structural fill:#eef6ff,stroke:#1f4f82,color:#102a43;
  classDef platform fill:#f6f6f6,stroke:#777,color:#333;

  class EDITORS,OVERLAYS runtime;
  class STATIC structural;
  class AUTH_USERS platform;
```

## Frontera build-time/runtime

- `menu_content` se lee solo durante build/validacion con `SUPABASE_DB_URL`.
- Menu del dia, notas, servicio activo por local, catalogo, secciones, grupos, imagenes y precios son datos build-time.
- Un CMS futuro puede editar esos datos, pero el cambio requiere rebuild/deploy para impactar el menu publico.
- `public.menu_availability_overlays` es el unico dato editable en runtime sin rebuild.
- El cliente no debe consultar estructura, precios, menu del dia, servicio activo, catalogo, grupos, secciones, imagenes ni textos estructurales.

## Legacy

El modelo anterior se conservo durante la primera migracion remota para validar
deploy. La limpieza fisica vive en `2026-05-07-drop-legacy-menu-content-model.sql`
y no forma parte del modelo activo.

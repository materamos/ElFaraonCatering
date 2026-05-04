# Supabase schema diagram

El diagrama separa la fuente estructural build-time (`menu_content`) del overlay runtime
en `public`. Las relaciones de overrides apuntan a IDs tecnicos estables y se validan
por audits/scripts; no todas son foreign keys fisicas.

```mermaid
erDiagram
  AUTH_USERS {
    uuid id PK
  }

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

  MENU_PROFILE_PAYMENTS {
    text profile_id PK,FK
    text payment_id
    text label
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
    text currency
  }

  MENU_PRICE_VARIANTS {
    text pricing_key PK,FK
    text price_kind
    text variant_id PK
    text name
    int amount
    bool available
    int order_index
  }

  MENU_DAILY_MENU {
    text id PK
    text name
    text description
    text note
    bool available
    text pricing_key FK
  }

  MENU_DAILY_SERVICE_SETTINGS {
    text profile_id PK,FK
    bool grill_enabled
  }

  MENU_SECTIONS {
    bigint id PK
    text section_key
    text section_scope
    text menu_id FK
    text section_id
    text title
    text content_kind
    int order_index
  }

  MENU_GROUPS {
    bigint id PK
    text group_key
    bigint section_row_id FK
    text group_id
    text title
    text pricing_key FK
    int order_index
  }

  MENU_ITEMS {
    bigint id PK
    text item_key
    text item_id
    text name
    text description
    text image_path
  }

  MENU_GRILL_ITEMS {
    bigint id PK
    text grill_item_key
    bigint item_row_id FK
    text item_id FK
    int order_index
    bool available
    text pricing_key FK
  }

  MENU_SECTION_ITEMS {
    bigint id PK
    text section_item_key
    bigint section_row_id FK
    bigint item_row_id FK
    text item_id FK
    int order_index
    bool available
    text pricing_key FK
  }

  MENU_GROUP_ITEMS {
    bigint id PK
    text group_item_key
    bigint group_row_id FK
    bigint item_row_id FK
    text item_id FK
    int order_index
    bool available
    text pricing_key FK
  }

  MENU_ITEM_OPTIONS {
    bigint item_row_id PK,FK
    text option_id PK
    text name
    text description
    text note
    bool available
    int order_index
  }

  MENU_OVERRIDES {
    bigint id PK
    text override_key
    text menu_id FK
  }

  MENU_OVERRIDE_SECTIONS {
    bigint id PK
    text override_section_key
    bigint override_row_id FK
    text section_id
    int order_index
  }

  MENU_OVERRIDE_GROUPS {
    bigint id PK
    text override_group_key
    bigint override_section_row_id FK
    text group_id
    text pricing_key FK
    text note
    int order_index
  }

  MENU_OVERRIDE_SECTION_ITEMS {
    bigint id PK
    text override_section_item_key
    bigint override_section_row_id FK
    text item_id
    bool available
    text pricing_key FK
    text note
    int order_index
  }

  MENU_OVERRIDE_GROUP_ITEMS {
    bigint id PK
    text override_group_item_key
    bigint override_group_row_id FK
    text item_id
    bool available
    text pricing_key FK
    text note
    int order_index
  }

  EDITOR_PROFILES {
    uuid user_id PK,FK
    bool active
    text display_name
  }

  MENU_AVAILABILITY_OVERLAYS {
    uuid id PK
    text menu_id
    text section_id
    text group_id
    text item_id
    bool available_override
    timestamptz updated_at
    uuid updated_by FK
  }

  MENU_PROFILES ||--o{ MENU_PROFILE_FACTS : has
  MENU_PROFILES ||--|| MENU_PROFILE_PAYMENTS : has
  MENU_PROFILE_PAYMENTS ||--o{ MENU_PROFILE_PAYMENT_METHODS : has
  MENU_PROFILES ||--o{ MENU_DAILY_SERVICE_SETTINGS : configures
  MENU_PROFILES ||--o{ MENU_SECTIONS : owns_daily
  MENU_PROFILES ||--o{ MENU_OVERRIDES : customizes

  MENU_PRICES ||--o{ MENU_PRICE_VARIANTS : has
  MENU_PRICES ||--o{ MENU_DAILY_MENU : prices
  MENU_PRICES ||--o{ MENU_GROUPS : prices
  MENU_PRICES ||--o{ MENU_SECTION_ITEMS : prices
  MENU_PRICES ||--o{ MENU_GROUP_ITEMS : prices
  MENU_PRICES ||--o{ MENU_GRILL_ITEMS : prices
  MENU_PRICES ||--o{ MENU_OVERRIDE_GROUPS : overrides
  MENU_PRICES ||--o{ MENU_OVERRIDE_SECTION_ITEMS : overrides
  MENU_PRICES ||--o{ MENU_OVERRIDE_GROUP_ITEMS : overrides

  MENU_SECTIONS ||--o{ MENU_GROUPS : has
  MENU_SECTIONS ||--o{ MENU_SECTION_ITEMS : has
  MENU_GROUPS ||--o{ MENU_GROUP_ITEMS : has
  MENU_ITEMS ||--o{ MENU_SECTION_ITEMS : appears_as
  MENU_ITEMS ||--o{ MENU_GROUP_ITEMS : appears_as
  MENU_ITEMS ||--o{ MENU_GRILL_ITEMS : appears_as
  MENU_ITEMS ||--o{ MENU_ITEM_OPTIONS : has

  MENU_OVERRIDES ||--o{ MENU_OVERRIDE_SECTIONS : has
  MENU_OVERRIDE_SECTIONS ||--o{ MENU_OVERRIDE_GROUPS : has
  MENU_OVERRIDE_SECTIONS ||--o{ MENU_OVERRIDE_SECTION_ITEMS : has
  MENU_OVERRIDE_GROUPS ||--o{ MENU_OVERRIDE_GROUP_ITEMS : has

  AUTH_USERS ||--o{ EDITOR_PROFILES : identifies
  AUTH_USERS ||--o{ MENU_AVAILABILITY_OVERLAYS : updates
```

## Notas

- `menu_sections.section_scope = 'catalog'` usa `menu_id = null`; `section_scope = 'daily'` usa un `menu_id` de `menu_profiles`.
- `menu_daily_menu` es singleton: solo permite el id `current`.
- `menu_grill_items` representa la lista fija de parrilla usada cuando `grill_enabled` esta activo para un perfil.
- Los overrides solo pueden ajustar disponibilidad, precio y nota sobre estructura existente.
- `menu_availability_overlays` no cambia estructura, textos, precios ni imagenes; solo disponibilidad visual runtime.

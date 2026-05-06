# Supabase database map

Este es el mapa versionado para entender la base Supabase del menu QR. Resume las
superficies reales del proyecto sin expandir tablas internas de Supabase.

Fuentes versionadas:

- `schema.sql`: estructura privada `menu_content`.
- `availability-overlay.sql`: superficie runtime en `public`.
- `audits/database-audit.sql`: inventario, exposicion, objetos inesperados y hallazgos.

## Como leer este mapa

1. Empezar por el mapa de schemas para separar proyecto de infraestructura.
2. Leer el ERD estructural de `menu_content`; esa es la fuente build-time del menu.
3. Leer el overlay runtime en `public`; solo cambia disponibilidad visual.
4. Usar la leyenda de auditoria para interpretar hallazgos, no para borrar datos.

Convenciones:

- Relacion fisica: foreign key declarada en SQL.
- Relacion logica: referencia por IDs tecnicos, validada por audits/scripts.
- Las tablas internas de Supabase se muestran como infraestructura y no se expanden.

## Mapa de schemas

```mermaid
flowchart TD
  DB[(Supabase Postgres)]

  DB --> MC["menu_content<br/>fuente estructural build-time"]
  DB --> PUB["public<br/>superficie operativa/runtime"]
  DB --> AUTH["auth<br/>Supabase-managed"]
  DB --> STORAGE["storage<br/>Supabase-managed"]
  DB --> REALTIME["realtime<br/>Supabase-managed"]
  DB --> VAULT["vault<br/>Supabase-managed"]
  DB --> EXT["extensions / graphql / pgbouncer<br/>Supabase-managed"]

  MC --> BUILD["Astro build<br/>MenuPage / MenuSection / DishCard"]
  PUB --> CLIENT["Cliente runtime<br/>availability overlay"]

  AUTH -. "referencias de editor" .-> PUB
  MC -. "targets logicos" .-> PUB

  classDef project fill:#eef6ff,stroke:#1f4f82,color:#102a43;
  classDef runtime fill:#f3f8ee,stroke:#446b2f,color:#223815;
  classDef platform fill:#f6f6f6,stroke:#777,color:#333;

  class MC,BUILD project;
  class PUB,CLIENT runtime;
  class AUTH,STORAGE,REALTIME,VAULT,EXT platform;
```

## ERD estructural: `menu_content`

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

  MENU_DAILY_MENU {
    text id PK
    text name
    bool available
    text pricing_key FK
  }

  MENU_DAILY_SERVICE_SETTINGS {
    text profile_id PK,FK
    bool grill_enabled
  }

  MENU_SECTIONS {
    bigint id PK
    text section_scope
    text menu_id FK
    text section_id
    text content_kind
    int order_index
  }

  MENU_GROUPS {
    bigint id PK
    bigint section_row_id FK
    text group_id
    text pricing_key FK
    int order_index
  }

  MENU_ITEMS {
    bigint id PK
    text item_id
    text name
    text image_path
  }

  MENU_GRILL_ITEMS {
    bigint id PK
    bigint item_row_id FK
    text item_id FK
    text pricing_key FK
    int order_index
  }

  MENU_SECTION_ITEMS {
    bigint id PK
    bigint section_row_id FK
    bigint item_row_id FK
    text item_id FK
    text pricing_key FK
    int order_index
  }

  MENU_GROUP_ITEMS {
    bigint id PK
    bigint group_row_id FK
    bigint item_row_id FK
    text item_id FK
    text pricing_key FK
    int order_index
  }

  MENU_ITEM_OPTIONS {
    bigint item_row_id PK,FK
    text option_id PK
    bool available
    int order_index
  }

  MENU_OVERRIDES {
    bigint id PK
    text menu_id FK
  }

  MENU_OVERRIDE_SECTIONS {
    bigint id PK
    bigint override_row_id FK
    text section_id
    int order_index
  }

  MENU_OVERRIDE_GROUPS {
    bigint id PK
    bigint override_section_row_id FK
    text group_id
  }

  MENU_OVERRIDE_SECTION_ITEMS {
    bigint id PK
    bigint override_section_row_id FK
    text item_id
  }

  MENU_OVERRIDE_GROUP_ITEMS {
    bigint id PK
    bigint override_group_row_id FK
    text item_id
  }

  MENU_PROFILES ||--o{ MENU_PROFILE_FACTS : physical
  MENU_PROFILES ||--|| MENU_PROFILE_PAYMENTS : physical
  MENU_PROFILE_PAYMENTS ||--o{ MENU_PROFILE_PAYMENT_METHODS : physical
  MENU_PROFILES ||--o{ MENU_DAILY_SERVICE_SETTINGS : physical
  MENU_PROFILES ||--o{ MENU_SECTIONS : physical_daily
  MENU_PROFILES ||--o{ MENU_OVERRIDES : physical

  MENU_PRICES ||--o{ MENU_PRICE_VARIANTS : physical
  MENU_PRICES ||--o{ MENU_DAILY_MENU : physical
  MENU_PRICES ||--o{ MENU_GROUPS : physical
  MENU_PRICES ||--o{ MENU_SECTION_ITEMS : physical
  MENU_PRICES ||--o{ MENU_GROUP_ITEMS : physical
  MENU_PRICES ||--o{ MENU_GRILL_ITEMS : physical
  MENU_SECTIONS ||--o{ MENU_GROUPS : physical
  MENU_SECTIONS ||--o{ MENU_SECTION_ITEMS : physical
  MENU_GROUPS ||--o{ MENU_GROUP_ITEMS : physical
  MENU_ITEMS ||--o{ MENU_SECTION_ITEMS : physical_pair
  MENU_ITEMS ||--o{ MENU_GROUP_ITEMS : physical_pair
  MENU_ITEMS ||--o{ MENU_GRILL_ITEMS : physical_pair
  MENU_ITEMS ||--o{ MENU_ITEM_OPTIONS : physical

  MENU_OVERRIDES ||--o{ MENU_OVERRIDE_SECTIONS : physical
  MENU_OVERRIDE_SECTIONS ||--o{ MENU_OVERRIDE_GROUPS : physical
  MENU_OVERRIDE_SECTIONS ||--o{ MENU_OVERRIDE_SECTION_ITEMS : physical
  MENU_OVERRIDE_GROUPS ||--o{ MENU_OVERRIDE_GROUP_ITEMS : physical
```

## Overlay runtime: `public`

```mermaid
flowchart LR
  AUTH_USERS["auth.users<br/>Supabase-managed"]
  EDITORS["public.editor_profiles<br/>editores activos"]
  OVERLAYS["public.menu_availability_overlays<br/>disponibilidad runtime"]

  PROFILES["menu_content.menu_profiles"]
  SECTIONS["menu_content.menu_sections"]
  SECTION_ITEMS["menu_content.menu_section_items"]
  GROUPS["menu_content.menu_groups"]
  GROUP_ITEMS["menu_content.menu_group_items"]

  AUTH_USERS -->|"FK fisica: user_id"| EDITORS
  AUTH_USERS -->|"FK fisica: updated_by"| OVERLAYS

  OVERLAYS -. "menu_id logico" .-> PROFILES
  OVERLAYS -. "section_id logico" .-> SECTIONS
  OVERLAYS -. "item_id logico sin group_id" .-> SECTION_ITEMS
  OVERLAYS -. "group_id + item_id logico" .-> GROUPS
  GROUPS -. "group item target" .-> GROUP_ITEMS

  classDef runtime fill:#f3f8ee,stroke:#446b2f,color:#223815;
  classDef structural fill:#eef6ff,stroke:#1f4f82,color:#102a43;
  classDef platform fill:#f6f6f6,stroke:#777,color:#333;

  class EDITORS,OVERLAYS runtime;
  class PROFILES,SECTIONS,SECTION_ITEMS,GROUPS,GROUP_ITEMS structural;
  class AUTH_USERS platform;
```

El overlay no administra estructura, textos, precios, imagenes ni menu diario. Si el
overlay falla, el menu estatico generado en build-time sigue disponible.

## Relaciones logicas auditadas

```mermaid
flowchart TD
  OVERRIDE_SECTIONS["menu_override_sections.section_id"]
  OVERRIDE_GROUPS["menu_override_groups.group_id"]
  OVERRIDE_SECTION_ITEMS["menu_override_section_items.item_id"]
  OVERRIDE_GROUP_ITEMS["menu_override_group_items.item_id"]
  AVAILABILITY["menu_availability_overlays"]

  CATALOG_SECTIONS["catalog menu_sections.section_id"]
  CATALOG_GROUPS["catalog menu_groups.group_id"]
  DIRECT_ITEMS["catalog menu_section_items.item_id"]
  GROUPED_ITEMS["catalog menu_group_items.item_id"]
  PROFILES["menu_profiles.id"]

  OVERRIDE_SECTIONS -. "audit target" .-> CATALOG_SECTIONS
  OVERRIDE_GROUPS -. "audit target" .-> CATALOG_GROUPS
  OVERRIDE_SECTION_ITEMS -. "audit target" .-> DIRECT_ITEMS
  OVERRIDE_GROUP_ITEMS -. "audit target" .-> GROUPED_ITEMS

  AVAILABILITY -. "menu_id" .-> PROFILES
  AVAILABILITY -. "section_id" .-> CATALOG_SECTIONS
  AVAILABILITY -. "group_id + item_id" .-> GROUPED_ITEMS
  AVAILABILITY -. "item_id sin group_id" .-> DIRECT_ITEMS
```

Estas relaciones son intencionalmente logicas: preservan IDs tecnicos estables sobre
estructura existente y se revisan con `audits/database-audit.sql` y `npm run menu:validate`.

## Leyenda de auditoria

| Status | Significado | Accion |
| --- | --- | --- |
| `keep` | Esperado o necesario para el modelo actual. | Mantener y validar con audits. |
| `review` | Puede ser valido, pero requiere lectura humana. | Revisar uso, contexto y runtime antes de decidir. |
| `risk` | Exposicion, permiso o inconsistencia a corregir. | Preparar correccion separada y aprobada. |
| `unknown` | No hay evidencia suficiente para clasificar. | Identificar propietario y uso. |
| `do_not_touch` | Infraestructura Supabase o alto riesgo de romper plataforma. | No editar ni borrar directamente. |

## Notas operativas

- `menu_sections.section_scope = 'catalog'` usa `menu_id = null`; `section_scope = 'daily'` usa un `menu_id` de `menu_profiles`.
- `menu_daily_menu` es singleton: solo permite el id `current`.
- `menu_grill_items` representa la lista fija de parrilla usada cuando `grill_enabled` esta activo para un perfil.
- Los overrides solo pueden ajustar disponibilidad y nota sobre estructura existente.
- Los precios son globales y no pueden cambiar por local/menu mediante overrides.
- Las imagenes se validan como paths permitidos bajo `/uploads/`; su existencia fisica requiere comparar contra el inventario del repo.
- Cualquier limpieza futura debe vivir en otro SQL separado, transaccional y no ejecutado sin aprobacion explicita.

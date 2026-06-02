# AGENTS.md

## Role

Act as a pragmatic and precise software engineering assistant for the El Faraon Catering digital menu system.

Keep changes correct, maintainable, minimal, and aligned with the existing Astro/Supabase/static-first architecture.

`README.md` is the human project manual. This file is the operational rulebook for agents making future changes.

---

## Current Project Baseline

The active product surface is the operational QR menu, not the future institutional website.

Current routes:

- `/` -> future institutional placeholder
- `/menu/` -> future operational menu index placeholder
- `/menu/corpo/` -> primary operational QR menu
- `/menu/teleinde/` -> active operational QR menu in the multi-location model
- `/admin/` -> static Astro operational menu-content CMS for employees

Current stack:

- Astro 5
- TypeScript
- Tailwind CSS 4
- Node 20 LTS
- npm
- Supabase Postgres for build-time structural and operational menu content
- Vercel static deployment

Current source of truth:

- Supabase `menu_content` is the structural and operational source read at build time.
- The runtime availability overlay is separate and progressive.
- `public.staff_users` is the staff permission source for the operational CMS.
- Operational CMS writes must go through explicit Supabase RPCs, not direct table grants.
- `/admin/` is the active operational menu-content CMS surface: broader than availability-only admin, but still limited to QR menu operations, menu content, prices, and publication.
- The historical rollback point to the previous file-backed content stage is the Git tag `yaml-rollback-2026-05-02`; YAML is not an active content source.

---

## Non-Negotiable Scope Rules

Do not add these capabilities unless explicitly requested:

- online ordering
- checkout or payments
- WhatsApp ordering
- reservations
- user accounts
- cart flows
- SSR
- server output
- serverless functions, except the explicitly approved Supabase Edge Function `publish-menu-changes`
- broad editorial CMS code, non-operational auth, or repo-writing admin flows outside operational menu content

Operational CMS work may cover menu del dia, active service, availability, grill
mode, grill products and their options, fixed-menu content, existing catalog
item options, global prices, and publication. This is an intermediate
menu-content CMS, not a general editorial CMS.

Operational staff auth and roles may support that CMS surface. Do not expand them
into customer accounts, broad editorial accounts, institutional-site accounts, or
public user features.

CMS editable does not mean runtime editable. Except for availability, operational
CMS changes require rebuild/deploy before they affect the public menu.

Grill admin edits treat `menu_grill_families` as visible grill products and
`menu_grill_catalog_items` as product options. They may add a product with its
first option, rename a product, delete a whole product, add product options,
update option labels, delete individual options while keeping at least one
option per product, and edit global fixed prices for options. Do not allow grill
edits to reorder products or options, change technical IDs after creation,
change availability, or manage images from `/admin/`.

Fixed-menu admin item edits may add individual catalog items, update item name and
description, delete individual catalog items only within existing sections or
groups, or add, update, and delete individual catalog item options for items
that already use options. The fixed-menu admin treats `minutas-tartas-omelettes`
as `Tartas, tortillas y omelettes`, shows `tartas`, `tortilla`, and `omelette`
there, and allows only option edits for items that already use options; it allows
only `empanadas` option edits in `empanadas`. In those option-only locations, do
not allow item add, update, or delete operations. Option edits from `/admin/`
must not leave an item with zero options. Do not allow fixed-menu item edits to
change prices, availability, technical IDs, order, to reorder options, or to
create, delete, rename, or reorder catalog sections or groups from `/admin/`.
For included side-option items in `guarniciones`, except `guarnicion-sola`,
`/admin/` must not expose price editing. New included side items/options must be
inserted before the current last option when that rule is available.
Global price edits may be presented in the admin surface for the related menu,
but must remain the explicit global price RPC workflow.

Keep `/admin/` as a static Astro route. Do not add SSR, server output, API routes, Vercel Functions, service role usage in browser, or broad editorial CMS behavior outside the operational menu-content scope.

Keep the project compatible with Node 20 and Astro 5 unless the runtime upgrade is explicitly requested.

Use npm only. Do not switch to pnpm, yarn, bun, or another runtime/package manager.

---

## Language and Naming Rules

- Code, file names, component names, variables, types, schemas, comments, and internal identifiers must be in English.
- User-facing content must be in Spanish unless multilingual support is explicitly requested.
- Use ASCII-only code-facing text.
- Do not use accents, the letter n with tilde, emojis, or unnecessary unicode in code, IDs, logs, config keys, file names, or machine-parsed strings.
- Keep technical IDs ASCII/kebab-case and stable. Do not derive IDs from visible names at runtime.

---

## Content Rules

Structural and operational menu content is read from Supabase `menu_content` at build time.

The reader must return the shape consumed by `MenuPage`, `MenuSection`, and `DishCard`.

Required content surfaces:

- profiles
- current daily menu
- active service settings by local
- fixed grill items
- catalog sections
- groups
- items
- options
- fixed, included, and variant prices
- local image paths

Daily service rules:

- `menu_daily_items` defines the two daily-menu options: regular menu and vegetarian menu.
- `menu_daily_items` must define name, availability, pricing, and may define description.
- `menu_profile_service_settings` must define one settings row per profile.
- `service_kind` is the per-profile property that selects `daily-menu` or `grill`.
- When `service_kind` is `daily-menu`, the profile shows the two daily-menu options.
- When `service_kind` is `grill`, the profile shows one visible item per `menu_grill_families` row, with `menu_grill_catalog_items` as pricing variants.
- A profile may show either menu del dia or grill, never both.
- `menu_grill_catalog_items.variant_name` defines the visible label for each grill variant.
- `menu_catalog_sections` contains only shared catalog sections; do not model daily service as profile-specific sections.
- When multiple profiles show menu del dia, they share the same current main dish.
- Prices are global across profiles; do not implement profile/menu-specific prices.
- Operational availability is profile/menu-specific and must be represented only by `public.menu_availability_overlays`.

Pricing rules:

- Direct section items must define `pricing`.
- Groups may define shared `pricing`.
- Items inside a priced group may omit `pricing` and inherit the group price.
- Items inside a group may define `pricing` as an override.
- If a group has no shared `pricing`, each item in that group must define `pricing`.
- Supported pricing kinds are `fixed`, `included`, and flat `variants`.
- Price amounts must be numeric in `price.amount`.
- Do not use free-text price labels or pending price states.

Image rules:

- Menu item images are optional.
- Store images under `public/uploads/`.
- Reference images with public paths like `/uploads/example.webp`.
- Do not allow external URLs, data URLs, query strings, fragments, backslashes, empty path segments, `.`, or `..`.
- Allowed extensions are `.avif`, `.jpeg`, `.jpg`, `.png`, `.svg`, and `.webp`.
- Keep SVG usage limited to repo-controlled placeholders or assets.

---

## Supabase Rules

Supabase may back an operational menu-content CMS for daily menu, grill mode,
grill products and options, availability, fixed-menu content, existing catalog
item options, global prices, and publication. It must not become a broad
editorial CMS without an explicit architecture decision.

Build-time structural and operational content:

- `supabase/migrations/` contains real operational Supabase migrations and is the canonical migration location for Supabase CLI and future migrations.
- `docs/supabase/schema.sql` defines the `menu_content` schema.
- `docs/supabase/daily-service-data.sql` seeds the daily-service settings and fixed grill list.
- `docs/supabase/hardening.sql` hardens constraints and indexes idempotently.
- `docs/supabase/audits/menu-schema-audit.sql` audits expected constraints and indexes.
- `docs/supabase/audits/database-audit.sql` is a read-only inventory, exposure, unexpected-object, and data-finding audit.
- `docs/supabase/README.md` documents the local-first Supabase workflow, real migration order, and remote-application rules.
- `docs/supabase/schema-diagram.md` documents the Mermaid ERD for `menu_content` and the runtime overlay.
- `docs/supabase/` keeps documentation, audits, snapshots, and explanatory SQL; do not place real migrations there.
- Until the production freeze, keep likely structural Supabase changes as incremental migrations. When the Supabase model is stable, create a Git tag that preserves the pre-launch migration history and consolidate a clean baseline migration for new databases.
- Do not consolidate the Supabase migration history while table, RPC, role, grant, RLS, or Edge Function contracts are still expected to change.
- Supabase CLI is installed as a dev dependency and should be run through npm scripts, for example `npm run supabase -- <args>`.
- `npm run supabase:functions:deploy` may deploy only the approved `publish-menu-changes` Edge Function and must keep platform JWT verification disabled for that function.
- `SUPABASE_DB_URL` is required for build-time structural reads and menu validation.
- Local development may define `SUPABASE_DB_URL` in `.env.local`; scripts load it only when an environment value is not already set.
- Never expose `SUPABASE_DB_URL` to the client or any `PUBLIC_*` environment variable.
- Menu del dia, active service, prices, catalog, groups, sections, images, and structural text are build-time data even when the operational admin or RPCs edit them.
- Build-time `available` columns are compatibility fields and must remain `true`; do not use them to represent operational unavailability.
- Changes to build-time data require rebuild/deploy before affecting `/menu/corpo/` and `/menu/teleinde/`.
- Legacy menu-content tables were removed by the explicit cleanup migration after flat-model deploy validation.

Runtime overlay:

- `docs/supabase/availability-overlay.sql` supports the availability overlay.
- `docs/supabase/operational-edit-rpcs.sql` defines the approved RPC write surface for operational CMS edits.
- `public.get_admin_operational_state()` is the approved read surface for the operational admin. Browser code must not query `menu_content` or `app_private` directly.
- Public admin RPCs and permission helpers must remain `security invoker` wrappers when they are executable by `authenticated`; privileged `security definer` bodies must live outside exposed API schemas, currently in `app_private`.
- Current publish helper exception: `public.reserve_menu_publish_request(...)` and `public.complete_menu_publish_request(...)` are `security definer` helpers for the `publish-menu-changes` Edge Function, revoked from `anon` and `authenticated`, and executable only by `service_role`. They are not browser/admin RPCs; moving them to `app_private` requires an explicit refactor or the pre-launch baseline.
- `public.staff_users` defines operational staff roles: `operator` and `admin`.
- `operator` can edit everything currently exposed by `/admin/` for every profile, including publishing changes.
- `admin` has operator permissions and may manage staff through privileged SQL/RPC surfaces.
- `public.staff_users` and the `can_edit_availability(text)`, `can_manage_staff()`, and `can_publish_menu()` helpers are required before operational edit RPCs may be installed.
- `can_edit_menu_content()` is introduced by the operational edit RPC phase; it is not a precondition of the `staff_users` migration.
- `publish-menu-changes` is the only approved Supabase Edge Function. It may publish build-time operational changes by validating Supabase Auth, checking `can_publish_menu()`, reserving/completing publish requests through service-role-only helpers, logging privately in `app_private`, recording a private build-time content fingerprint, and calling the Vercel Deploy Hook from Supabase Function secrets.
- `/admin/` publication-pending UI must compare the current build-time content fingerprint with the latest registered published fingerprint. Do not use a session-only "edited" flag as the source of truth for pending publication.
- Publish cooldown responses may include `cooldown_seconds_remaining`; keep that contract synchronized across the Edge Function, SQL helpers, and admin UI.
- The Edge Function runtime uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK_URL`, `PUBLISH_ALLOWED_ORIGINS`, and `PUBLISH_COOLDOWN_SECONDS`. Never expose the service role key or deploy hook to browser code or `PUBLIC_*` variables.
- `public.editor_profiles` is legacy-only and must not back new policies.
- The first `admin` staff row must be bootstrapped through privileged SQL or service role access, not browser RLS.
- Public client variables are `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
- `/admin/` may use Supabase Auth password recovery and password updates for staff users; recovery redirects must return to `/admin/`.
- The overlay may only change visual availability through availability data.
- A missing overlay means available; marking an item available in admin should clear the overlay, not write an explicit `true` override.
- Catalog items with options expose both the parent item target and each option target; each option uses a composed runtime target ID in the form `item-id-option-id`.
- Do not add `@supabase/supabase-js` to browser code for the current overlay/admin unless explicitly justified.

Data API grants:

- Do not rely on Supabase default grants for tables, views, or functions in `public`.
- Any migration that creates or changes a `public` object used through PostgREST, GraphQL, supabase-js, or direct `/rest/v1/` calls must include explicit `revoke` and `grant` statements in the same migration.
- Prefer the narrowest grant that supports the browser contract. Column-level grants are acceptable for public reads, as with `public.menu_availability_overlays`.
- Keep RLS enabled for Data API tables and define policies for the exact roles that need access.
- For `public` objects that are not part of the Data API contract, explicitly revoke access from `anon` and `authenticated`.
- Do not leave `SECURITY DEFINER` functions executable by `authenticated` or `anon` in exposed API schemas. Use a public `SECURITY INVOKER` wrapper plus a non-exposed privileged implementation when elevated access is required.
- After changing Data API permissions, verify the deployed project with the anon key and the exact browser query shape; a `42501` response means a required grant is missing or intentionally blocked.

Preserve the static-first model:

- stable menu content and build-time operational content may be read only at build time
- availability is the only allowed runtime overlay
- browser writes to operational data must use the approved RPCs and RLS helpers
- browser reads for `/admin/` must use `get_admin_operational_state()` or other explicitly approved read RPCs
- browser publish requests must use the `publish-menu-changes` Supabase Edge Function
- do not add direct structural browser queries to `menu_content`
- do not add runtime queries for daily menu, service kind, prices, catalog, groups, sections, images, or structural text
- do not add SSR, server output, adapters, or Vercel Functions

---

## UI, Performance, and Architecture Rules

The QR menu is mobile-first. Prioritize fast access, readability, low interaction cost, simple hierarchy, and practical buffet usage.

Keep the operational menu visually and functionally separate from the future institutional website. Shared tokens and branding are acceptable; marketing-style landing page patterns inside `/menu` are not.

Prefer:

- Astro-first rendering
- static output
- minimal client JavaScript
- non-blocking progressive client extensions
- reusable components where repetition exists
- explicit TypeScript interfaces
- simple folder structure
- Tailwind CSS and existing local patterns

Avoid:

- heavy client-side libraries
- unnecessary hydration
- sliders, carousels, animations, or runtime effects without clear value
- speculative abstractions
- hidden magic
- deeply coupled architecture
- new dependencies without strong justification

---

## Dependency Policy

Do not add dependencies casually.

Before adding a dependency, prefer:

1. Astro built-ins
2. Tailwind utilities and composition
3. TypeScript-native modeling
4. simple local utilities/components

A dependency is acceptable only when it clearly reduces complexity or enables a required capability that is not practical with the existing stack.

---

## Documentation Rules

Keep `README.md` and `AGENTS.md` synchronized without making them duplicates:

- `README.md` should explain the project for humans: setup, routes, content model, scripts, Supabase notes, deployment, and decisions.
- `AGENTS.md` should define rules for agents: scope boundaries, technical constraints, naming rules, validation, and safe handling of future migrations.

When adding scripts, environment variables, content sources, routes, or deployment behavior, update both documents if the change affects both human usage and agent constraints.

---

## Quality Gates

Before considering a change complete, run:

```bash
npm run build
npm run check
```

Additional checks:

- Run `npm run menu:validate` when working with menu content loading, Supabase schema expectations, or menu data shape.
- Run `npm run verify:dist-secrets` after `npm run build` when working with environment variables or Supabase database credentials.

Do not claim validation that was not performed.

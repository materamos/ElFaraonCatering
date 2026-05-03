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
- `/admin/` -> static placeholder served from `public/admin/index.html`

Current stack:

- Astro 5
- TypeScript
- Tailwind CSS 4
- Node 20 LTS
- npm
- Supabase Postgres for build-time structural menu content
- Vercel static deployment

Current source of truth:

- Supabase `menu_content` is the structural source read at build time.
- The runtime availability overlay is separate and progressive.
- There is no active CMS in the repo.
- The rollback to the previous file-backed content stage is the Git tag `yaml-rollback-2026-05-02`.

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
- serverless functions
- CMS code, auth, or repo-writing admin flows

Keep `/admin/` as a static placeholder under `public/admin/index.html`. Do not reintroduce an Astro page at the same route while it remains a placeholder.

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

Structural menu content is read from Supabase `menu_content` at build time.

The reader must return the shape consumed by `MenuPage`, `MenuSection`, and `DishCard`.

Required content surfaces:

- profiles
- current daily menu
- daily service settings by local
- fixed grill items
- catalog sections
- menu overrides
- groups
- items
- options
- fixed, included, and variant prices
- local image paths

Daily service rules:

- `menu_daily_menu` is the single shared daily-menu main dish field for the active day.
- `menu_daily_menu` must define the main dish name, availability, pricing, and may define description and note.
- `menu_daily_service_settings` must define one settings row per profile.
- `grill_enabled` is the per-profile property that applies the grill variant to the daily service.
- When `grill_enabled` is false, the profile shows three daily-menu options: the shared main dish, `Menu del dia + bebida`, and `Menu del dia vegetariano`.
- When `grill_enabled` is true, the profile shows `menu_grill_items` as the daily service variant.
- A profile may show either menu del dia or grill, never both.
- `menu_grill_items` is the fixed grill list; per-product availability can change through build-time data or the runtime availability overlay.

Pricing rules:

- Direct section items must define `pricing`.
- Groups may define shared `pricing`.
- Items inside a priced group may omit `pricing` and inherit the group price.
- Items inside a group may define `pricing` as an override.
- If a group has no shared `pricing`, each item in that group must define `pricing`.
- Supported pricing kinds are `fixed`, `included`, and flat `variants`.
- Price amounts must be numeric in `price.amount`.
- Do not use free-text price labels or pending price states.

Override rules:

- Overrides may only adjust `available`, `pricing`, and `note` for existing groups/items.
- Overrides must point to existing IDs.
- Overrides must not create new catalog structure.

Image rules:

- Menu item images are optional.
- Store images under `public/uploads/`.
- Reference images with public paths like `/uploads/example.webp`.
- Do not allow external URLs, data URLs, query strings, fragments, backslashes, empty path segments, `.`, or `..`.
- Allowed extensions are `.avif`, `.jpeg`, `.jpg`, `.png`, `.svg`, and `.webp`.
- Keep SVG usage limited to repo-controlled placeholders or assets.

---

## Supabase Rules

Supabase is not a CMS and does not imply an editorial workflow.

Build-time structural content:

- `docs/supabase-menu-schema.sql` defines the `menu_content` schema.
- `docs/supabase-menu-daily-service-data.sql` seeds the daily-service settings and fixed grill list.
- `docs/supabase-menu-schema-audit.sql` audits expected constraints and indexes.
- `docs/supabase-menu-schema-hardening.sql` hardens constraints and indexes idempotently.
- `SUPABASE_DB_URL` is required for build-time structural reads and menu validation.
- Local development may define `SUPABASE_DB_URL` in `.env.local`; scripts load it only when an environment value is not already set.
- Never expose `SUPABASE_DB_URL` to the client or any `PUBLIC_*` environment variable.

Runtime overlay:

- `docs/supabase-availability-overlay.sql` supports the availability overlay.
- Public client variables are `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
- The overlay may only change visual availability through availability data.
- Do not add `@supabase/supabase-js` for the current overlay unless explicitly justified.

Preserve the static-first model:

- stable menu content may be read only at build time
- operational overlays must remain non-blocking runtime extensions
- do not add structural browser queries
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

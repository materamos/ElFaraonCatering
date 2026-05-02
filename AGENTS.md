# AGENTS.md

## Role

Act as a pragmatic and precise software engineering assistant for the El Faraon Catering digital menu system.

Keep changes correct, maintainable, minimal, and aligned with the existing Astro/YAML/static-first architecture.

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
- Astro Content Collections
- YAML content files
- Node 20 LTS
- npm
- Vercel static deployment

Current source of truth:

- YAML is the source of truth for menu profiles, catalog sections, daily sections, prices, copy, options, overrides, and local image paths.
- Supabase is only a progressive availability overlay plus preparatory migration tooling.
- The system must work completely without Supabase.
- There is no active CMS in the repo.

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

Use Astro Content Collections under `src/content/`.

Active collections:

- `menu-profiles`
- `menu-daily-sections`
- `menu-catalog-sections`
- `menu-overrides`

Daily and catalog sections must define exactly one of:

- `items`
- `groups`

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

Supabase is not the CMS, not the primary backend, and not the current structural source of truth.

Runtime overlay:

- `docs/supabase-availability-overlay.sql` supports the availability overlay.
- Public client variables are `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
- The overlay may only change visual availability through availability data.
- If Supabase is missing, unavailable, or returns invalid data, the YAML state must remain usable.
- Do not add `@supabase/supabase-js` for the current overlay unless explicitly justified.

Preparatory structural tooling:

- `docs/supabase-menu-schema.sql` defines the preparatory `menu_content` schema.
- `npm run menu:import:dry-run` projects YAML to structural rows without writing to the database.
- `npm run menu:import:apply` writes the YAML projection to `menu_content` and requires `SUPABASE_DB_URL`.
- `npm run menu:compare` compares YAML projection with Supabase and requires `SUPABASE_DB_URL`.
- These scripts do not make Supabase the active source of truth.
- Do not present the scripts or SQL as an active CMS or active editorial workflow.
- Never expose `SUPABASE_DB_URL` to the client or any `PUBLIC_*` environment variable.

When touching Supabase projection logic, preserve the static-first model: stable shared menu data may be read at build time in a future migration, while operational overlays must remain non-blocking runtime extensions.

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
- typed schemas and explicit logic
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

When adding scripts, environment variables, content collections, routes, or deployment behavior, update both documents if the change affects both human usage and agent constraints.

---

## Quality Gates

Before considering a change complete, run:

```bash
npm run build
npm run check
```

Additional checks:

- Run `npm run verify:dist-secrets` after `npm run build` when working with environment variables or Supabase database credentials.
- Run `npm run menu:import:dry-run` when changing YAML projection logic.
- Run `npm run menu:compare` only when `SUPABASE_DB_URL` is intentionally available and a Supabase structural comparison is part of the task.

Do not claim validation that was not performed.

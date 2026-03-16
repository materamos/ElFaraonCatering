# AGENTS.md

## Project Overview

This repository contains the source code for the **El Faraon Catering digital menu system**.

The project is built primarily for the buffet operated by **El Faraon Catering** inside the **Paramount+ corporate building**. This is the first implementation and acts as the initial deployment before potentially extending the same system to other buffet locations operated by the company.

This project has two clearly separated business surfaces:

1. **Operational buffet menu** accessed mainly through QR codes
2. **Future institutional catering website**

The current development focus is the **QR menu experience**, not the institutional website.

---

## Current Baseline

The repository already contains a working technical base with:

- **Astro 5**
- **TypeScript**
- **Tailwind CSS 4**
- **Astro Content Collections**
- **Decap CMS static admin**
- **Netlify repo-managed config**
- **YAML content files**
- **Node 20 LTS**
- **npm**

Implemented routes:

- `/` -> future institutional placeholder
- `/menu` -> operational QR menu
- `/admin` -> Decap CMS admin app served from `public/admin/`

Implemented content collections:

- `daily-dishes`
- `fixed-dishes`
- `side-dishes`
- `drinks`

Current menu item schema:

- `name: string`
- `description?: string`
- `price: number`
- `available: boolean`
- `image?: string`

Important compatibility note:

- Keep the project compatible with **Node 20**
- Prefer staying on **Astro 5** unless the runtime requirement is intentionally upgraded
- Do not switch to tooling that requires Node 22+ unless explicitly requested
- Keep `/admin` served from static files under `public/admin/`; do not reintroduce an Astro page at the same route

Implemented deployment baseline:

- `netlify.toml` defines `npm run build` and `dist`
- `.nvmrc` and `package.json` engines pin Node 20
- Decap CMS is configured for `git-gateway` on branch `main`

---

## Core Product Intent

The system must provide a **fast, mobile-first, low-maintenance digital menu** that can be updated by non-technical staff through a CMS.

The menu is **informational only** in the current phase.

Do **not** add features such as:

- online ordering
- checkout or payments
- WhatsApp ordering
- reservations
- user accounts
- cart flows

Unless explicitly requested.

---

## Tech Stack

Use the following stack unless explicitly instructed otherwise:

- **Astro**
- **TypeScript**
- **Tailwind CSS**
- **Astro Content Collections**
- **YAML content files**
- **Decap CMS**
- **Netlify**
- **GitHub**
- **Node 20 LTS**
- **npm**

Do not introduce alternative frameworks, runtimes, or package managers unless explicitly requested.

---

## Package Manager and Runtime

- Use **npm**
- Assume **Node 20 LTS**
- Do not switch to pnpm, yarn, bun, or other runtimes
- Do not add tooling that requires a different runtime model

---

## Codebase Language Rules

- All **code**, **file names**, **component names**, **variables**, **types**, **schemas**, **comments**, and **internal identifiers** must be in **English**
- All **user-facing content** must be in **Spanish**, unless multilingual support is explicitly requested later

Do not mix Spanish and English in code structure.

---

## Routing Structure

The project must support the following route structure:

- `/` -> future institutional landing page
- `/menu` -> operational QR menu
- `/admin` -> Decap CMS admin

### Routing constraints

- `/menu` is the current product priority
- `/` must be treated as a future-facing institutional surface
- `/admin` is only for CMS access
- `/admin` should stay implemented via `public/admin/index.html`
- Do not couple `/menu` to the institutional site unnecessarily
- Do not assume the institutional landing page must link directly to `/menu`
- Do not design the buffet menu as if it were a public restaurant website

---

## Product Scope

The menu system must support these content groups:

- **Daily dishes** (`daily dishes`) - highest rotation
- **Fixed dishes** (`fixed dishes`) - lower rotation
- **Side dishes** (`side dishes`)
- **Drinks** (`drinks`)
- **Availability state**
- **Prices**
- **Images** (future support)

The system is for a buffet menu with a limited catalog. Avoid solutions designed for large restaurant platforms or e-commerce catalogs.

---

## Content Architecture

Use **Astro Content Collections** under `src/content/`.

Use **YAML** as the content format.

Expected content organization should remain simple and scalable. Prefer structures similar to:

- `src/content/fixed-dishes/`
- `src/content/daily-dishes/`
- `src/content/side-dishes/`
- `src/content/drinks/`

You may refine naming if needed, but keep it explicit, predictable, and fully in English.

### Content modeling principles

- Keep schemas strict and typed
- Prefer clear fields over flexible but ambiguous structures
- Avoid overly nested data unless it provides real value
- Keep content editor experience simple
- Model availability explicitly
- Model prices explicitly
- Prepare the schema so images can be added later without breaking existing content

---

## CMS Rules

The CMS is a critical part of the project.

Decap CMS must be able to manage:

- daily dishes
- fixed dishes
- side dishes
- drinks
- availability
- prices
- images (future-ready)

### CMS design constraints

- The editing experience must be simple enough for non-technical staff
- Do not expose unnecessary technical fields in the CMS
- Prefer constrained field choices when applicable
- Avoid content models that require editors to understand implementation details
- Minimize editorial friction

Do not design the CMS around developer convenience only. Editorial usability matters.

---

## UI and Design Rules

### Primary UX principle

The QR menu is **mobile-first**.

This is a hard requirement.

All UI decisions must prioritize:

- fast access from mobile devices
- readability
- low interaction cost
- fast loading
- clear hierarchy
- practical use inside a buffet context

### Visual separation

Do **not** visually mix the future institutional catering site with the operational buffet menu.

That means:

- avoid overly corporate landing-page patterns inside `/menu`
- avoid treating the menu like a brand-heavy marketing page
- keep the buffet menu functional and operational
- allow the institutional site to evolve later with a different content emphasis

Shared design tokens are fine. Shared visual identity is fine. But the two surfaces must remain clearly differentiated in purpose and UX.

### Component system

The project should be organized around:

- reusable components
- reusable layout patterns
- reusable UI primitives
- a visual token base from the start

This should include, where appropriate:

- spacing tokens
- typography scale
- radius rules
- color roles
- elevation/shadow rules
- layout constraints

Do not hardcode one-off visual values repeatedly if they belong to the design system.

At the same time, do not overengineer a full design system beyond what the project actually needs.

---

## Styling Rules

Use **Tailwind CSS**.

### Tailwind expectations

- Prefer reusable component abstractions for repeated UI
- Avoid long, duplicated utility chains when a component or shared abstraction is more appropriate
- Keep styling consistent with a token-oriented approach
- Avoid arbitrary values unless necessary
- Prefer maintainable composition over ad hoc styling

Do not add a second styling system unless explicitly required.

---

## Performance Rules

Performance is a core requirement.

Prioritize:

- static output
- minimal client-side JavaScript
- fast page load
- optimized images
- simple DOM structures
- limited interactivity unless required

### Performance constraints

- Do not add heavy client-side libraries without strong justification
- Do not hydrate components unless necessary
- Prefer Astro-first rendering patterns
- Avoid unnecessary animations, sliders, carousels, or runtime effects
- Treat image handling carefully, especially once food photography is added

If an implementation choice increases complexity or runtime cost, prefer the simpler and faster solution unless there is a clear functional gain.

---

## Architecture Principles

Be strict about simplicity.

### Always prefer

- straightforward folder structure
- explicit naming
- typed schemas
- reusable components where repetition exists
- static-first implementation
- low-maintenance decisions

### Avoid

- overengineering
- speculative abstractions
- premature generalization
- unnecessary dependencies
- hidden magic
- deeply coupled architecture
- CMS models that are harder than the product needs

This project should be easy to understand, easy to maintain, and easy to hand off.

---

## Dependency Policy

Do not add dependencies casually.

A new dependency is acceptable only if it provides clear value and meaningfully reduces implementation complexity.

Before adding any dependency, prefer:

1. Astro built-ins
2. Tailwind utilities and composition
3. TypeScript-native modeling
4. simple local utilities/components

Do not add libraries for problems that can be solved cleanly with the existing stack.

---

## File and Naming Conventions

Use explicit English names.

Examples:

- `MenuSection.astro`
- `DishCard.astro`
- `content.config.ts`
- `daily-dishes`
- `fixed-dishes`

Avoid vague names like:

- `data`
- `stuff`
- `helpers2`
- `new-component`
- `temp`

Keep naming predictable and descriptive.

---

## Quality Gates

Before considering a task complete, always run:

```bash
npm run build
npm run check
```

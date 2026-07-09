import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// La edge function corre en Deno (globals propios) y ya se valida al deployar;
// dist/.astro son artefactos de build.
export default tseslint.config(
  {
    ignores: ["dist/", ".astro/", "node_modules/", "supabase/functions/"],
  },
  {
    files: ["src/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/*.mjs", "scripts/**/*.mjs", "*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["public/scripts/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
);

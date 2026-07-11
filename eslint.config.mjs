import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Build outputs are validated separately and dependencies are external inputs.
export default tseslint.config(
  {
    ignores: ["dist/", ".astro/", "node_modules/"],
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
  {
    files: ["supabase/functions/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.deno,
      },
    },
  },
);

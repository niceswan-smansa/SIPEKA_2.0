import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const restrictedModuleImports = {
  patterns: [
    {
      group: ["@/modules/*/*", "!@/modules/*/client"],
      message:
        "Impor lintas modul harus melalui public API index.ts atau client.ts modul tersebut.",
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", restrictedModuleImports],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", "window", "document", "localStorage", "fetch"],
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom", "next", "server-only"],
          patterns: [
            ...restrictedModuleImports.patterns,
            { group: ["next/**", "@supabase/**", "@/infrastructure/**"] },
            { group: ["@/modules/*/application/**", "@/modules/*/infrastructure/**"] },
            { group: ["@/modules/*/presentation/**"] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/modules/*/presentation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...restrictedModuleImports.patterns,
            { group: ["@supabase/**", "@/infrastructure/database/**"] },
            { group: ["@/modules/*/infrastructure/**"] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/infrastructure/**/*.{ts,tsx}", "src/modules/*/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...restrictedModuleImports.patterns,
            { group: ["@/app/**", "@/modules/*/presentation/**"] },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/.branches/**",
    "supabase/.temp/**",
  ]),
]);

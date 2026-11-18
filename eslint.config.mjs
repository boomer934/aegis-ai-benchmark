import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // React Three Fiber scenes mutate Three.js objects (materials, uniforms,
    // transforms) inside useFrame/effects by design: that is how R3F avoids
    // re-rendering React at frame rate. The React Compiler immutability rule
    // cannot distinguish these GPU-side objects from React state.
    files: ["src/components/three/**/*.{ts,tsx}", "src/features/*/scene/**/*.{ts,tsx}"],
    rules: { "react-hooks/immutability": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

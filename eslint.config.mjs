import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next. eslint-config-next's
  // own ".next/**" etc. only match at the config-file's own directory, so
  // they miss build artifacts inside nested git worktrees under
  // .claude/worktrees/*/.next/** — those got fully linted (including
  // generated Next.js type-checking files) whenever this config ran from
  // a different worktree, massively inflating the real error count.
  // "**/" prefixes match at any depth.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "**/out/**",
    "build/**",
    "**/build/**",
    "next-env.d.ts",
    "**/next-env.d.ts",
    ".claude/worktrees/**",
  ]),
  {
    // Playwright's fixture callback parameter is conventionally named
    // `use` (see e2e/fixtures.ts's `test.extend({ ... async (fixtures,
    // use) => ... })`), which react-hooks/rules-of-hooks misreads as a
    // call to React's `use()` hook from a non-component/non-hook
    // function. e2e/ isn't part of the Next.js app — its files never
    // render React — so react-hooks rules don't apply here at all.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;

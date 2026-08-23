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
]);

export default eslintConfig;

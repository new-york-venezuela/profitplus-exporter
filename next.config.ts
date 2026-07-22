import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Prevent Next.js from bundling native modules — they must be required at runtime
  serverExternalPackages: ['better-sqlite3', 'argon2', 'mssql'],
  experimental: {
    // WORKAROUND: Turbopack regression in Next.js 16.2.10-16.2.11
    // The auto-generated _global-error boundary fails during static prerendering
    // with: TypeError: null is not an object (evaluating 'k.H.useContext')
    // Setting staticGenerationRetryCount: 0 skips the export retry loop, preventing
    // the broken prerender attempt. This means ALL static pages in the app will NOT
    // be prerendered at build time and will be rendered dynamically on each request.
    // This is a temporary workaround until Next.js fixes the upstream Turbopack bug.
    // TODO: Remove this once upstream Next.js issue is resolved (track in GitHub issues)
    staticGenerationRetryCount: 0,
  },
};

export default config;

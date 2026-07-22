import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Prevent Next.js from bundling native modules — they must be required at runtime
  serverExternalPackages: ['better-sqlite3', 'argon2', 'mssql'],
  experimental: {
    staticGenerationRetryCount: 0,
  },
};

export default config;

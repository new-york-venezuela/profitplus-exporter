import type { NextConfig } from 'next';

const config: NextConfig = {
  // Prevent Next.js from bundling native modules — they must be required at runtime
  serverExternalPackages: ['better-sqlite3', 'argon2', 'mssql'],
};

export default config;

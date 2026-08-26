import sql from 'mssql';

function dwEnv(name: string, fallback: string): string {
  return process.env[`DW_${name}`] ?? process.env[`DB_${name}`] ?? fallback;
}

function buildConfig(): sql.config {
  return {
    server: dwEnv('SERVER', 'localhost'),
    port: parseInt(dwEnv('PORT', '1433')),
    database: process.env.DW_NAME ?? 'DWH_AlimentosNY',
    user: dwEnv('USER', 'sa'),
    password: dwEnv('PASSWORD', ''),
    options: {
      encrypt: dwEnv('ENCRYPT', 'false') === 'true',
      trustServerCertificate: dwEnv('TRUST_SERVER_CERT', 'true') !== 'false',
    },
    pool: {
      min: 1,
      max: 5,
      idleTimeoutMillis: 30_000,
    },
  };
}

// Singleton prevents multiple connections during Next.js hot reload in dev
const globalForDb = global as typeof global & { _dwhMssql?: sql.ConnectionPool };

let pool = globalForDb._dwhMssql;

export async function getDwhPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(buildConfig()).connect();
  if (process.env.NODE_ENV !== 'production') globalForDb._dwhMssql = pool;
  return pool;
}

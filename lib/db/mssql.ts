import sql from 'mssql';

function buildConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30_000,
    },
  };
}

// Singleton prevents multiple connections during Next.js hot reload in dev
const globalForDb = global as typeof global & { _mssql?: sql.ConnectionPool };

let pool = globalForDb._mssql;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(buildConfig()).connect();
  if (process.env.NODE_ENV !== 'production') globalForDb._mssql = pool;
  return pool;
}

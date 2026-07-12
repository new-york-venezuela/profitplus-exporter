# ProfitPlus Exporter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready internal Next.js 15 web app that queries a Profit Plus SQL Server ERP and exports date-filtered reports as UTF-8 CSV, with a full auth system, admin panel, and drag-to-reorder column management UI.

**Architecture:** Two-database design — SQLite (Drizzle ORM + better-sqlite3) for user accounts with JWT-based stateless sessions, SQL Server (mssql singleton pool) for ERP data exposed via SQL views or stored procedures. All report logic is driven by a typed registry; adding report N requires one config file and zero changes to API routes.

**Tech Stack:** Next.js 15 App Router · TypeScript 5 · Bun (package manager + runtime) · Drizzle ORM · better-sqlite3 · mssql · argon2 · jose · @dnd-kit/sortable · Tailwind CSS 4 · prompts

## Global Constraints

- Bun is the package manager and runtime; use `bun` / `bunx` everywhere — never `npm` / `npx`
- Node.js LTS ≥ 20 required (for native module compilation); pin in `.nvmrc`
- All secrets in `.env.local` only — never committed to git
- Tailwind CSS v4 — CSS-first config, `@import "tailwindcss"` in globals.css, no `tailwind.config.ts`
- `next.config.ts` must declare `serverExternalPackages: ['better-sqlite3', 'argon2', 'mssql']`
- `middleware.ts` runs in Edge Runtime — never import `next/headers`, `better-sqlite3`, or `mssql` there
- Dates travel as `YYYY-MM-DD` strings throughout the system; no date library
- CSV output: UTF-8 BOM (`﻿` prefix) + RFC 4180 quoting
- All mssql queries use parameterized inputs — zero string interpolation of user-controlled values
- Path alias `@/*` maps to project root (configured in `tsconfig.json`)
- Unit tests run with `bun test`; test files are `*.test.ts`

---

## File Responsibility Map

```
profitplus-exporter/
├── app/
│   ├── layout.tsx                          # Root HTML shell (lang="es", globals.css)
│   ├── page.tsx                            # Root redirect → /reports/ventas
│   ├── globals.css                         # @import "tailwindcss"
│   ├── (auth)/
│   │   └── login/page.tsx                  # Public login form (client component)
│   ├── (app)/                              # Protected route group (middleware guards)
│   │   ├── layout.tsx                      # Server component: session check + sidebar shell
│   │   ├── reports/
│   │   │   ├── ventas/page.tsx             # Server: passes VENTAS_CONFIG + date defaults as props
│   │   │   └── compras/page.tsx            # Server: passes COMPRAS_CONFIG + date defaults as props
│   │   └── admin/
│   │       └── users/
│   │           ├── page.tsx                # Server: role check + initial user list from SQLite
│   │           └── users-client.tsx        # Client: interactive table, modals, API calls
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts              # POST: verify creds → set session cookie
│       │   └── logout/route.ts             # POST: clear session cookie
│       ├── reports/[report]/
│       │   ├── export/route.ts             # GET: SQL → CSV download (UTF-8 BOM)
│       │   └── preview/route.ts            # GET: SQL → JSON {rows, totalCount}
│       └── admin/users/
│           ├── route.ts                    # GET: list users | POST: create user
│           └── [id]/
│               ├── route.ts               # DELETE: remove user (not self)
│               └── reset-password/route.ts # POST: hash + update password
├── lib/
│   ├── db/
│   │   ├── schema.ts                       # Drizzle: users table definition + inferred types
│   │   ├── sqlite.ts                       # Drizzle client singleton (hot-reload safe)
│   │   └── mssql.ts                        # mssql pool singleton: getPool()
│   ├── auth/
│   │   ├── session.ts                      # Pure JWT: signToken(), verifyToken() — Edge-safe
│   │   └── get-session.ts                  # Server-only: getSession() via next/headers cookies()
│   ├── reports/
│   │   ├── registry.ts                     # ColumnDef, ReportConfig types + REPORTS map
│   │   ├── ventas.ts                       # VENTAS_CONFIG (stub — columns TBD)
│   │   └── compras.ts                      # COMPRAS_CONFIG (stub — columns TBD)
│   ├── csv.ts                              # buildCsv(): UTF-8 BOM + RFC 4180
│   └── dates.ts                            # getPreviousMonthRange(), parseDate()
├── components/
│   ├── sidebar.tsx                         # Client: nav links, conditional admin section, logout
│   ├── report-page.tsx                     # Client: date picker + column manager + preview + export
│   ├── column-manager.tsx                  # Client: @dnd-kit/sortable chip list with toggle
│   ├── date-range-picker.tsx               # Client: two date inputs + Aplicar button
│   └── modal.tsx                           # Client: reusable overlay modal
├── middleware.ts                           # Edge: JWT verification → redirect or 401
├── scripts/
│   ├── migrate.ts                          # Run Drizzle migrations programmatically
│   └── seed.ts                             # Interactive createsuperuser (prompts, argon2)
├── drizzle/migrations/                     # Auto-generated by drizzle-kit generate
├── data/
│   └── .gitkeep                            # Tracked; data/*.db is gitignored
├── .env.example
├── .gitignore
├── .nvmrc
├── next.config.ts
├── drizzle.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── README.md
├── INSTRUCTIONS.md
└── AGENTS.md
```

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json` (via bunx create-next-app)
- Create/Modify: `next.config.ts`
- Modify: `tsconfig.json` (verify paths alias)
- Create: `postcss.config.mjs`
- Create/Modify: `app/globals.css`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `drizzle.config.ts`
- Create: `.nvmrc`
- Create: `data/.gitkeep`

**Interfaces:**
- Produces: Working `bun dev` server at localhost:3000; all config in place for subsequent tasks

- [ ] **Step 1: Scaffold Next.js 15 project**

Run from the workspace root (the directory is already initialized as a git repo):
```bash
bunx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbopack
```
When prompted for project name, accept the default (current directory).

Expected: `next`, `react`, `react-dom`, `tailwindcss` installed; `app/`, `public/`, `next.config.ts` created.

- [ ] **Step 2: Install additional runtime dependencies**

```bash
bun add mssql better-sqlite3 drizzle-orm argon2 jose prompts \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```bash
bun add -D drizzle-kit @types/better-sqlite3 @types/mssql @types/prompts
```

- [ ] **Step 3: Upgrade Tailwind to v4**

Tailwind v3 was scaffolded; upgrade to v4:
```bash
bun remove tailwindcss postcss autoprefixer
bun add tailwindcss@^4 @tailwindcss/postcss
```

Delete the generated `tailwind.config.ts` (v4 does not use it):
```bash
rm -f tailwind.config.ts tailwind.config.js
```

- [ ] **Step 4: Update `postcss.config.mjs`**

Replace the entire file:
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 5: Update `app/globals.css`**

Replace the entire file:
```css
@import "tailwindcss";

@layer base {
  *, *::before, *::after { box-sizing: border-box; }
  body { -webkit-font-smoothing: antialiased; }
}
```

- [ ] **Step 6: Update `next.config.ts`**

Replace the entire file:
```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Prevent Next.js from bundling native modules — they must be required at runtime
  serverExternalPackages: ['better-sqlite3', 'argon2', 'mssql'],
};

export default config;
```

- [ ] **Step 7: Create `drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? './data/app.db',
  },
} satisfies Config;
```

- [ ] **Step 8: Verify `tsconfig.json` has the `@` path alias**

Open `tsconfig.json` and confirm `compilerOptions.paths` contains:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Add if missing.

- [ ] **Step 9: Create `.nvmrc`**

```
20
```

- [ ] **Step 10: Create `data/.gitkeep`**

```bash
mkdir -p data && touch data/.gitkeep
```

- [ ] **Step 11: Update `.gitignore`**

Append to the generated `.gitignore`:
```gitignore
# Local environment — NEVER commit
.env.local

# SQLite database files
data/*.db
data/*.db-shm
data/*.db-wal
```

- [ ] **Step 12: Create `.env.example`**

```bash
# ─── SQL Server (Profit Plus ERP) ──────────────────────────────────────
DB_SERVER=192.168.1.x
DB_PORT=1433
DB_NAME=ProfitPlusDB
DB_USER=readonly_user
DB_PASSWORD=changeme
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true

# ─── SQLite (user accounts) ────────────────────────────────────────────
# Dev: relative path is fine.
# Production: use an absolute path OUTSIDE the app directory so the
# database survives redeploys (e.g. C:\data\app.db or /opt/data/app.db).
SQLITE_PATH=./data/app.db

# ─── Auth ──────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
JWT_SECRET=replace-with-openssl-rand-hex-32-output
JWT_EXPIRY_DAYS=7

# ─── App ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME=ProfitPlus Exporter
NODE_ENV=development
```

- [ ] **Step 13: Copy `.env.example` to `.env.local` and fill in dev values**

```bash
cp .env.example .env.local
# Edit .env.local with a real JWT_SECRET and your local DB credentials (or leave DB blank for now)
openssl rand -hex 32   # paste output as JWT_SECRET
```

- [ ] **Step 14: Delete boilerplate app files created by scaffold**

```bash
rm -f app/page.tsx   # we'll create our own
```

- [ ] **Step 15: Verify dev server starts**

```bash
bun dev
```

Expected output:
```
  ▲ Next.js 15.x.x
  - Local: http://localhost:3000
  ✓ Ready in ~2s
```

Open http://localhost:3000 — a 404 is expected (no pages yet).

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with Tailwind v4 and dependency configuration"
```

---

### Task 2: SQLite Database Layer

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/sqlite.ts`
- Create: `scripts/migrate.ts`
- Create: `drizzle/migrations/` (generated)

**Interfaces:**
- Consumes: `drizzle.config.ts` from Task 1
- Produces: `db` instance (Drizzle client); `users` table schema; `migrate()` function used by seed script

- [ ] **Step 1: Create `lib/db/schema.ts`**

```typescript
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt:    integer('created_at').notNull(),                // unix ms; use Date.now() on insert
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 2: Create `lib/db/sqlite.ts`**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import * as schema from './schema';

const dbPath = path.resolve(process.env.SQLITE_PATH ?? './data/app.db');

// Singleton prevents multiple connections during Next.js hot reload in dev
const globalForDb = global as typeof global & { _sqlite?: Database.Database };

const sqlite = globalForDb._sqlite ?? new Database(dbPath);
if (process.env.NODE_ENV !== 'production') globalForDb._sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
```

- [ ] **Step 3: Create `scripts/migrate.ts`**

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../lib/db/sqlite';

migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('✓ Migraciones aplicadas');
```

- [ ] **Step 4: Add scripts to `package.json`**

Open `package.json` and update the `"scripts"` section:
```json
{
  "scripts": {
    "dev":          "next dev",
    "build":        "next build",
    "start":        "next start",
    "lint":         "next lint",
    "seed":         "bun scripts/seed.ts",
    "migrate":      "bun scripts/migrate.ts",
    "db:generate":  "drizzle-kit generate",
    "db:studio":    "drizzle-kit studio"
  }
}
```

- [ ] **Step 5: Generate the initial migration**

```bash
bun run db:generate
```

Expected output:
```
2 tables
users  0 columns 0 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/migrations/0000_initial.sql
```

Verify `drizzle/migrations/0000_initial.sql` exists and contains `CREATE TABLE users`.

- [ ] **Step 6: Run migrations**

```bash
bun run migrate
```

Expected output:
```
✓ Migraciones aplicadas
```

Verify `data/app.db` was created:
```bash
ls -la data/
```

Expected: `app.db` file present alongside `.gitkeep`.

- [ ] **Step 7: Commit**

```bash
git add lib/db/ scripts/migrate.ts drizzle/ data/.gitkeep package.json
git commit -m "feat: add SQLite database layer with Drizzle ORM schema and migrations"
```

---

### Task 3: JWT Session Utilities

**Files:**
- Create: `lib/auth/session.ts`
- Create: `lib/auth/get-session.ts`
- Create: `lib/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `signToken(payload: SessionPayload): Promise<string>`
  - `verifyToken(token: string): Promise<SessionPayload | null>`
  - `getSession(): Promise<SessionPayload | null>` (Server Components / Route Handlers only)
  - `SessionPayload { sub: string; role: 'user' | 'admin'; name: string }`

- [ ] **Step 1: Write failing tests in `lib/auth/session.test.ts`**

```typescript
import { describe, test, expect, beforeAll } from 'bun:test';
import { signToken, verifyToken, type SessionPayload } from './session';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-exactly-32-chars-long-here';
  process.env.JWT_EXPIRY_DAYS = '7';
});

const payload: SessionPayload = { sub: '42', role: 'admin', name: 'Ana García' };

describe('signToken / verifyToken', () => {
  test('signs a token and verifies it round-trip', async () => {
    const token = await signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    const result = await verifyToken(token);
    expect(result?.sub).toBe('42');
    expect(result?.role).toBe('admin');
    expect(result?.name).toBe('Ana García');
  });

  test('returns null for a completely invalid token', async () => {
    expect(await verifyToken('not.a.jwt')).toBeNull();
  });

  test('returns null for a tampered token', async () => {
    const token = await signToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifyToken(tampered)).toBeNull();
  });

  test('throws if JWT_SECRET is not set', async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => signToken(payload)).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = original;
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
bun test lib/auth/session.test.ts
```

Expected: `Error: Cannot find module './session'`

- [ ] **Step 3: Create `lib/auth/session.ts`**

```typescript
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface SessionPayload {
  sub:  string;                 // user id as string
  role: 'user' | 'admin';
  name: string;
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const days = parseInt(process.env.JWT_EXPIRY_DAYS ?? '7');
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create `lib/auth/get-session.ts`**

This file imports `next/headers` and must NOT be used in `middleware.ts` (Edge Runtime).

```typescript
import { cookies } from 'next/headers';
import { verifyToken, type SessionPayload } from './session';

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
bun test lib/auth/session.test.ts
```

Expected:
```
lib/auth/session.test.ts:
✓ signToken / verifyToken > signs a token and verifies it round-trip
✓ signToken / verifyToken > returns null for a completely invalid token
✓ signToken / verifyToken > returns null for a tampered token
✓ signToken / verifyToken > throws if JWT_SECRET is not set

4 pass
0 fail
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth/
git commit -m "feat: add JWT session utilities (signToken, verifyToken, getSession)"
```

---

### Task 4: Auth Middleware & API Routes

**Files:**
- Create: `middleware.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `verifyToken` from `lib/auth/session.ts`; `db`, `users`, `eq` from db layer; `argon2`; `signToken`
- Produces: `POST /api/auth/login` → sets `session` cookie; `POST /api/auth/logout` → clears cookie; middleware guards all non-public routes

- [ ] **Step 1: Create `middleware.ts`**

Note: this file runs in Edge Runtime. Only import from `jose` and `lib/auth/session`.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const resp = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    resp.cookies.delete('session');
    return resp;
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except login page, auth API, Next.js internals, and static files
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon\\.ico).*)'],
};
```

- [ ] **Step 2: Create `app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth/session';
import argon2 from 'argon2';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.email, body.email as string)).get();
  if (!user) {
    // Same error as wrong password — avoids user enumeration
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const valid = await argon2.verify(user.passwordHash, body.password as string);
  if (!valid) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const token = await signToken({ sub: String(user.id), role: user.role, name: user.name });
  const expiryDays = parseInt(process.env.JWT_EXPIRY_DAYS ?? '7');

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', token, {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax',
    path:      '/',
    maxAge:    expiryDays * 86400,
  });
  return response;
}
```

- [ ] **Step 3: Create `app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('session');
  return response;
}
```

- [ ] **Step 4: Create a placeholder root page to test the middleware**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation';
export default function RootPage() {
  redirect('/reports/ventas');
}
```

Create a minimal placeholder for `/reports/ventas` so the redirect chain is testable:

```typescript
// app/(app)/reports/ventas/page.tsx  (temporary placeholder)
export default function VentasPage() {
  return <p>Ventas (placeholder)</p>;
}
```

Also create the `(app)` layout placeholder (will be replaced in Task 11):
```typescript
// app/(app)/layout.tsx  (temporary — will be replaced in Task 11)
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 5: Start dev server and test manually**

```bash
bun dev
```

Test 1 — Middleware redirects unauthenticated request:
```bash
curl -v http://localhost:3000/reports/ventas
# Expected: 307 redirect to http://localhost:3000/login
```

Test 2 — Login with no user yet (will fail with 401):
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Expected: 401 {"error":"Credenciales inválidas"}
```

Test 3 — API routes return 401 JSON (not redirect):
```bash
curl -v http://localhost:3000/api/reports/ventas/preview
# Expected: 401 {"error":"No autorizado"}
```

- [ ] **Step 6: Commit**

```bash
git add middleware.ts app/api/auth/ app/page.tsx app/(app)/
git commit -m "feat: add auth middleware and login/logout API routes"
```

---

### Task 5: Admin Seed Script

**Files:**
- Create: `scripts/seed.ts`

**Interfaces:**
- Consumes: `db`, `users` from db layer; `migrate` from Drizzle migrator; `argon2`; `prompts`
- Produces: Interactive CLI that creates an admin user; safe to re-run (checks for duplicate email)

- [ ] **Step 1: Create `scripts/seed.ts`**

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import prompts from 'prompts';
import { db } from '../lib/db/sqlite';
import { users } from '../lib/db/schema';

// Ensure schema is up-to-date before inserting
migrate(db, { migrationsFolder: './drizzle/migrations' });

async function main() {
  console.log('\n─── Crear usuario administrador ───────────────────────\n');

  const answers = await prompts([
    {
      type:     'text',
      name:     'email',
      message:  'Email:',
      validate: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido',
    },
    {
      type:    'text',
      name:    'name',
      message: 'Nombre completo:',
      validate: (v: string) => v.trim().length >= 2 || 'Nombre demasiado corto',
    },
    {
      type:     'password',
      name:     'password',
      message:  'Contraseña:',
      validate: (v: string) => v.length >= 8 || 'Mínimo 8 caracteres',
    },
    {
      type:     'password',
      name:     'confirm',
      message:  'Confirmar contraseña:',
      validate: (v: string, vals: { password: string }) =>
        v === vals.password || 'Las contraseñas no coinciden',
    },
  ], {
    onCancel: () => {
      console.log('\nCancelado.');
      process.exit(0);
    },
  });

  const email = (answers.email as string).trim().toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    console.error(`\n✗ Ya existe un usuario con el email: ${email}`);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(answers.password as string);

  db.insert(users).values({
    email,
    name:      (answers.name as string).trim(),
    passwordHash,
    role:      'admin',
    createdAt: Date.now(),
  }).run();

  console.log(`\n✓ Usuario administrador creado: ${email}\n`);
}

main().catch((err) => {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run seed script**

```bash
bun run seed
```

Expected interactive session:
```
─── Crear usuario administrador ───────────────────────

? Email: › admin@empresa.com
? Nombre completo: › Ana García
? Contraseña: › ••••••••
? Confirmar contraseña: › ••••••••

✓ Usuario administrador creado: admin@empresa.com
```

- [ ] **Step 3: Verify user was inserted**

```bash
# Quick check using sqlite3 CLI (if available), or verify via login:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"yourpassword"}'
# Expected: 200 {"ok":true}  and Set-Cookie header with session token
```

- [ ] **Step 4: Verify duplicate detection**

```bash
bun run seed
# Enter the same email at the prompt
# Expected: ✗ Ya existe un usuario con el email: admin@empresa.com
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add interactive admin seed script (createsuperuser equivalent)"
```

---

### Task 6: MSSQL Connection Pool

**Files:**
- Create: `lib/db/mssql.ts`

**Interfaces:**
- Produces: `getPool(): Promise<sql.ConnectionPool>` — reusable across all report API routes

- [ ] **Step 1: Create `lib/db/mssql.ts`**

```typescript
import sql from 'mssql';

function buildConfig(): sql.config {
  return {
    server:   process.env.DB_SERVER!,
    port:     parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user:     process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt:              process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    },
    pool: {
      min:                2,
      max:                10,
      idleTimeoutMillis:  30_000,
    },
  };
}

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(buildConfig()).connect();
  return pool;
}
```

- [ ] **Step 2: Verify the module compiles**

```bash
bun build lib/db/mssql.ts --outfile /dev/null
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/mssql.ts
git commit -m "feat: add MSSQL singleton connection pool"
```

---

### Task 7: Report Registry, Date Utilities & CSV Builder

**Files:**
- Create: `lib/reports/registry.ts`
- Create: `lib/reports/ventas.ts`
- Create: `lib/reports/compras.ts`
- Create: `lib/dates.ts`
- Create: `lib/csv.ts`
- Create: `lib/dates.test.ts`
- Create: `lib/csv.test.ts`

**Interfaces:**
- Produces:
  - `ColumnDef`, `ReportConfig`, `REPORTS` from `lib/reports/registry.ts`
  - `getPreviousMonthRange(today?: Date): { startDate: string; endDate: string }`
  - `parseDate(value: string | null): string | null`
  - `buildCsv(columns: ColumnDef[], rows: Record<string, unknown>[]): string`

- [ ] **Step 1: Write failing tests for `lib/dates.ts`**

Create `lib/dates.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test';
import { getPreviousMonthRange, parseDate } from './dates';

describe('getPreviousMonthRange', () => {
  test('mid-month July → June', () => {
    expect(getPreviousMonthRange(new Date('2026-07-10')))
      .toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });
  });

  test('January wraps to previous year December', () => {
    expect(getPreviousMonthRange(new Date('2026-01-15')))
      .toEqual({ startDate: '2025-12-01', endDate: '2025-12-31' });
  });

  test('March after February in a leap year', () => {
    expect(getPreviousMonthRange(new Date('2024-03-05')))
      .toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  test('August → July (31-day month)', () => {
    expect(getPreviousMonthRange(new Date('2026-08-01')))
      .toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });
});

describe('parseDate', () => {
  test('returns null for null input', () => expect(parseDate(null)).toBeNull());
  test('returns null for US format', () => expect(parseDate('07/10/2026')).toBeNull());
  test('returns null for single-digit month', () => expect(parseDate('2026-7-1')).toBeNull());
  test('returns the string for valid YYYY-MM-DD', () => expect(parseDate('2026-06-01')).toBe('2026-06-01'));
});
```

- [ ] **Step 2: Write failing tests for `lib/csv.ts`**

Create `lib/csv.test.ts`:
```typescript
import { describe, test, expect } from 'bun:test';
import { buildCsv } from './csv';
import type { ColumnDef } from './reports/registry';

const cols: ColumnDef[] = [
  { key: 'ruc',    label: 'RUC',          defaultVisible: true, defaultOrder: 0 },
  { key: 'nombre', label: 'Razón Social',  defaultVisible: true, defaultOrder: 1 },
  { key: 'monto',  label: 'Monto',         defaultVisible: true, defaultOrder: 2 },
];

describe('buildCsv', () => {
  test('first character is UTF-8 BOM (U+FEFF)', () => {
    expect(buildCsv(cols, []).charCodeAt(0)).toBe(0xfeff);
  });

  test('header row matches column labels', () => {
    const lines = buildCsv(cols, []).slice(1).split('\r\n');
    expect(lines[0]).toBe('RUC,Razón Social,Monto');
  });

  test('data row with Spanish characters (Ñ, á, etc.)', () => {
    const rows = [{ ruc: 'J-12345678-9', nombre: 'Empresa Ñoño S.A.', monto: 1500.50 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe('J-12345678-9,Empresa Ñoño S.A.,1500.5');
  });

  test('quotes fields containing commas', () => {
    const rows = [{ ruc: '123', nombre: 'Empresa, S.A.', monto: 100 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe('123,"Empresa, S.A.",100');
  });

  test('escapes double-quotes inside quoted fields', () => {
    const rows = [{ ruc: '123', nombre: 'Empresa "El Rey"', monto: 100 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe('123,"Empresa ""El Rey""",100');
  });

  test('null and undefined become empty strings', () => {
    const rows = [{ ruc: null, nombre: undefined, monto: 0 }];
    const lines = buildCsv(cols, rows).slice(1).split('\r\n');
    expect(lines[1]).toBe(',,0');
  });

  test('uses CRLF line endings (RFC 4180)', () => {
    const csv = buildCsv(cols, [{ ruc: 'A', nombre: 'B', monto: 1 }]);
    expect(csv.slice(1)).toContain('\r\n');
  });
});
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
bun test lib/dates.test.ts lib/csv.test.ts
```

Expected: module not found errors for `./dates` and `./csv`.

- [ ] **Step 4: Create `lib/reports/registry.ts`**

```typescript
export interface ColumnDef {
  key:            string;   // exact SQL column alias
  label:          string;   // Spanish display name shown in UI and CSV header
  defaultVisible: boolean;
  defaultOrder:   number;
  alwaysVisible?: boolean;  // if true, cannot be toggled off in the UI
}

export interface ReportConfig {
  id:          string;                    // matches URL param: "ventas" | "compras"
  label:       string;                    // displayed in UI: "Libro de Ventas"
  queryType:   'view' | 'procedure';
  sourceName:  string;                    // SQL view name or stored procedure name
  dateColumn?: string;                    // required when queryType === 'view'
  columns:     ColumnDef[];
}

import { VENTAS_CONFIG }  from './ventas';
import { COMPRAS_CONFIG } from './compras';

export const REPORTS: Record<string, ReportConfig> = {
  ventas:  VENTAS_CONFIG,
  compras: COMPRAS_CONFIG,
};
```

- [ ] **Step 5: Create `lib/reports/ventas.ts`**

Column definitions are stubs — populate once you have the SQL view schema.

```typescript
import type { ReportConfig } from './registry';

export const VENTAS_CONFIG: ReportConfig = {
  id:         'ventas',
  label:      'Libro de Ventas',
  queryType:  'view',
  sourceName: 'v_custom_sales_book',   // TODO: replace with actual view name
  dateColumn: 'fecha',                  // TODO: replace with actual date column alias
  columns: [
    // TODO: populate once ERP view schema is available.
    // Example entry:
    // { key: 'fecha',       label: 'Fecha',        defaultVisible: true,  defaultOrder: 0, alwaysVisible: true },
    // { key: 'ruc',         label: 'RUC',           defaultVisible: true,  defaultOrder: 1 },
    // { key: 'razon_social',label: 'Razón Social',  defaultVisible: true,  defaultOrder: 2 },
    // { key: 'monto_total', label: 'Monto Total',   defaultVisible: true,  defaultOrder: 3 },
  ],
};
```

- [ ] **Step 6: Create `lib/reports/compras.ts`**

```typescript
import type { ReportConfig } from './registry';

export const COMPRAS_CONFIG: ReportConfig = {
  id:         'compras',
  label:      'Libro de Compras',
  queryType:  'view',
  sourceName: 'v_custom_purchases_book', // TODO: replace with actual view name
  dateColumn: 'fecha',                    // TODO: replace with actual date column alias
  columns: [
    // TODO: populate once ERP view schema is available.
  ],
};
```

- [ ] **Step 7: Create `lib/dates.ts`**

```typescript
export interface DateRange {
  startDate: string;  // YYYY-MM-DD
  endDate:   string;  // YYYY-MM-DD
}

/**
 * Returns the first and last day of the month preceding `today`.
 * Default: uses the real current date.
 */
export function getPreviousMonthRange(today: Date = new Date()): DateRange {
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-indexed (0 = January)

  const prevYear  = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 12 : month; // 1-indexed

  const mm       = String(prevMonth).padStart(2, '0');
  const lastDay  = new Date(prevYear, prevMonth, 0).getDate(); // day-0 trick
  const dd       = String(lastDay).padStart(2, '0');

  return {
    startDate: `${prevYear}-${mm}-01`,
    endDate:   `${prevYear}-${mm}-${dd}`,
  };
}

/** Validates and returns a YYYY-MM-DD string, or null if invalid. */
export function parseDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}
```

- [ ] **Step 8: Create `lib/csv.ts`**

```typescript
import type { ColumnDef } from './reports/registry';

function escapeField(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a UTF-8 BOM + RFC 4180 CSV string.
 * The BOM (﻿) makes Excel on Spanish Windows auto-detect UTF-8
 * without requiring the Text Import Wizard.
 */
export function buildCsv(
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
): string {
  const BOM    = '﻿';
  const header = columns.map(c => escapeField(c.label)).join(',');
  const body   = rows.map(row =>
    columns.map(c => escapeField(row[c.key])).join(',')
  );
  return BOM + [header, ...body].join('\r\n');
}
```

- [ ] **Step 9: Run all tests — confirm they pass**

```bash
bun test lib/dates.test.ts lib/csv.test.ts lib/auth/session.test.ts
```

Expected:
```
12 pass
0 fail
```

- [ ] **Step 10: Commit**

```bash
git add lib/reports/ lib/dates.ts lib/csv.ts lib/dates.test.ts lib/csv.test.ts
git commit -m "feat: add report registry, date utilities, and UTF-8 BOM CSV builder with tests"
```

---

### Task 8: Report API Routes

**Files:**
- Create: `app/api/reports/[report]/export/route.ts`
- Create: `app/api/reports/[report]/preview/route.ts`

**Interfaces:**
- Consumes: `getSession` from `lib/auth/get-session.ts`; `REPORTS` from registry; `getPool()` from mssql; `buildCsv` from csv; `getPreviousMonthRange`, `parseDate` from dates
- Produces:
  - `GET /api/reports/:report/export?startDate=&endDate=&cols=` → `text/csv` download
  - `GET /api/reports/:report/preview?startDate=&endDate=&cols=` → `{ rows, totalCount }`

- [ ] **Step 1: Create `app/api/reports/[report]/export/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { buildCsv }   from '@/lib/csv';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';

function resolveColumns(config: (typeof REPORTS)[string], colsParam: string | null) {
  if (colsParam) {
    const keys = colsParam.split(',').filter(Boolean);
    return config.columns
      .filter(c => keys.includes(c.key))
      .sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  }
  return config.columns
    .filter(c => c.defaultVisible || c.alwaysVisible)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { report: reportId } = await params;
  const config = REPORTS[reportId];
  if (!config) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  // Defense-in-depth: sourceName and dateColumn come from config (not user input),
  // but we still validate they contain only safe identifier characters.
  if (!/^[\w.[\]]+$/.test(config.sourceName)) {
    return NextResponse.json({ error: 'Configuración de reporte inválida' }, { status: 500 });
  }

  const sp     = request.nextUrl.searchParams;
  const def    = getPreviousMonthRange();
  const start  = parseDate(sp.get('startDate')) ?? def.startDate;
  const end    = parseDate(sp.get('endDate'))   ?? def.endDate;
  const cols   = resolveColumns(config, sp.get('cols'));

  if (cols.length === 0) {
    return NextResponse.json(
      { error: 'Sin columnas configuradas. Actualiza la definición del reporte.' },
      { status: 422 },
    );
  }

  const pool = await getPool();
  let rows: Record<string, unknown>[];

  if (config.queryType === 'view') {
    const dc  = config.dateColumn!;
    const res = await pool.request()
      .input('startDate', sql.Date, start)
      .input('endDate',   sql.Date, end)
      .query(
        `SELECT * FROM [${config.sourceName}] ` +
        `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
      );
    rows = res.recordset;
  } else {
    const res = await pool.request()
      .input('startDate', sql.Date, start)
      .input('endDate',   sql.Date, end)
      .execute(config.sourceName);
    rows = res.recordset;
  }

  const csv      = buildCsv(cols, rows);
  const month    = start.slice(0, 7);           // "2026-06"
  const filename = `${reportId}_${month}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Create `app/api/reports/[report]/preview/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { report: reportId } = await params;
  const config = REPORTS[reportId];
  if (!config) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  const sp    = request.nextUrl.searchParams;
  const def   = getPreviousMonthRange();
  const start = parseDate(sp.get('startDate')) ?? def.startDate;
  const end   = parseDate(sp.get('endDate'))   ?? def.endDate;

  const pool = await getPool();
  let totalCount: number;
  let rows: Record<string, unknown>[];

  if (config.queryType === 'view') {
    const dc = config.dateColumn!;
    const countRes = await pool.request()
      .input('startDate', sql.Date, start)
      .input('endDate',   sql.Date, end)
      .query(
        `SELECT COUNT(*) AS total FROM [${config.sourceName}] ` +
        `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
      );
    totalCount = countRes.recordset[0].total as number;

    const dataRes = await pool.request()
      .input('startDate', sql.Date, start)
      .input('endDate',   sql.Date, end)
      .query(
        `SELECT TOP 100 * FROM [${config.sourceName}] ` +
        `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
      );
    rows = dataRes.recordset;
  } else {
    const res = await pool.request()
      .input('startDate', sql.Date, start)
      .input('endDate',   sql.Date, end)
      .execute(config.sourceName);
    rows       = res.recordset.slice(0, 100);
    totalCount = res.recordset.length;
  }

  return NextResponse.json({ rows, totalCount });
}
```

- [ ] **Step 3: Manual test — report not found**

With dev server running:
```bash
curl -s -H "Cookie: session=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@empresa.com","password":"yourpassword"}' \
  -c /tmp/cookies -b /tmp/cookies \
  && cat /tmp/cookies | grep session | awk '{print $7}')" \
  "http://localhost:3000/api/reports/nonexistent/preview"
# Expected: 404 {"error":"Reporte no encontrado"}
```

Simpler manual test: In the browser, log in at `/login`, then visit:
```
http://localhost:3000/api/reports/nonexistent/preview
```
Expected: `{"error":"Reporte no encontrado"}`

Note: The ventas/compras routes will return 422 ("Sin columnas configuradas") until column stubs are populated — this is expected.

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/
git commit -m "feat: add report export (CSV) and preview (JSON) API routes"
```

---

### Task 9: Admin Users API Routes

**Files:**
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[id]/route.ts`
- Create: `app/api/admin/users/[id]/reset-password/route.ts`

**Interfaces:**
- Consumes: `getSession` from `lib/auth/get-session.ts`; `db`, `users` from db layer; `argon2`
- Produces:
  - `GET /api/admin/users` → `User[]` (no passwordHash)
  - `POST /api/admin/users` → creates user → `{ id }`
  - `DELETE /api/admin/users/:id` → deletes user (not self)
  - `POST /api/admin/users/:id/reset-password` → updates password

- [ ] **Step 1: Create `app/api/admin/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { getSession } from '@/lib/auth/get-session';
import { db }    from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';

async function requireAdmin() {
  const session = await getSession();
  if (!session)               return { error: 'No autorizado', status: 401 } as const;
  if (session.role !== 'admin') return { error: 'Acceso denegado', status: 403 } as const;
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const list = db.select({
    id:        users.id,
    email:     users.email,
    name:      users.name,
    role:      users.role,
    createdAt: users.createdAt,
  }).from(users).all();

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.name || !body?.password || !body?.role) {
    return NextResponse.json({ error: 'Campos requeridos: email, name, password, role' }, { status: 400 });
  }
  if (!['user', 'admin'].includes(body.role as string)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  if ((body.password as string).length < 8) {
    return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 });
  }

  const email = (body.email as string).trim().toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 });

  const passwordHash = await argon2.hash(body.password as string);
  const result = db.insert(users).values({
    email,
    name:      (body.name as string).trim(),
    passwordHash,
    role:      body.role as 'user' | 'admin',
    createdAt: Date.now(),
  }).returning({ id: users.id }).get();

  return NextResponse.json({ id: result?.id }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/admin/users/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/get-session';
import { db }    from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)               return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const { id } = await params;
  const userId = parseInt(id);

  if (userId === parseInt(session.sub)) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  db.delete(users).where(eq(users.id, userId)).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `app/api/admin/users/[id]/reset-password/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { getSession } from '@/lib/auth/get-session';
import { db }    from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)               return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.newPassword || !body?.confirmPassword) {
    return NextResponse.json({ error: 'newPassword y confirmPassword requeridos' }, { status: 400 });
  }
  if (body.newPassword !== body.confirmPassword) {
    return NextResponse.json({ error: 'Las contraseñas no coinciden' }, { status: 400 });
  }
  if ((body.newPassword as string).length < 8) {
    return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  const user   = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const passwordHash = await argon2.hash(body.newPassword as string);
  db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Manual test — verify role protection**

With dev server running (as non-admin, or no session):
```bash
# No session
curl -X GET http://localhost:3000/api/admin/users
# Expected: 401 {"error":"No autorizado"}

# With admin session (login first, grab cookie)
curl -X GET http://localhost:3000/api/admin/users \
  -H "Cookie: session=<paste token here>"
# Expected: 200 [{"id":1,"email":"admin@empresa.com","name":"Ana García","role":"admin",...}]
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/
git commit -m "feat: add admin users CRUD and password reset API routes"
```

---

### Task 10: Login Page & Root Layouts

**Files:**
- Modify: `app/layout.tsx` (root layout)
- Create: `app/(auth)/login/page.tsx`

**Interfaces:**
- Produces: Working login form at `/login` that sets the session cookie and redirects to `/reports/ventas`

- [ ] **Step 1: Update `app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'ProfitPlus Exporter',
  description: 'Exportador de reportes ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `app/(auth)/login/page.tsx`**

```typescript
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push('/reports/ventas');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error de autenticación');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'ProfitPlus Exporter'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4
                       rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Test login flow**

Start `bun dev`. Navigate to `http://localhost:3000/login`.

- Enter wrong credentials → red error message appears.
- Enter correct credentials (created in Task 5) → redirected to `/reports/ventas` (placeholder page).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/'(auth)'/
git commit -m "feat: add login page with form validation and session cookie"
```

---

### Task 11: App Shell & Sidebar

**Files:**
- Create: `components/sidebar.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `getSession` from `lib/auth/get-session.ts`; `SessionPayload` type
- Produces: Persistent sidebar nav with conditional admin section; unauthenticated → redirect to `/login`

- [ ] **Step 1: Create `components/sidebar.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import type { SessionPayload } from '@/lib/auth/session';

interface Props {
  user: SessionPayload;
}

const NAV_REPORTS = [
  { href: '/reports/ventas',  label: 'Ventas'  },
  { href: '/reports/compras', label: 'Compras' },
];

export function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function navClass(href: string) {
    return `block px-3 py-2 rounded-md text-sm transition-colors ${
      pathname === href
        ? 'bg-blue-600 text-white font-medium'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;
  }

  return (
    <aside className="w-52 min-h-screen bg-gray-900 flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-sm font-bold text-white tracking-tight">
          ◆ ProfitPlus
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
        <p className="px-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Reportes
        </p>
        {NAV_REPORTS.map(({ href, label }) => (
          <Link key={href} href={href} className={navClass(href)}>
            {label}
          </Link>
        ))}

        {user.role === 'admin' && (
          <>
            <p className="px-2 mt-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin
            </p>
            <Link href="/admin/users" className={navClass('/admin/users')}>
              Usuarios
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-2 truncate">{user.name}</p>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Salir →
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Replace `app/(app)/layout.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { Sidebar }    from '@/components/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar user={session} />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Test sidebar**

With `bun dev` running:
- Log in as admin → sidebar shows "Reportes" + "Admin" sections.
- Clicking "Salir →" clears the cookie and redirects to `/login`.
- Navigating directly to `/reports/ventas` without a session redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
git add components/sidebar.tsx app/'(app)'/layout.tsx
git commit -m "feat: add app shell layout with persistent sidebar and logout"
```

---

### Task 12: DateRangePicker & ColumnManager Components

**Files:**
- Create: `components/date-range-picker.tsx`
- Create: `components/column-manager.tsx`

**Interfaces:**
- Produces:
  - `<DateRangePicker startDate endDate onStartChange onEndChange onApply loading />`
  - `<ColumnManager columns onChange />` where `columns: ColumnItem[]` and `ColumnItem = ColumnDef & { visible: boolean }`

- [ ] **Step 1: Create `components/date-range-picker.tsx`**

```typescript
'use client';

interface Props {
  startDate:     string;
  endDate:       string;
  onStartChange: (date: string) => void;
  onEndChange:   (date: string) => void;
  onApply:       () => void;
  loading:       boolean;
}

export function DateRangePicker({
  startDate, endDate, onStartChange, onEndChange, onApply, loading,
}: Props) {
  const invalid = !!startDate && !!endDate && startDate > endDate;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-gray-600">Período</span>

      <input
        type="date"
        value={startDate}
        onChange={e => onStartChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <span className="text-gray-400 text-sm">→</span>

      <input
        type="date"
        value={endDate}
        onChange={e => onEndChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        onClick={onApply}
        disabled={invalid || loading}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                   font-medium rounded-md transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Cargando…' : 'Aplicar'}
      </button>

      {invalid && (
        <span className="text-xs text-red-500">
          La fecha inicial debe ser ≤ fecha final
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/column-manager.tsx`**

```typescript
'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnDef } from '@/lib/reports/registry';

export interface ColumnItem extends ColumnDef {
  visible: boolean;
}

interface ChipProps {
  column:   ColumnItem;
  onToggle: () => void;
}

function SortableChip({ column, onToggle }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.key });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm
                  select-none transition-colors cursor-default ${
                    column.visible
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 text-xs"
        aria-label="Arrastrar para reordenar"
      >
        ⠿
      </span>

      {/* Toggle (hidden for alwaysVisible columns) */}
      {!column.alwaysVisible && (
        <button
          onClick={onToggle}
          className="w-4 h-4 flex items-center justify-center rounded-sm
                     text-xs leading-none hover:opacity-75"
          aria-label={column.visible ? `Ocultar ${column.label}` : `Mostrar ${column.label}`}
        >
          {column.visible ? '✓' : '○'}
        </button>
      )}

      <span className={column.alwaysVisible ? 'font-medium' : ''}>{column.label}</span>
    </div>
  );
}

interface Props {
  columns:  ColumnItem[];
  onChange: (columns: ColumnItem[]) => void;
}

export function ColumnManager({ columns, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = columns.findIndex(c => c.key === active.id);
      const newIdx = columns.findIndex(c => c.key === over.id);
      onChange(arrayMove(columns, oldIdx, newIdx));
    }
  }

  function handleToggle(key: string) {
    onChange(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-2">Columnas</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={columns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {columns.map(col => (
              <SortableChip
                key={col.key}
                column={col}
                onToggle={() => handleToggle(col.key)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/date-range-picker.tsx components/column-manager.tsx
git commit -m "feat: add DateRangePicker and ColumnManager UI components with dnd-kit"
```

---

### Task 13: Report Pages (Ventas & Compras)

**Files:**
- Create: `components/report-page.tsx`
- Modify: `app/(app)/reports/ventas/page.tsx`
- Create: `app/(app)/reports/compras/page.tsx`

**Interfaces:**
- Consumes: `ReportConfig`, `ColumnDef` from registry; `DateRangePicker`, `ColumnManager`, `ColumnItem`; `getPreviousMonthRange` from dates
- Produces: Full report UI — date filter, column manager, preview table, CSV export

- [ ] **Step 1: Create `components/report-page.tsx`**

```typescript
'use client';

import { useState }           from 'react';
import type { ReportConfig }  from '@/lib/reports/registry';
import type { DateRange }     from '@/lib/dates';
import { DateRangePicker }    from './date-range-picker';
import { ColumnManager, type ColumnItem } from './column-manager';

interface PreviewData {
  rows:       Record<string, unknown>[];
  totalCount: number;
}

interface Props {
  config:       ReportConfig;
  defaultDates: DateRange;
}

function initColumns(config: ReportConfig): ColumnItem[] {
  return [...config.columns]
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map(col => ({ ...col, visible: col.defaultVisible || !!col.alwaysVisible }));
}

export function ReportPage({ config, defaultDates }: Props) {
  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate,   setEndDate]   = useState(defaultDates.endDate);
  const [columns,   setColumns]   = useState<ColumnItem[]>(() => initColumns(config));
  const [preview,   setPreview]   = useState<PreviewData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const visibleColumns = columns.filter(c => c.visible);
  const colsParam      = visibleColumns.map(c => c.key).join(',');
  const hasColumns     = config.columns.length > 0;

  async function handleApply() {
    if (!hasColumns) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/reports/${config.id}/preview` +
        `?startDate=${startDate}&endDate=${endDate}&cols=${colsParam}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      setPreview(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const url = `/api/reports/${config.id}/export` +
      `?startDate=${startDate}&endDate=${endDate}&cols=${colsParam}`;
    window.location.href = url;
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{config.label}</h1>
      </div>

      {/* Controls card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-5">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={handleApply}
          loading={loading}
        />

        {hasColumns ? (
          <ColumnManager columns={columns} onChange={setColumns} />
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200
                        rounded px-3 py-2">
            Las columnas de este reporte aún no han sido configuradas.
            Edita <code className="font-mono text-xs">lib/reports/{config.id}.ts</code> para añadirlas.
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleExport}
            disabled={!hasColumns || visibleColumns.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700
                       text-white text-sm font-medium rounded-md transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↓ Exportar CSV
          </button>

          {preview && (
            <span className="text-sm text-gray-500">
              {preview.totalCount.toLocaleString('es-VE')} registros encontrados
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Preview table */}
      {preview && preview.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {visibleColumns.map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600
                                 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    {visibleColumns.map(col => (
                      <td
                        key={col.key}
                        className="px-4 py-2.5 text-gray-700 whitespace-nowrap"
                      >
                        {row[col.key] == null ? '' : String(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.totalCount > preview.rows.length && (
            <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
              Mostrando {preview.rows.length} de {preview.totalCount.toLocaleString('es-VE')} registros.
              Exporta el CSV para obtener todos.
            </p>
          )}
        </div>
      )}

      {preview && preview.rows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Sin registros para el período seleccionado.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/(app)/reports/ventas/page.tsx`**

```typescript
import { REPORTS }            from '@/lib/reports/registry';
import { getPreviousMonthRange } from '@/lib/dates';
import { ReportPage }         from '@/components/report-page';

export default function VentasPage() {
  return (
    <ReportPage
      config={REPORTS['ventas']}
      defaultDates={getPreviousMonthRange()}
    />
  );
}
```

- [ ] **Step 3: Create `app/(app)/reports/compras/page.tsx`**

```typescript
import { REPORTS }            from '@/lib/reports/registry';
import { getPreviousMonthRange } from '@/lib/dates';
import { ReportPage }         from '@/components/report-page';

export default function ComprasPage() {
  return (
    <ReportPage
      config={REPORTS['compras']}
      defaultDates={getPreviousMonthRange()}
    />
  );
}
```

- [ ] **Step 4: Test report pages**

With `bun dev` running, log in and navigate to:
- `/reports/ventas` — page loads with sidebar, date picker defaults to previous month, amber notice about empty columns.
- `/reports/compras` — same.
- "Exportar CSV" button is disabled while columns are empty — expected.
- Column stubs notice links to the correct file path.

- [ ] **Step 5: Commit**

```bash
git add components/report-page.tsx app/'(app)'/reports/
git commit -m "feat: add shared ReportPage component and ventas/compras pages"
```

---

### Task 14: Admin Users Page

**Files:**
- Create: `components/modal.tsx`
- Modify: `app/(app)/admin/users/page.tsx` (replace placeholder)
- Create: `app/(app)/admin/users/users-client.tsx`

**Interfaces:**
- Consumes: `getSession` from `lib/auth/get-session.ts`; `db`, `users` from db layer; admin API routes from Task 9
- Produces: User management table with create, reset password, and delete flows

- [ ] **Step 1: Create `components/modal.tsx`**

```typescript
'use client';

import { useEffect, type ReactNode } from 'react';

interface Props {
  title:    string;
  onClose:  () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(app)/admin/users/users-client.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Modal }    from '@/components/modal';

interface UserRow {
  id:        number;
  email:     string;
  name:      string;
  role:      'user' | 'admin';
  createdAt: number;
}

interface Props {
  initialUsers:  UserRow[];
  currentUserId: number;
}

export function UsersClient({ initialUsers, currentUserId }: Props) {
  const [userList, setUserList]       = useState<UserRow[]>(initialUsers);
  const [modal, setModal]             = useState<'create' | 'reset' | null>(null);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [formError, setFormError]     = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // ── Create user form state ──────────────────────────────────────────
  const [newEmail,    setNewEmail]    = useState('');
  const [newName,     setNewName]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole,     setNewRole]     = useState<'user' | 'admin'>('user');

  // ── Reset password form state ───────────────────────────────────────
  const [resetPwd,    setResetPwd]    = useState('');
  const [resetConfirm,setResetConfirm]= useState('');

  async function handleCreate() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      // Refresh list
      const listRes = await fetch('/api/admin/users');
      setUserList(await listRes.json());
      setModal(null);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('user');
    } catch { setFormError('Error de red'); }
    finally  { setSubmitting(false); }
  }

  async function handleResetPassword() {
    if (!selectedId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedId}/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newPassword: resetPwd, confirmPassword: resetConfirm }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setModal(null);
      setResetPwd(''); setResetConfirm('');
    } catch { setFormError('Error de red'); }
    finally  { setSubmitting(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setUserList(prev => prev.filter(u => u.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'No se pudo eliminar');
    }
  }

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <button
          onClick={() => { setModal('create'); setFormError(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-medium rounded-md transition-colors"
        >
          + Crear usuario
        </button>
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Nombre', 'Email', 'Rol', 'Creado', 'Acciones'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                       text-gray-600 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {userList.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(user.createdAt).toLocaleDateString('es-VE')}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedId(user.id);
                      setResetPwd('');
                      setResetConfirm('');
                      setFormError(null);
                      setModal('reset');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Reset contraseña
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {userList.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No hay usuarios registrados.
          </div>
        )}
      </div>

      {/* Create user modal */}
      {modal === 'create' && (
        <Modal title="Crear usuario" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
                      className={inputClass}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                                 font-medium rounded-md disabled:opacity-50">
                {submitting ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {modal === 'reset' && (
        <Modal title="Restablecer contraseña" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
                     className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <input type="password" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)}
                     className={inputClass} />
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button onClick={handleResetPassword} disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                                 font-medium rounded-md disabled:opacity-50">
                {submitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Replace `app/(app)/admin/users/page.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { db }    from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { UsersClient } from './users-client';

export default async function UsersPage() {
  const session = await getSession();
  if (!session)               redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const userList = db.select({
    id:        users.id,
    email:     users.email,
    name:      users.name,
    role:      users.role,
    createdAt: users.createdAt,
  }).from(users).all();

  return (
    <UsersClient
      initialUsers={userList as Parameters<typeof UsersClient>[0]['initialUsers']}
      currentUserId={parseInt(session.sub)}
    />
  );
}
```

- [ ] **Step 4: Test admin page**

With `bun dev` running:
- Log in as admin → navigate to `/admin/users` → user list appears.
- Click "+ Crear usuario" → modal opens, fill and submit → user appears in list.
- Click "Reset contraseña" → modal opens, set new password, log in as that user to verify.
- Click "Eliminar" on a non-self user → confirm dialog → user removed from list.
- Log in as a non-admin → navigate directly to `/admin/users` → redirected to `/reports/ventas`.

- [ ] **Step 5: Commit**

```bash
git add components/modal.tsx app/'(app)'/admin/
git commit -m "feat: add admin users page with create, reset password, and delete"
```

---

### Task 15: Documentation

**Files:**
- Create: `README.md`
- Create: `INSTRUCTIONS.md`
- Create: `AGENTS.md`

**Interfaces:**
- Produces: Complete docs for developers (README), ops team (INSTRUCTIONS), and LLM agents (AGENTS.md)

- [ ] **Step 1: Create `README.md`**

```markdown
# ProfitPlus Exporter

Internal web app for querying Profit Plus ERP (SQL Server) and exporting
custom date-filtered reports to CSV. Built because the ERP's built-in
reports are rigid and can't be easily customized.

## Tech Stack

| Layer        | Technology                                   |
|-------------|----------------------------------------------|
| Framework    | Next.js 15 (App Router), TypeScript 5        |
| Package mgr  | Bun                                          |
| Auth DB      | SQLite via Drizzle ORM + better-sqlite3      |
| ERP DB       | SQL Server via mssql                         |
| Auth         | argon2id passwords, JWT in httpOnly cookies  |
| UI           | Tailwind CSS v4, @dnd-kit/sortable           |

## Prerequisites

- Node.js 20+ (for native module compilation)
- Bun 1.x — https://bun.sh
- Access to SQL Server instance with the ERP database

## Local Setup

```bash
# 1. Clone and install
git clone <repo>
cd profitplus-exporter
bun install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local:
#  - Set JWT_SECRET to: openssl rand -hex 32
#  - Set DB_* values for your SQL Server instance

# 3. Run database migrations
bun run migrate

# 4. Create first admin user
bun run seed

# 5. Start development server
bun dev
# Open http://localhost:3000
```

## Adding a Report

1. Create `lib/reports/<name>.ts` with your `ReportConfig`.
2. Add `<name>: YOUR_CONFIG` to `REPORTS` in `lib/reports/registry.ts`.
3. Add a nav entry to `components/sidebar.tsx`.
4. Create `app/(app)/reports/<name>/page.tsx` (copy ventas page, change config key).

See `AGENTS.md` for column definition format and `lib/reports/ventas.ts` for a working example once columns are populated.

## Scripts

| Command            | Purpose                                   |
|--------------------|-------------------------------------------|
| `bun dev`          | Start development server                  |
| `bun run build`    | Build for production                      |
| `bun run start`    | Start production server (after build)     |
| `bun run seed`     | Create admin user interactively           |
| `bun run migrate`  | Apply SQLite migrations                   |
| `bun run db:generate` | Generate new Drizzle migration         |
| `bun test`         | Run unit tests                            |
```

- [ ] **Step 2: Create `INSTRUCTIONS.md`**

```markdown
# Production Deployment — Windows Server + IIS

## Architecture

```
Internet/Intranet → IIS (port 80/443)
                    └── ARR Reverse Proxy
                        └── Node.js / Bun (port 3000, managed by NSSM)
                            └── Next.js production server
```

## Prerequisites

Install on the Windows Server:

1. **Node.js 20 LTS** — https://nodejs.org (needed for native module compilation)
2. **Bun** — Run in PowerShell: `irm bun.sh/install.ps1 | iex`
3. **IIS** with:
   - **Application Request Routing (ARR)** 3.0
   - **URL Rewrite** 2.1
   Both installable via Web Platform Installer or winget.
4. **NSSM** (Non-Sucking Service Manager) — https://nssm.cc/download

## Step 1: Prepare the App

```powershell
# On the server, choose a deployment directory
$APP = "C:\inetpub\apps\profitplus-exporter"
New-Item -ItemType Directory -Path $APP

# Copy built files (from your dev machine or CI):
# - .next/
# - public/
# - package.json
# - node_modules/   (run `bun install --production` on server instead)
# - drizzle/migrations/
# - scripts/migrate.ts
# - scripts/seed.ts
# - lib/             (needed by scripts at runtime)
# - .env.local       (create on server, never commit)
```

## Step 2: Install Dependencies on Server

```powershell
cd $APP
bun install --production
```

This compiles native modules (`better-sqlite3`, `argon2`, `mssql`) for Windows.

## Step 3: Configure Environment

Create `C:\inetpub\apps\profitplus-exporter\.env.local`:

```env
DB_SERVER=<sql-server-ip>
DB_PORT=1433
DB_NAME=<db-name>
DB_USER=<readonly-user>
DB_PASSWORD=<password>
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true

# Absolute path OUTSIDE the app directory — survives redeploys
SQLITE_PATH=C:\data\profitplus-exporter\app.db

JWT_SECRET=<run: openssl rand -hex 32>
JWT_EXPIRY_DAYS=7

NEXT_PUBLIC_APP_NAME=ProfitPlus Exporter
NODE_ENV=production
```

Create the SQLite data directory:

```powershell
New-Item -ItemType Directory -Path "C:\data\profitplus-exporter"
```

## Step 4: Run Migrations & Create Admin

```powershell
cd $APP
bun run migrate
bun run seed
```

## Step 5: Build the App

```powershell
cd $APP
bun run build
```

Expected: `.next/` directory populated with production build.

## Step 6: Register as a Windows Service via NSSM

```powershell
# Download nssm.exe and place in C:\tools\nssm.exe

C:\tools\nssm.exe install ProfitPlusExporter

# In the NSSM dialog:
# Path:           C:\Users\<user>\.bun\bin\bun.exe
# Startup dir:    C:\inetpub\apps\profitplus-exporter
# Arguments:      run start
# Display name:   ProfitPlus Exporter

# Or via command line:
C:\tools\nssm.exe install ProfitPlusExporter `
  "C:\Users\Administrator\.bun\bin\bun.exe" "run start"
C:\tools\nssm.exe set ProfitPlusExporter AppDirectory $APP
C:\tools\nssm.exe set ProfitPlusExporter DisplayName "ProfitPlus Exporter"
C:\tools\nssm.exe set ProfitPlusExporter Start SERVICE_AUTO_START

# Start the service
C:\tools\nssm.exe start ProfitPlusExporter

# Verify it's running on port 3000
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

## Step 7: Configure IIS Reverse Proxy

### 7a. Enable ARR proxy

Open IIS Manager → Server node → Application Request Routing Cache → Server Proxy Settings → Check "Enable proxy" → Apply.

### 7b. Create IIS Site

```powershell
# Create a new IIS site pointing to a dummy directory
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\profitplus"
New-WebSite -Name "ProfitPlusExporter" `
  -Port 80 `
  -PhysicalPath "C:\inetpub\wwwroot\profitplus" `
  -Force
```

### 7c. Add URL Rewrite rule

Create `C:\inetpub\wwwroot\profitplus\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 7d. Verify

Open `http://<server-ip>` in a browser — you should see the ProfitPlus login page.

## Redeploy Procedure

```powershell
# 1. Stop service
C:\tools\nssm.exe stop ProfitPlusExporter

# 2. Copy new files (excluding .env.local and data/)
# 3. Install dependencies (if package.json changed)
bun install --production

# 4. Run migrations (if schema changed)
bun run migrate

# 5. Build
bun run build

# 6. Start service
C:\tools\nssm.exe start ProfitPlusExporter
```

## Service Management

```powershell
C:\tools\nssm.exe status ProfitPlusExporter  # Check status
C:\tools\nssm.exe restart ProfitPlusExporter  # Restart
C:\tools\nssm.exe edit ProfitPlusExporter     # Edit config
```
```

- [ ] **Step 3: Create `AGENTS.md`**

```markdown
# AGENTS.md — Context for LLM Coding Assistants

This file describes the architecture, conventions, and extension patterns
for the ProfitPlus Exporter. Read this before making any changes.

## System Architecture

Two databases, one Next.js 15 App Router app:

| Database   | Purpose              | Driver              | Location          |
|-----------|----------------------|---------------------|-------------------|
| SQLite    | User accounts / auth | Drizzle + better-sqlite3 | `data/app.db`    |
| SQL Server| ERP report data      | mssql singleton pool | Profit Plus server|

Sessions are **stateless JWTs** in `httpOnly` cookies — no session table.

## Directory Map

```
lib/
  auth/session.ts       — signToken(), verifyToken() — pure, Edge-safe
  auth/get-session.ts   — getSession() — uses next/headers, Server only
  db/schema.ts          — Drizzle users table
  db/sqlite.ts          — Drizzle client singleton
  db/mssql.ts           — mssql pool singleton: getPool()
  reports/registry.ts   — ColumnDef, ReportConfig, REPORTS map
  reports/ventas.ts     — Ventas report config
  reports/compras.ts    — Compras report config
  dates.ts              — getPreviousMonthRange(), parseDate()
  csv.ts                — buildCsv() with UTF-8 BOM

middleware.ts           — Edge Runtime JWT guard (no next/headers here!)
```

## Critical Constraint: Edge Runtime in middleware.ts

`middleware.ts` runs in Next.js Edge Runtime. You MUST NOT import:
- `next/headers`
- `better-sqlite3`
- `mssql`
- `argon2`
- Any Node.js built-ins that aren't Edge-compatible

Only `jose` and `lib/auth/session.ts` are safe to import there.

## Database Quirk: Spanish Collation

The SQL Server ERP uses `Modern_Spanish_CI_AS` collation. This means:
- String comparisons are **case-insensitive** by default
- Characters like Á, É, Ñ, Ü are sorted correctly for Spanish
- The `BETWEEN` operator on date columns works as expected
- Column aliases in views may use Spanish characters — the `label` field in
  `ColumnDef` should match the intended display name, not the SQL alias

The CSV builder (`lib/csv.ts`) prepends a UTF-8 BOM (`﻿`) so Excel
on Spanish Windows auto-detects the encoding without the Import Wizard.

## Adding a New Report

1. Create `lib/reports/<name>.ts`:
   ```typescript
   import type { ReportConfig } from './registry';
   export const NAME_CONFIG: ReportConfig = {
     id:         '<name>',
     label:      'Display Name',
     queryType:  'view',        // or 'procedure'
     sourceName: 'v_view_name', // SQL view or SP name
     dateColumn: 'fecha',       // column used in WHERE clause (views only)
     columns: [
       { key: 'col_alias', label: 'Spanish Label', defaultVisible: true, defaultOrder: 0 },
       // alwaysVisible: true — column cannot be toggled off
     ],
   };
   ```

2. Add to `lib/reports/registry.ts`:
   ```typescript
   import { NAME_CONFIG } from './name';
   export const REPORTS = { ..., name: NAME_CONFIG };
   ```

3. Add nav link in `components/sidebar.tsx` (NAV_REPORTS array).

4. Create page: `app/(app)/reports/<name>/page.tsx` (copy from ventas).

No changes needed to API routes — they use `REPORTS[reportId]` dynamically.

## Auth Flow Summary

```
POST /api/auth/login
  → argon2.verify(hash, password)
  → signToken({ sub, role, name })
  → Set-Cookie: session=<jwt>; HttpOnly

middleware.ts (every request except /login, /api/auth/*)
  → verifyToken(cookie)
  → fail → redirect /login or 401 JSON

Admin-only API routes
  → getSession() → check role === 'admin' → 403 if not

Admin page (Server Component)
  → getSession() → role !== 'admin' → redirect('/reports/ventas')
```

## Code Conventions

- **No date library** — use `lib/dates.ts` for all date math
- **Drizzle queries are synchronous** — no `await` needed; `argon2` and `jose` are async
- **mssql queries use `.input()` for ALL user-controlled values** — never concatenate
- **CSV encoding** — always use `buildCsv()` from `lib/csv.ts`; never construct CSV manually
- **Error responses** — always `{ error: string }` shape with appropriate HTTP status
- **Admin check** — call `getSession()` and check `role === 'admin'` in every admin route handler independently (don't rely solely on middleware)

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable              | Used by                          |
|-----------------------|----------------------------------|
| `SQLITE_PATH`         | `lib/db/sqlite.ts`               |
| `JWT_SECRET`          | `lib/auth/session.ts`            |
| `DB_SERVER` + `DB_*`  | `lib/db/mssql.ts`                |
| `NODE_ENV`            | Cookie `secure` flag, dev guards |
```

- [ ] **Step 4: Run all tests one final time**

```bash
bun test
```

Expected:
```
12 pass
0 fail
```

- [ ] **Step 5: Final commit**

```bash
git add README.md INSTRUCTIONS.md AGENTS.md
git commit -m "docs: add README, deployment instructions, and AGENTS context file"
```

---

## Self-Review Against Spec

| Spec Requirement | Task(s) |
|---|---|
| Next.js 15 App Router + TypeScript | Task 1 |
| Bun as package manager and runtime | Task 1 (scripts, install commands) |
| `mssql` with connection pooling | Task 6 + 8 |
| Parameterized queries, no injection | Task 8 (`.input()` for all date params) |
| Own auth (not ERP credentials) | Tasks 3–5, 9–10 |
| argon2 password hashing | Tasks 4, 5, 9 |
| JWT in httpOnly cookie | Tasks 3–4 |
| SQLite for user accounts | Tasks 2, 5, 9 |
| Admin panel (users, reset, create, delete) | Tasks 9, 14 |
| Admin password reset (admin sets directly) | Task 9 + 14 |
| `bun run seed` createsuperuser | Task 5 |
| Report registry (extensible) | Task 7 |
| Default date = previous calendar month | Task 7 (`getPreviousMonthRange`) |
| Column toggle + drag reorder | Task 12 (`ColumnManager`) |
| UTF-8 BOM CSV for Spanish chars | Task 7 (`buildCsv`) |
| Sidebar nav | Task 11 |
| Ventas + Compras report pages | Task 13 |
| Preview table (first 100 rows + count) | Task 8 |
| `.env.example` | Task 1 |
| `README.md` | Task 15 |
| `INSTRUCTIONS.md` (IIS + NSSM) | Task 15 |
| `AGENTS.md` (LLM context) | Task 15 |
| `serverExternalPackages` for native modules | Task 1 |
| Admin URL protection (server-side role check) | Task 14 (page.tsx redirect) |
| Non-admin cannot see admin nav | Task 11 (sidebar conditional) |
| `cols` param defaults to defaultVisible | Task 8 (`resolveColumns`) |
| SQLITE_PATH note for production | Task 1 (.env.example) |

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

1. **Node.js 22 LTS** — https://nodejs.org (needed for native module compilation)
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

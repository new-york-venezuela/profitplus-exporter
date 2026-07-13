# MSSQL Mock ERP Setup

This guide covers setting up and running the MSSQL Server container for the ProfitPlus Mock ERP system. The container includes a fully initialized database with tables for purchases (compras) and sales (ventas), along with stored procedures for common queries.

## Quick Start

### 1. Start the Container

Navigate to the docker directory and start the container using Docker Compose:

```bash
cd docker
docker-compose up -d
```

This command will:
- Pull the MSSQL Server 2019 image (if not already present)
- Create and start the `profitplus-erp-mock` container
- Mount persistent volumes for data storage
- Set up networking for container communication

### 2. Initialize the Database

After the container starts, run the initialization script to create the database schema and load sample data:

```bash
bash init-db.sh
```

This script will:
- Wait for SQL Server to be ready
- Create the `ProfitPlus` database with proper collation
- Create the `compras` and `ventas` tables
- Create indexes and stored procedures
- Populate sample data

### 3. Verify Container is Ready

Check the container logs to confirm successful startup:

```bash
docker-compose logs -f mssql
```

Wait for the message indicating that the MSSQL Server is now accepting connections. Once you see "SQL Server is now ready for client connections", the container is ready.

Verify the container status:

```bash
docker-compose ps
```

All services should show `Up`. Container should be running.

### 4. Run Test Queries

Once the container is ready, execute a test query using `sqlcmd`:

```bash
sqlcmd -S localhost,1433 -U sa -P "YourStr0ngP@ssw0rd" -d ProfitPlus -Q "SELECT COUNT(*) AS total_compras FROM dbo.compras;" -C
```

The `-C` flag is required to trust the container's self-signed SSL certificate.

**Note for macOS users:** If you don't have `sqlcmd` installed, install it using Homebrew:

```bash
brew install mssql-tools
```

Alternatively, you can use the `sqlcmd` binary from inside the container:

```bash
docker exec profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd" -d ProfitPlus -Q "SELECT COUNT(*) AS total_compras FROM dbo.compras;" -C
```

**SSL Certificate Error?**

If you encounter `SSL Provider: [error:0A000086:SSL routines::certificate verify failed]`, ensure you're using the `-C` flag (trust self-signed certificates) or add `TrustServerCertificate=true` to your connection string in application code:

```
Server=localhost,1433;Database=ProfitPlus;User Id=sa;Password=YourStr0ngP@ssw0rd;TrustServerCertificate=true;
```

## Connection Details

| Property | Value |
|----------|-------|
| **Host** | localhost |
| **Port** | 1433 |
| **Username** | sa |
| **Password** | YourStr0ngP@ssw0rd |
| **Database** | ProfitPlus |
| **Collation** | Modern_Spanish_CI_AS |

## Schema Overview

### Tables

The ProfitPlus database contains two main transaction tables:

#### 1. **dbo.compras** (Purchases)
Stores all purchase transactions.

**Columns:**
- `id` (INT, PK, IDENTITY) - Unique purchase identifier
- `fecha` (DATE) - Purchase date
- `numero_comprobante` (NVARCHAR(50)) - Purchase voucher number
- `tipo_comprobante` (NVARCHAR(50)) - Type of purchase document (e.g., Invoice, Credit Note)
- `ruc_proveedor` (NVARCHAR(50)) - Supplier's RUC (tax ID)
- `nombre_proveedor` (NVARCHAR(255)) - Supplier name
- `monto_total` (DECIMAL(15,2)) - Total amount (including tax)
- `monto_impuesto` (DECIMAL(15,2)) - Tax amount
- `monto_neto` (DECIMAL(15,2)) - Net amount (excluding tax)
- `descripcion` (NVARCHAR(MAX)) - Additional notes or description
- `created_at` (DATETIME) - Record creation timestamp (UTC)

**Indexes:**
- `idx_compras_fecha` on `fecha` column for performance optimization

#### 2. **dbo.ventas** (Sales)
Stores all sales transactions.

**Columns:**
- `id` (INT, PK, IDENTITY) - Unique sales identifier
- `fecha` (DATE) - Sales date
- `numero_comprobante` (NVARCHAR(50)) - Sales voucher number
- `tipo_comprobante` (NVARCHAR(50)) - Type of sales document (e.g., Invoice, Credit Note)
- `ruc_cliente` (NVARCHAR(50)) - Customer's RUC (tax ID)
- `nombre_cliente` (NVARCHAR(255)) - Customer name
- `monto_total` (DECIMAL(15,2)) - Total amount (including tax)
- `monto_impuesto` (DECIMAL(15,2)) - Tax amount
- `monto_neto` (DECIMAL(15,2)) - Net amount (excluding tax)
- `descripcion` (NVARCHAR(MAX)) - Additional notes or description
- `created_at` (DATETIME) - Record creation timestamp (UTC)

**Indexes:**
- `idx_ventas_fecha` on `fecha` column for performance optimization

### Stored Procedures

#### sp_GetComprasByDateRange
Retrieves purchase records within a specified date range.

**Parameters:**
- `@startDate` (DATE) - Start of date range (inclusive)
- `@endDate` (DATE) - End of date range (inclusive)

**Example Usage:**
```sql
EXECUTE dbo.sp_GetComprasByDateRange '2024-01-01', '2024-12-31';
```

**Query Output:**
Returns all columns from the compras table, sorted by fecha (descending) and numero_comprobante.

#### sp_GetVentasByDateRange
Retrieves sales records within a specified date range.

**Parameters:**
- `@startDate` (DATE) - Start of date range (inclusive)
- `@endDate` (DATE) - End of date range (inclusive)

**Example Usage:**
```sql
EXECUTE dbo.sp_GetVentasByDateRange '2024-01-01', '2024-12-31';
```

**Query Output:**
Returns all columns from the ventas table, sorted by fecha (descending) and numero_comprobante.

## Important Notes

### 1. Separate Rows for Credit Notes (N/CR)
Credit notes create new rows in the tables rather than negating existing entries. A purchase with negative amounts represents a credit note. When processing reports, filter and handle N/CR type documents appropriately:

```sql
SELECT * FROM dbo.compras WHERE tipo_comprobante = 'N/CR' AND fecha BETWEEN @start AND @end;
```

### 2. Date Ranges
All date columns use the DATE datatype (stores date without time). The stored procedures use BETWEEN logic, which is inclusive on both ends. When querying specific dates, ensure your parameters match the DATE format (YYYY-MM-DD).

### 3. Spanish Collation
The database uses the `Modern_Spanish_CI_AS` collation (Case Insensitive, Accent Sensitive). This collation correctly handles Spanish language sorting and comparison, particularly for characters like ñ, á, é, etc. String comparisons are case-insensitive but accent-sensitive.

## Development Workflow

### Step 1: Initialize the Environment
Start the container and verify connectivity:
```bash
cd docker
docker-compose up -d
docker-compose logs mssql  # Wait for "ready for client connections"
```

### Step 2: Explore the Schema
Connect to the database and examine the tables:
```bash
docker exec -it profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd" -d ProfitPlus
```

### Step 3: Load or Modify Test Data
Edit the `mssql/data.sql` file to add sample data, then restart the container:
```bash
docker-compose down
docker-compose up -d
```

### Step 4: Run Queries During Development
Execute queries either via the container or local sqlcmd:
```bash
docker exec profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd" -d ProfitPlus -Q "SELECT TOP 10 * FROM dbo.compras;"
```

### Step 5: Integrate with Application
Use the connection string in your application:
```
Server=localhost,1433;Database=ProfitPlus;User Id=sa;Password=YourStr0ngP@ssw0rd;
```

## Troubleshooting

### Container Won't Start

**Issue:** Docker Compose reports an error or container exits immediately.

**Solutions:**
1. Check if port 1433 is already in use:
   ```bash
   lsof -i :1433
   ```
   If another service is using the port, either stop it or modify the port mapping in `docker-compose.yml`.

2. Verify the Docker image is available:
   ```bash
   docker pull mcr.microsoft.com/mssql/server:2019-latest
   ```

3. Check Docker logs for detailed error messages:
   ```bash
   docker-compose logs mssql
   ```

4. Ensure you have sufficient disk space and memory allocated to Docker (MSSQL requires at least 2GB RAM).

### Can't Connect to Database

**Issue:** sqlcmd or application fails to connect with authentication errors or timeout.

**Solutions:**
1. Verify the container is running:
   ```bash
   docker-compose ps
   ```

2. Wait for the healthcheck to pass (status should show as healthy):
   ```bash
   docker-compose ps
   ```

3. Test connectivity from inside the container:
   ```bash
   docker exec profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd" -Q "SELECT 1"
   ```

4. Check that you're using the correct credentials (default is `sa` / `YourStr0ngP@ssw0rd`).

5. Ensure your firewall is not blocking port 1433, or connect via the container:
   ```bash
   docker exec -it profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd"
   ```

### Need to Reset Data

**Issue:** You want to clear all data and restart with a fresh database.

**Solutions:**
1. Stop and remove the container (data persists in the volume):
   ```bash
   docker-compose down
   ```

2. Remove the persistent volume to completely reset:
   ```bash
   docker-compose down -v
   ```

3. Restart the container (this will reinitialize with schema and seed data):
   ```bash
   docker-compose up -d
   ```

4. If you only want to clear specific tables, connect and delete:
   ```bash
   docker exec profitplus-erp-mock /opt/mssql-tools/bin/sqlcmd -U sa -P "YourStr0ngP@ssw0rd" -d ProfitPlus -Q "TRUNCATE TABLE dbo.compras; TRUNCATE TABLE dbo.ventas;"
   ```

---

**Next Step:** Proceed to Task 7 to integrate this mock ERP with the application layer and execute end-to-end testing.

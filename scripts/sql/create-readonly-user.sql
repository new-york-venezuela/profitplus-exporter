/*
  Creates a read-only SQL Server login for safe use against production.

  Run ONCE per server, as a sysadmin (sa or similar), with sqlcmd:

    sqlcmd -S <host>,1433 -U <admin> -P <admin_password> -C -b -i scripts/sql/create-readonly-user.sql ^
      -v RO_LOGIN="exporter_ro" RO_PASSWORD="<long random password>" ERP_DB="<DB_NAME>" DWH_DB="DWH_AlimentosNY"

  (use \ instead of ^ on macOS/Linux; -C trusts the server certificate, -b stops on error)

  What the login can do, in each of the two databases:
    - SELECT on every table and view (db_datareader)
  What it cannot do:
    - INSERT / UPDATE / DELETE (db_denydatawriter)
    - EXECUTE any stored procedure, which blocks every pApi* write proc
      (DENY EXECUTE on schema dbo). The scripts that write to the ERP
      (mapping:apply, credit-terms:apply, pricing:*-import --apply, tipo-cliente:apply)
      therefore fail with a permission error instead of writing.
    - DDL: ALTER / CREATE / DROP anything
  It has no server-level permissions beyond `public`.

  Reports configured as queryType 'procedure' (lib/reports/*) need EXECUTE on that
  specific proc. Grant it by name, never on the schema:
    GRANT EXECUTE ON OBJECT::dbo.<proc_name> TO [exporter_ro];
  Do that only for procs that read.

  Re-runnable: every statement checks for existence first. Re-running with a new
  RO_PASSWORD rotates the password.
*/
:on error exit
SET NOCOUNT ON;
GO

-- 1. Server login ---------------------------------------------------------
USE [master];
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(RO_LOGIN)')
BEGIN
  CREATE LOGIN [$(RO_LOGIN)]
    WITH PASSWORD = N'$(RO_PASSWORD)',
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF,
         DEFAULT_DATABASE = [$(ERP_DB)];
  PRINT 'Login created: $(RO_LOGIN)';
END
ELSE
BEGIN
  ALTER LOGIN [$(RO_LOGIN)] WITH PASSWORD = N'$(RO_PASSWORD)', CHECK_POLICY = ON;
  PRINT 'Login existed: password rotated';
END
GO

-- 2. ERP database -----------------------------------------------------------
USE [$(ERP_DB)];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(RO_LOGIN)')
  CREATE USER [$(RO_LOGIN)] FOR LOGIN [$(RO_LOGIN)] WITH DEFAULT_SCHEMA = [dbo];
ALTER ROLE db_datareader   ADD MEMBER [$(RO_LOGIN)];
ALTER ROLE db_denydatawriter ADD MEMBER [$(RO_LOGIN)];
DENY EXECUTE ON SCHEMA::dbo TO [$(RO_LOGIN)];
DENY ALTER, CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE FUNCTION TO [$(RO_LOGIN)];
PRINT 'ERP database configured: $(ERP_DB)';
GO

-- 3. DWH database -----------------------------------------------------------
USE [$(DWH_DB)];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(RO_LOGIN)')
  CREATE USER [$(RO_LOGIN)] FOR LOGIN [$(RO_LOGIN)] WITH DEFAULT_SCHEMA = [dbo];
ALTER ROLE db_datareader   ADD MEMBER [$(RO_LOGIN)];
ALTER ROLE db_denydatawriter ADD MEMBER [$(RO_LOGIN)];
-- The DWH has dim/fact/stg/dwh schemas; DENY on each so Load_*/Snapshot_* procs cannot run.
DENY EXECUTE ON SCHEMA::dbo TO [$(RO_LOGIN)];
DENY EXECUTE ON SCHEMA::dim TO [$(RO_LOGIN)];
DENY EXECUTE ON SCHEMA::fact TO [$(RO_LOGIN)];
DENY EXECUTE ON SCHEMA::stg TO [$(RO_LOGIN)];
DENY ALTER, CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE FUNCTION TO [$(RO_LOGIN)];
PRINT 'DWH database configured: $(DWH_DB)';
GO

-- 4. Self-check: must show SELECT allowed, every write refused ----------------
USE [$(ERP_DB)];
GO
SELECT
  HAS_PERMS_BY_NAME(N'$(ERP_DB).dbo.saCliente', 'OBJECT', 'SELECT') AS admin_can_select, -- 1 for the admin running this
  IS_ROLEMEMBER('db_datareader',     N'$(RO_LOGIN)') AS ro_in_datareader,      -- 1
  IS_ROLEMEMBER('db_denydatawriter', N'$(RO_LOGIN)') AS ro_in_denydatawriter;  -- 1
GO
EXECUTE AS USER = N'$(RO_LOGIN)';
  SELECT TOP 1 co_cli FROM dbo.saCliente;                                       -- must succeed
  SELECT HAS_PERMS_BY_NAME(N'dbo.saCliente', 'OBJECT', 'UPDATE')  AS can_update,   -- must be 0
         HAS_PERMS_BY_NAME(N'dbo.saCliente', 'OBJECT', 'DELETE')  AS can_delete,   -- must be 0
         HAS_PERMS_BY_NAME(N'dbo.pApiActualizarTipoCliente', 'OBJECT', 'EXECUTE') AS can_exec_write_proc; -- must be 0
REVERT;
GO

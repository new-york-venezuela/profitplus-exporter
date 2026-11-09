/*
  Creates ONE read-only SQL Server login for safe use against production, with a user in
  the ERP database and in the DWH database.

  Plain T-SQL, no sqlcmd directives, so it runs in DBeaver, SSMS or sqlcmd.
  DBeaver: open an SQL editor on the SERVER (any database), edit the values below, then run
  the WHOLE script with "Execute script" (Alt+X), not Ctrl+Enter.

  Step 1 (@apply = 0, default): lists every statement it would run. Changes nothing.
  Step 2 (@apply = 1): creates the login and users, runs the statements, then checks the result.

  In BOTH databases the login can:
    - SELECT on every table and view (db_datareader)
  and cannot:
    - INSERT / UPDATE / DELETE (db_denydatawriter)
    - ALTER / CREATE anything (DENY at database level)
    - EXECUTE stored procedures, with two reads allowed in the ERP:
        dbo.RepLibroVenta and dbo.RepLibroCompra (the Ventas / Compras report procedures the app calls).
      Every other ERP procedure is denied by name (pApi*, pInsertar*, pActualizar*, ... all the write procs),
      and EXECUTE is denied on the whole schema in the DWH (dwh.Load_* / Snapshot_* procs live there).

  The login has no server-level permissions beyond `public`.
  Note: DENY always wins over GRANT in SQL Server, so a procedure that is denied here stays denied even if
  someone later grants it to a role. To allow another READ-ONLY procedure, REVOKE its DENY first, then grant:
    REVOKE EXECUTE ON OBJECT::dbo.<proc> FROM [login];  GRANT EXECUTE ON OBJECT::dbo.<proc> TO [login];

  Re-runnable: existing login/users are reused and the password is rotated. A procedure created in the ERP
  after this ran is NOT denied automatically (it has no EXECUTE grant either, so it is still blocked) - re-run to
  add the explicit DENY.
*/
DECLARE @erp_db      sysname       = N'Ncake_a';
DECLARE @dwh_db      sysname       = N'DWH_AlimentosNY';
DECLARE @ro_login    sysname       = N'exporter_ro';
DECLARE @ro_password nvarchar(128) = N'CHANGE_ME_long_random_password';
DECLARE @apply       bit           = 0;

SET NOCOUNT ON;

IF DB_ID(@erp_db) IS NULL OR DB_ID(@dwh_db) IS NULL
  THROW 50000, 'erp_db or dwh_db does not exist on this server', 1;
IF @apply = 1 AND @ro_password = N'CHANGE_ME_long_random_password'
  THROW 50000, 'Set @ro_password before applying', 1;

-- EXEC() only accepts literals and variables, so quote everything up front
DECLARE @q_user nvarchar(300) = QUOTENAME(@ro_login);
DECLARE @lit_user nvarchar(300) = QUOTENAME(@ro_login, '''');
DECLARE @lit_pwd nvarchar(300) = QUOTENAME(@ro_password, '''');

IF OBJECT_ID('tempdb..#stmts') IS NOT NULL DROP TABLE #stmts;
CREATE TABLE #stmts (id int IDENTITY PRIMARY KEY, db sysname, sql nvarchar(max));

-- per-database statements ----------------------------------------------------
DECLARE @dbs TABLE (db sysname, kind varchar(3));
INSERT @dbs VALUES (@erp_db, 'erp'), (@dwh_db, 'dwh');

DECLARE @db sysname, @kind varchar(3);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT db, kind FROM @dbs;
OPEN c;
FETCH NEXT FROM c INTO @db, @kind;
WHILE @@FETCH_STATUS = 0
BEGIN
  INSERT #stmts (db, sql) VALUES
    (@db, N'IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ' + @lit_user + N') CREATE USER ' + @q_user + N' FOR LOGIN ' + @q_user + N' WITH DEFAULT_SCHEMA = [dbo]'),
    (@db, N'ALTER ROLE db_datareader ADD MEMBER ' + @q_user),
    (@db, N'ALTER ROLE db_denydatawriter ADD MEMBER ' + @q_user),
    (@db, N'DENY ALTER, CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE FUNCTION TO ' + @q_user);

  IF @kind = 'erp'
  BEGIN
    -- deny every stored procedure except the report procedures (Rep*), by name
    DECLARE @collect nvarchar(max) = N'USE ' + QUOTENAME(@db) + N';
      INSERT #stmts (db, sql)
      SELECT @db, N''DENY EXECUTE ON OBJECT::'' + QUOTENAME(SCHEMA_NAME(schema_id)) + N''.'' + QUOTENAME(name) + N'' TO '' + QUOTENAME(@u)
      FROM sys.procedures WHERE is_ms_shipped = 0 AND name NOT LIKE ''Rep%'' ORDER BY name;';
    EXEC sp_executesql @collect, N'@db sysname, @u sysname', @db, @ro_login;

    INSERT #stmts (db, sql) VALUES
      (@db, N'IF OBJECT_ID(N''dbo.RepLibroVenta'') IS NOT NULL GRANT EXECUTE ON OBJECT::dbo.RepLibroVenta TO ' + @q_user),
      (@db, N'IF OBJECT_ID(N''dbo.RepLibroCompra'') IS NOT NULL GRANT EXECUTE ON OBJECT::dbo.RepLibroCompra TO ' + @q_user);
  END
  ELSE
  BEGIN
    -- DWH: no procedure may run (Load_* / Snapshot_* live in schema dwh)
    INSERT #stmts (db, sql)
    SELECT @db, N'IF SCHEMA_ID(N''' + s + N''') IS NOT NULL DENY EXECUTE ON SCHEMA::' + QUOTENAME(s) + N' TO ' + @q_user
    FROM (VALUES (N'dbo'), (N'dim'), (N'dwh'), (N'fact'), (N'stg')) v(s);
  END

  FETCH NEXT FROM c INTO @db, @kind;
END
CLOSE c; DEALLOCATE c;

-- Review: what will be run
SELECT id, db, sql AS statement FROM #stmts ORDER BY id;

IF @apply = 0
BEGIN
  SELECT 'Dry run: nothing changed. Set @ro_password and @apply = 1, then run again to create ' + @ro_login AS result;
  RETURN;
END

-- login (server level) --------------------------------------------------------
DECLARE @ddl nvarchar(max);
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @ro_login)
  SET @ddl = N'CREATE LOGIN ' + @q_user + N' WITH PASSWORD = ' + @lit_pwd
           + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = ' + QUOTENAME(@erp_db);
ELSE
  SET @ddl = N'ALTER LOGIN ' + @q_user + N' WITH PASSWORD = ' + @lit_pwd + N', CHECK_POLICY = ON';
EXEC (@ddl);

-- users and permissions, in id order --------------------------------------------
DECLARE @s nvarchar(max), @sdb sysname;
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR SELECT db, sql FROM #stmts ORDER BY id;
OPEN c2;
FETCH NEXT FROM c2 INTO @sdb, @s;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @ddl = N'USE ' + QUOTENAME(@sdb) + N'; ' + @s;
  EXEC (@ddl);
  FETCH NEXT FROM c2 INTO @sdb, @s;
END
CLOSE c2; DEALLOCATE c2;

-- self-check: SELECT allowed, every write and procedure refused ------------------
DECLARE @check nvarchar(max) = N'USE ' + QUOTENAME(@erp_db) + N';
  EXECUTE AS USER = @u;
    SELECT DB_NAME() AS db,
           HAS_PERMS_BY_NAME(N''dbo.saCliente'', ''OBJECT'', ''SELECT'')  AS can_select,        -- must be 1
           HAS_PERMS_BY_NAME(N''dbo.saCliente'', ''OBJECT'', ''UPDATE'')  AS can_update,        -- must be 0
           HAS_PERMS_BY_NAME(N''dbo.saCliente'', ''OBJECT'', ''DELETE'')  AS can_delete,        -- must be 0
           HAS_PERMS_BY_NAME(N''dbo.pApiActualizarTipoCliente'', ''OBJECT'', ''EXECUTE'') AS can_exec_write_proc, -- must be 0
           HAS_PERMS_BY_NAME(N''dbo.RepLibroVenta'', ''OBJECT'', ''EXECUTE'') AS can_exec_report;  -- 1 if the proc exists
  REVERT;';
EXEC sp_executesql @check, N'@u sysname', @ro_login;

SET @check = N'USE ' + QUOTENAME(@dwh_db) + N';
  EXECUTE AS USER = @u;
    SELECT DB_NAME() AS db,
           HAS_PERMS_BY_NAME(N''dim.Dim_Customer'', ''OBJECT'', ''SELECT'') AS can_select,   -- must be 1
           HAS_PERMS_BY_NAME(N''dim.Dim_Customer'', ''OBJECT'', ''UPDATE'') AS can_update,   -- must be 0
           HAS_PERMS_BY_NAME(N''dwh'', ''SCHEMA'', ''EXECUTE'')            AS can_exec_dwh_procs; -- must be 0
  REVERT;';
EXEC sp_executesql @check, N'@u sysname', @ro_login;

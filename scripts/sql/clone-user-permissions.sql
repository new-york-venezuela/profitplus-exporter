/*
  Creates a login + user in one database whose permissions are a copy of an existing
  user's permissions in another database (e.g. exporter_user in ncake_a -> new login in ncake_flux).

  Plain T-SQL, no sqlcmd directives, so it runs in DBeaver, SSMS or sqlcmd.
  DBeaver: open an SQL editor on the SERVER (any database), edit the six values below,
  then run the WHOLE script with "Execute script" (Alt+X), not Ctrl+Enter.

  Step 1 (@apply = 0, default): lists the statements it would run. Changes nothing.
  Step 2 (@apply = 1): creates the login/user in @dst_db and runs the statements.

  Copies: role memberships, and explicit GRANT / DENY / GRANT WITH GRANT OPTION on the
  database, schemas, objects and columns. Roles, schemas or objects missing in @dst_db
  are skipped and listed as SKIPPED.
  Does not copy: server-level permissions of the source login, or other securable classes
  (listed as SKIPPED unsupported class). The login only gets a user in @dst_db.
  Re-runnable: an existing login/user is reused (password rotated); grants are idempotent.
*/
DECLARE @src_db       sysname       = N'ncake_a';
DECLARE @src_user     sysname       = N'exporter_user';
DECLARE @dst_db       sysname       = N'ncake_flux';
DECLARE @new_login    sysname       = N'exporter_flux';
DECLARE @new_password nvarchar(128) = N'CHANGE_ME_long_random_password';
DECLARE @apply        bit           = 0;

SET NOCOUNT ON;

IF DB_ID(@src_db) IS NULL OR DB_ID(@dst_db) IS NULL
  THROW 50000, 'src_db or dst_db does not exist on this server', 1;
IF @src_db = @dst_db
  THROW 50000, 'src_db and dst_db must differ', 1;
IF @apply = 1 AND @new_password = N'CHANGE_ME_long_random_password'
  THROW 50000, 'Set @new_password before applying', 1;

IF OBJECT_ID('tempdb..#stmts') IS NOT NULL DROP TABLE #stmts;
CREATE TABLE #stmts (id int IDENTITY PRIMARY KEY, kind varchar(10), sql nvarchar(max));

-- Statements are generated from the source database's catalog.
DECLARE @collect nvarchar(max) = N'USE ' + QUOTENAME(@src_db) + N';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = @src_user)
  THROW 50000, ''src_user not found in src_db'', 1;

INSERT #stmts (kind, sql)
SELECT ''role'',
  N''IF DATABASE_PRINCIPAL_ID(N'''''' + r.name + N'''''') IS NOT NULL ALTER ROLE '' + QUOTENAME(r.name)
  + N'' ADD MEMBER '' + QUOTENAME(@new) + N'' ELSE PRINT ''''SKIPPED role missing: '' + r.name + N''''''''
FROM sys.database_role_members m
JOIN sys.database_principals r ON r.principal_id = m.role_principal_id
JOIN sys.database_principals u ON u.principal_id = m.member_principal_id
WHERE u.name = @src_user;

INSERT #stmts (kind, sql)
SELECT ''perm'',
  CASE
    WHEN p.class = 0 THEN
      x.verb + N'' '' + p.permission_name + N'' TO '' + QUOTENAME(@new) + x.wgo
    WHEN p.class = 3 THEN
      N''IF SCHEMA_ID(N'''''' + SCHEMA_NAME(p.major_id) + N'''''') IS NOT NULL '' + x.verb + N'' '' + p.permission_name
      + N'' ON SCHEMA::'' + QUOTENAME(SCHEMA_NAME(p.major_id)) + N'' TO '' + QUOTENAME(@new) + x.wgo
      + N'' ELSE PRINT ''''SKIPPED schema missing: '' + SCHEMA_NAME(p.major_id) + N''''''''
    WHEN p.class = 1 THEN
      N''IF OBJECT_ID(N'''''' + QUOTENAME(OBJECT_SCHEMA_NAME(p.major_id)) + N''.'' + QUOTENAME(OBJECT_NAME(p.major_id)) + N'''''') IS NOT NULL ''
      + x.verb + N'' '' + p.permission_name
      + CASE WHEN p.minor_id > 0 THEN N'' ('' + QUOTENAME(COL_NAME(p.major_id, p.minor_id)) + N'')'' ELSE N'''' END
      + N'' ON OBJECT::'' + QUOTENAME(OBJECT_SCHEMA_NAME(p.major_id)) + N''.'' + QUOTENAME(OBJECT_NAME(p.major_id))
      + N'' TO '' + QUOTENAME(@new) + x.wgo
      + N'' ELSE PRINT ''''SKIPPED object missing: '' + OBJECT_SCHEMA_NAME(p.major_id) + N''.'' + OBJECT_NAME(p.major_id) + N''''''''
  END
FROM sys.database_permissions p
JOIN sys.database_principals u ON u.principal_id = p.grantee_principal_id
CROSS APPLY (SELECT
    CASE WHEN p.state_desc LIKE ''GRANT%'' THEN N''GRANT'' ELSE N''DENY'' END AS verb,
    CASE WHEN p.state_desc = ''GRANT_WITH_GRANT_OPTION'' THEN N'' WITH GRANT OPTION'' ELSE N'''' END AS wgo) x
WHERE u.name = @src_user AND p.class IN (0, 1, 3);

INSERT #stmts (kind, sql)
SELECT ''skipped'', N''PRINT ''''SKIPPED unsupported class '' + p.class_desc + N'': '' + p.permission_name + N''''''''
FROM sys.database_permissions p
JOIN sys.database_principals u ON u.principal_id = p.grantee_principal_id
WHERE u.name = @src_user AND p.class NOT IN (0, 1, 3);';

EXEC sp_executesql @collect, N'@src_user sysname, @new sysname', @src_user, @new_login;

-- Review: what will be run in the destination database
SELECT id, kind, sql AS statement_for_destination FROM #stmts ORDER BY id;

IF @apply = 0
BEGIN
  SELECT 'Dry run: nothing changed. Set @apply = 1 and run again to create the login.' AS result;
  RETURN;
END

-- EXEC() accepts only literals and variables, so quote everything up front
DECLARE @q_dst  nvarchar(300) = QUOTENAME(@dst_db);
DECLARE @q_new  nvarchar(300) = QUOTENAME(@new_login);
DECLARE @lit_new nvarchar(300) = QUOTENAME(@new_login, '''');
DECLARE @lit_pwd nvarchar(300) = QUOTENAME(@new_password, '''');
DECLARE @ddl nvarchar(max);

-- Login (server level), user and grants (destination database only)
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @new_login)
  SET @ddl = N'CREATE LOGIN ' + @q_new + N' WITH PASSWORD = ' + @lit_pwd
           + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = ' + @q_dst;
ELSE
  SET @ddl = N'ALTER LOGIN ' + @q_new + N' WITH PASSWORD = ' + @lit_pwd + N', CHECK_POLICY = ON';
EXEC (@ddl);

SET @ddl = N'USE ' + @q_dst + N';
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ' + @lit_new + N')
    CREATE USER ' + @q_new + N' FOR LOGIN ' + @q_new + N' WITH DEFAULT_SCHEMA = [dbo];';
EXEC (@ddl);

DECLARE @s nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT sql FROM #stmts ORDER BY id;
OPEN c;
FETCH NEXT FROM c INTO @s;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @ddl = N'USE ' + @q_dst + N'; ' + @s;
  EXEC (@ddl);
  FETCH NEXT FROM c INTO @s;
END
CLOSE c; DEALLOCATE c;

-- Verification: effective permissions and roles of the new user in the destination database
DECLARE @verify nvarchar(max) = N'USE ' + @q_dst + N';
  SELECT p.class_desc, p.permission_name, p.state_desc,
         CASE p.class WHEN 1 THEN OBJECT_SCHEMA_NAME(p.major_id) + N''.'' + OBJECT_NAME(p.major_id)
                      WHEN 3 THEN SCHEMA_NAME(p.major_id) END AS target
  FROM sys.database_permissions p
  JOIN sys.database_principals u ON u.principal_id = p.grantee_principal_id
  WHERE u.name = @new ORDER BY p.class, target, p.permission_name;
  SELECT r.name AS member_of_role FROM sys.database_role_members m
  JOIN sys.database_principals r ON r.principal_id = m.role_principal_id
  JOIN sys.database_principals u ON u.principal_id = m.member_principal_id
  WHERE u.name = @new;';
EXEC sp_executesql @verify, N'@new sysname', @new_login;

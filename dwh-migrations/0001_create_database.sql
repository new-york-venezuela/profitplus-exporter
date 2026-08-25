IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'DWH_AlimentosNY')
BEGIN
    CREATE DATABASE DWH_AlimentosNY;
END

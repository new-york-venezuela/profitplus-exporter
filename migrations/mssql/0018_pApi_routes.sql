-- migrations/mssql/0018_pApi_routes.sql
-- Procs used by `bun run mapping:apply` for customer routes and visit frequency.
-- A route is a saZona row coded CCSnnn (nnn = route number from the tracking workbook). The code
-- is char(6) because saZona.co_zon / saCliente.co_zon are; legacy zones (CCS, 001.., CCS-11) are
-- never touched. Visit frequency lives in saCliente.frecu_vist (varchar(60), free in the ERP) and is
-- constrained here to SEMANAL / QUINCENAL / MENSUAL (extend with a new CREATE OR ALTER).
-- saCliente.tip_cli, co_seg and co_ven are NOT written by these procs.

CREATE OR ALTER PROCEDURE [pApiInsertarZona]
    ( @sCoZon CHAR(6), @sZonDes VARCHAR(60), @sCoUsIn CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoZon);
        -- Case-sensitive on purpose: the database collation is case-insensitive.
        IF @sTrim COLLATE Latin1_General_BIN NOT LIKE 'CCS[0-9][0-9][0-9]'
            RAISERROR('Codigo de ruta %s invalido (se espera CCSnnn)', 16, 1, @sTrim);
        -- Idempotent: an existing zone is left exactly as it is.
        IF EXISTS (SELECT 1 FROM saZona WHERE co_zon = @sCoZon) RETURN;
        INSERT INTO saZona (co_zon, zon_des, co_us_in, fe_us_in, co_us_mo, fe_us_mo, rowguid)
        VALUES (@sCoZon, @sZonDes, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), NEWID());
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarRutaCliente]
    ( @sCoCli CHAR(16), @sCoZon CHAR(6), @sFrecuVist VARCHAR(60), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sCoZonTrim VARCHAR(6)  = RTRIM(@sCoZon);
        DECLARE @sFrec VARCHAR(60) = UPPER(LTRIM(RTRIM(@sFrecuVist)));

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);
        IF NOT EXISTS (SELECT 1 FROM saZona WHERE co_zon = @sCoZon)
            RAISERROR('Zona %s no encontrada', 16, 1, @sCoZonTrim);
        IF @sFrec IS NULL OR @sFrec NOT IN ('SEMANAL', 'QUINCENAL', 'MENSUAL')
            RAISERROR('Frecuencia %s invalida (SEMANAL, QUINCENAL o MENSUAL)', 16, 1, @sFrec);

        UPDATE saCliente
        SET co_zon = @sCoZon, frecu_vist = @sFrec, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
        WHERE co_cli = @sCoCli;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

-- Rollback only (same pattern as pApiRestaurarVendedorCliente in 0017): the previous frecu_vist may be
-- NULL or free text, which pApiActualizarRutaCliente refuses.
CREATE OR ALTER PROCEDURE [pApiRestaurarRutaCliente]
    ( @sCoCli CHAR(16), @sCoZon CHAR(6), @sFrecuVist VARCHAR(60) = NULL, @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sCoZonTrim VARCHAR(6)  = RTRIM(@sCoZon);

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);
        IF NOT EXISTS (SELECT 1 FROM saZona WHERE co_zon = @sCoZon)
            RAISERROR('Zona %s no encontrada', 16, 1, @sCoZonTrim);

        UPDATE saCliente
        SET co_zon = @sCoZon, frecu_vist = @sFrecuVist, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
        WHERE co_cli = @sCoCli;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

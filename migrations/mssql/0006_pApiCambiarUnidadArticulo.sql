IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCambiarUnidadArticulo')
    DROP PROCEDURE pApiCambiarUnidadArticulo;
GO

CREATE PROCEDURE [pApiCambiarUnidadArticulo]
    (
      @sCoArt      CHAR(30),
      @sCoUniNueva CHAR(6),
      @sCoUsIn     CHAR(6),
      @sCoSucuIn   CHAR(6) = NULL
    )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @dtNow SMALLDATETIME = GETDATE();
    BEGIN TRY
        BEGIN TRAN;

        -- Verify article exists and is not annulled
        IF NOT EXISTS (SELECT 1 FROM saArticulo WHERE co_art = @sCoArt AND anulado = 0)
        BEGIN
            RAISERROR('Artículo %s no encontrado o anulado', 16, 1, @sCoArt);
        END

        -- Verify new unit exists
        IF NOT EXISTS (SELECT 1 FROM saUnidad WHERE co_uni = @sCoUniNueva)
        BEGIN
            RAISERROR('Unidad %s no existe', 16, 1, @sCoUniNueva);
        END

        -- Set current principal unit to 0
        UPDATE saArtUnidad
        SET uni_principal = 0
        WHERE co_art = @sCoArt AND uni_principal = 1;

        -- Check if new unit already exists for this article
        IF EXISTS (SELECT 1 FROM saArtUnidad WHERE co_art = @sCoArt AND co_uni = @sCoUniNueva)
        BEGIN
            -- Unit exists; set it as principal
            UPDATE saArtUnidad
            SET uni_principal = 1
            WHERE co_art = @sCoArt AND co_uni = @sCoUniNueva;
        END
        ELSE
        BEGIN
            -- Unit doesn't exist for this article; insert as principal
            EXEC pInsertarUnidadArticuloRenglon
                @sCo_Art = @sCoArt, @sCo_Uni = @sCoUniNueva, @iReng_Num = 1,
                @bRelacion = 0, @deEquivalencia = 1,
                @bUso_Venta = 1, @bUso_Compra = 1,
                @bUni_Principal = 1, @bUso_Principal = 0,
                @bUni_Secundaria = 0, @bUso_Secundaria = 0,
                @bUso_NumDecimales = 0, @iNum_Decimales = 0,
                @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
                @sRevisado = 'N', @sTrasnfe = 'N';
        END

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

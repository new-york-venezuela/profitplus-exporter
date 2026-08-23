IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCrearAjusteInventario')
    DROP PROCEDURE pApiCrearAjusteInventario;
GO

IF EXISTS (SELECT 1 FROM sys.types WHERE name = 'AjusteInventarioLineaType')
    DROP TYPE AjusteInventarioLineaType;
GO

CREATE TYPE AjusteInventarioLineaType AS TABLE (
    co_tipo            CHAR(6)         NOT NULL,
    co_art             CHAR(30)        NOT NULL,
    co_alma            CHAR(6)         NOT NULL,
    co_uni             CHAR(6)         NOT NULL,
    total_art          DECIMAL(18,5)   NOT NULL,
    cost_unit          DECIMAL(18,5)   NULL,
    permitir_negativo  BIT             NOT NULL
);
GO

CREATE PROCEDURE [pApiCrearAjusteInventario]
    (
      @sMotivo VARCHAR(80),
      @dtFecha SMALLDATETIME,
      @sCoUsIn CHAR(6),
      @sCoSucuIn CHAR(6),
      @Lineas AjusteInventarioLineaType READONLY,
      @sAjueNumOut CHAR(20) OUTPUT
    )
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        EXEC pConsecutivoProximoOutPut
            @sCo_Sucur = @sCoSucuIn,
            @sCo_Consecutivo = 'AJUS_NUM',
            @strConsecutivoResult = @sAjueNumOut OUTPUT;

        EXEC pInsertarAjusteEntradaSalida
            @sAjue_Num = @sAjueNumOut, @sCo_Mone = 'BS    ', @sMotivo = @sMotivo,
            @sdFecha = @dtFecha, @deTasa = 1, @bAnulado = 0,
            @deAux01 = 0, @sAux02 = '', @sCo_Us_In = @sCoUsIn,
            @sCo_Sucu_In = @sCoSucuIn;

        DECLARE @RengNum INT = 1;
        DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
            SELECT co_tipo, co_art, co_alma, co_uni, total_art, cost_unit, permitir_negativo
            FROM @Lineas;

        DECLARE @co_tipo CHAR(6), @co_art CHAR(30), @co_alma CHAR(6),
                @co_uni CHAR(6), @total_art DECIMAL(18,5),
                @cost_unit DECIMAL(18,5), @permitir_negativo BIT;

        OPEN cur;
        FETCH NEXT FROM cur INTO @co_tipo, @co_art, @co_alma, @co_uni,
            @total_art, @cost_unit, @permitir_negativo;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF @cost_unit IS NULL
                SELECT TOP 1 @cost_unit = CHE.costo
                FROM saCostoHistoricoEntrada CHE
                JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
                WHERE A.co_art = @co_art
                ORDER BY CHE.fecha_emision DESC;

            SET @cost_unit = ISNULL(@cost_unit, 0);

            EXEC pInsertarRenglonesAjusteEntradaSalida
                @sAjue_Num = @sAjueNumOut, @iReng_Num = @RengNum,
                @sCo_Tipo = @co_tipo, @sCo_Art = @co_art, @sCo_Alma = @co_alma,
                @sCo_Uni = @co_uni, @sSco_Uni = @co_uni,
                @deTotal_Art = @total_art, @deStotal_Art = @total_art,
                @deCost_Unit = @cost_unit, @deCosto_Adi1 = @cost_unit,
                @deCosto_Adi2 = 0, @deCosto_Adi3 = 0,
                @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn;

            DECLARE @bSumar BIT;
            SELECT @bSumar = CASE WHEN tipo_trans = '0' THEN 1 ELSE 0 END
            FROM saTipoAjuste WHERE co_tipo = @co_tipo;

            EXEC pStockActualizar
                @sCo_Alma = @co_alma, @sCo_Art = @co_art, @sCo_Uni = @co_uni,
                @deCantidad = @total_art, @sTipoStock = 'ACT',
                @bSumarStock = @bSumar, @bPermiteStockNegativo = @permitir_negativo;

            SET @RengNum += 1;
            FETCH NEXT FROM cur INTO @co_tipo, @co_art, @co_alma, @co_uni,
                @total_art, @cost_unit, @permitir_negativo;
        END
        CLOSE cur;
        DEALLOCATE cur;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0
            ROLLBACK TRAN;

        IF CURSOR_STATUS('local', 'cur') >= 0
        BEGIN
            CLOSE cur;
            DEALLOCATE cur;
        END

        RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg);
        RETURN;
    END CATCH
END
GO

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCrearArticuloInventario')
    DROP PROCEDURE pApiCrearArticuloInventario;
GO

CREATE PROCEDURE [pApiCrearArticuloInventario]
    (
      @sCoArt      CHAR(30),
      @sArtDes     VARCHAR(120),
      @sTipo       CHAR(1),
      @sCoLin      CHAR(6),
      @sCoSubl     CHAR(6),
      @sCoCat      CHAR(6),
      @sCoUni      CHAR(6),
      @sCoUsIn     CHAR(6),
      @sCoSucuIn   CHAR(6) = NULL
    )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @dtNow SMALLDATETIME = GETDATE();
    BEGIN TRY
        BEGIN TRAN;

        IF EXISTS (SELECT 1 FROM saArticulo WHERE co_art = @sCoArt)
        BEGIN
            RAISERROR('El código de artículo %s ya existe', 16, 1, @sCoArt);
        END

        EXEC pInsertarArticulo
            @sCo_Art = @sCoArt, @sdFecha_Reg = @dtNow, @sArt_Des = @sArtDes,
            @sTipo = @sTipo, @bAnulado = 0,
            @sCo_Lin = @sCoLin, @sCo_Subl = @sCoSubl, @sCo_Cat = @sCoCat,
            @sCo_Color = 'GEN', @sCo_Ubicacion = '00001',
            @bGenerico = 0, @bManeja_Serial = 0, @bManeja_Lote = 0, @bManeja_Lote_Venc = 0,
            @deMargen_Min = 0, @deMargen_Max = 0,
            @sTipo_Imp = '1', @sTipo_Imp2 = '1', @sTipo_Imp3 = '1',
            @sCod_Proc = NULL,
            @sGarantia = '', @deVolumen = 0, @dePeso = 0,
            @deStock_Min = 0, @deStock_Max = 0, @deStock_Pedido = 0,
            @iRelac_Unidad = 0,
            @dePunt_Ven = 0, @dePunt_Cli = 0,
            @deLic_Mon_Ilc = 0, @deLic_Capacidad = 0, @deLic_Grado_Al = 0,
            @bPrec_Om = 1, @sTipo_Cos = '1',
            @dePorc_Margen_Minimo = 0, @dePorc_Margen_Maximo = 0,
            @deMont_Comi = 0, @dePorc_Arancel = 0,
            @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
            @sRevisado = 'N', @sTrasnfe = 'N';

        EXEC pInsertarUnidadArticuloRenglon
            @sCo_Art = @sCoArt, @sCo_Uni = @sCoUni, @iReng_Num = 1,
            @bRelacion = 0, @deEquivalencia = 1,
            @bUso_Venta = 1, @bUso_Compra = 1,
            @bUni_Principal = 1, @bUso_Principal = 1,
            @bUni_Secundaria = 0, @bUso_Secundaria = 0,
            @bUso_NumDecimales = 0, @iNum_Decimales = 0,
            @sCo_Us_In = @sCoUsIn, @sCo_Sucu_In = @sCoSucuIn,
            @sRevisado = 'N', @sTrasnfe = 'N';

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        IF @@TRANCOUNT > 0 AND XACT_STATE() <> 0
            ROLLBACK TRAN;

        RAISERROR('%s', @ErrSeverity, @ErrState, @ErrMsg);
        RETURN;
    END CATCH
END
GO

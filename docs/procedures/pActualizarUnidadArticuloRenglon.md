# SP: pActualizarUnidadArticuloRenglon
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	[pActualizarUnidadArticuloRenglon]
-- DESCRIPCION	:	Actualiza los registro en la tabla  saArtUnidad
-- CREADO POR	:	SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarUnidadArticuloRenglon]
    (
      @sCo_Art CHAR(30) ,
      @sCo_ArtOri CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @sCo_UniOri CHAR(6) ,
      @iReng_Num INT , --No existe en la tabla, solo lo recibo
      @iReng_NumOri INT , --No existe en la tabla, solo lo recibo
      @bRelacion BIT ,
      @deEquivalencia DECIMAL(18, 5) ,
      @bUso_Venta BIT ,
      @bUso_Compra BIT ,
      @bUni_Principal BIT ,
      @bUso_Principal BIT ,
      @bUni_Secundaria BIT ,
      @bUso_Secundaria BIT ,
	  @bUso_NumDecimales BIT,
	  @iNum_Decimales INT,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN
		IF @iNum_Decimales IS NULL 
		BEGIN SET @iNum_Decimales = 0 END

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saArtUnidad
        SET co_art = @sCo_Art, co_uni = @sCo_Uni, relacion = @bRelacion, equivalencia = @deEquivalencia,
            uso_venta = @bUso_Venta, uso_compra = @bUso_Compra, uni_principal = @bUni_Principal,
            uso_principal = @bUso_Principal, uni_secundaria = @bUni_Secundaria, uso_secundaria = @bUso_Secundaria,
			uso_numDecimales = @bUso_NumDecimales, num_decimales = @iNum_Decimales,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_uni = @sCo_UniOri		
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidO
```

# SP: pInsertarUnidadArticuloRenglon
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarUnidadArticuloRenglon
*DESCRIPCIÓN	: Inserta Unidad por Articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarUnidadArticuloRenglon]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @iReng_Num INT ,
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
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN
		IF @iNum_Decimales IS NULL 
		BEGIN SET @iNum_Decimales = 0 END

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saArtUnidad
                ( co_art, co_uni, relacion, equivalencia, uso_venta, uso_compra, uni_principal, uso_principal,
                  uni_secundaria, uso_secundaria, uso_numDecimales, num_decimales, co_us_in, co_sucu_in, fe_us_in, co_us_mo, 
				  co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Art, @sCo_Uni, @bRelacion, @deEquivalencia, @bUso_Venta, @bUso_Compra, @bUni_Principal, @bUso_Principal,
                  @bUni_Secundaria, @bUso_Secundaria, @bUso_NumDecimales, @iNum_Decimales, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @sCamp VARCHAR(MAX)

        SET @sCamp = @sCo_Art + ',' + @sCo_Uni

        SELECT
            @dtFe_In = fe_us_in, @rowGu
```

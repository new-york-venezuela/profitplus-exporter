# SP: pInsertarFactVentaExtLotes
**Tipo**: Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)
- [`stgFacturaVentaExt`](../tables/stgFacturaVentaExt.md)

## Código (excerpt)
```sql
/****** Object:  StoredProcedure [dbo].[pInsertarFactVentaExtLotes]    Script Date: 18-02-2015 11:05:58 a.m. ******/

/************************************************************************
*NOMBRE			: [pInsertarFactVentaExtLotes]
*DESCRIPCIÓN	: Inserta un pInsertarFactVentaExtLotes
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarFactVentaExtLotes]
    (
      @sco_fact_lote_gen char(6)  ,
	  @sFactNum			CHAR (20),
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
      @sRevisado CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )


        DECLARE @rowGuidFact UNIQUEIDENTIFIER
		DECLARE @rowGuidFactLoteGen UNIQUEIDENTIFIER
	  
		SELECT @rowGuidFactLoteGen = rowguid FROM stgFactLoteGen WHERE co_fact_lote_gen = @sco_fact_lote_gen
		SELECT @rowGuidFact = rowguid FROM safacturaventa WHERE doc_num = @sFactNum


		INSERT  INTO stgFacturaVentaExt
                ( rowguid_doc_num, rowguid_num_FactLoteGen, campo1, campo2, campo3, campo4, campo5, 
					campo6, campo7, campo8,co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                (@rowGuidFact,  @rowGuidFactLoteGen, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), 
				  @sRevisado, @sCo_Sucu_In, @sCo_Sucu_In )


        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'sgtFactLoteGen', @rowguidOri = @rowGuidOri,
```

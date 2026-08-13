# SP: pInsertarFacturaVentaInfoTercero
**Tipo**: Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaInfoTercero`](../tables/saFacturaVentaInfoTercero.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08/03/2025>
-- Description:	<pInsertarFacturaVentaInfoTercero>
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarFacturaVentaInfoTercero]
    (
      @sdoc_num  CHAR(20) ,
      @sCod_Tercero CHAR(16),
	  @sCo_Us_Mo CHAR(6) ,
	  @sCo_Sucu_Mo CHAR(6) = NULL,
	  @sMaquina VARCHAR(60) = NULL 
    )
AS 
    BEGIN

	DECLARE @TableTimestampdFACT TABLE
    (
      validador VARBINARY(MAX) ,
      fe_us_in DATETIME ,
      fe_us_mo DATETIME ,
      rowguidFACT UNIQUEIDENTIFIER
    )

     DECLARE @rowGuidOri UNIQUEIDENTIFIER
	 DECLARE @dtFe_In DATETIME

        SELECT @rowGuidOri = rowguid
          FROM saFacturaVenta
         where doc_num = @sdoc_num

        INSERT INTO saFacturaVentaInfoTercero
           (rowguid ,co_tercero)
        VALUES
           (@rowGuidOri ,@sCod_Tercero)

		UPDATE saFacturaVenta 
		   SET fe_us_mo = GETDATE(),
		   	co_us_mo =	@sCo_Us_Mo,
		   	co_sucu_mo=	@sCo_Sucu_Mo,
			ven_ter = 1
		    OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
		      INTO @TableTimestampdFACT
             WHERE doc_num	=	@sdoc_num
        
		UPDATE saDocumentoVenta
		   SET fe_us_mo = GETDATE(),
		   	co_us_mo =	@sCo_Us_Mo,
		   	co_sucu_mo=	@sCo_Sucu_Mo,
			ven_ter = 1
          WHERE co_tipo_doc = 'FACT' and nro_doc	=	@sdoc_num

		SELECT  @dtFe_In = fe_us_in FROM  @TableTimestampdFACT

		DECLARE @sPistaMensaje VARCHAR(MAX)
		SET @sPistaMensaje =  ltrim(rtrim(@sdoc_num)) +' [TipoDoc:FACT]'  +'Insertar datos Tercero'

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saFacturaVentaInfoTercero', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sPistaMensaje
		
        SELECT * FROM  @TableTimestampdFACT
		
    END
```

# SP: pActualizarFacturaVentaInfoTercero
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaInfoTercero`](../tables/saFacturaVentaInfoTercero.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarDocumentoVentaInfoIGTF]
*DESCRIPCIÓN	: 
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pActualizarFacturaVentaInfoTercero]
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
	 DECLARE @bVen_Ter bit = 1

        SELECT @rowGuidOri = rowguid
          FROM saFacturaVenta
         where doc_num = @sdoc_num

		if (rtrim(ltrim(@sCod_Tercero))='')
		begin
			delete from saFacturaVentaInfoTercero  where rowguid = @rowGuidOri
			set @bVen_Ter=0
		end
		else
		begin
			update saFacturaVentaInfoTercero
			   set co_tercero = @sCod_Tercero
			 where rowguid = @rowGuidOri
		end

		 UPDATE saFacturaVenta 
		   SET fe_us_mo = GETDATE(),
		   	co_us_mo =	@sCo_Us_Mo,
		   	co_sucu_mo=	@sCo_Sucu_Mo,
			ven_ter =@bVen_Ter
		    OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
		      INTO @TableTimestampdFACT
             WHERE doc_num	= @sdoc_num

        UPDATE saDocumentoVenta
		   SET fe_us_mo = GETDATE(),
		   	co_us_mo =	@sCo_Us_Mo,
		   	co_sucu_mo=	@sCo_Sucu_Mo,
			ven_ter = @bVen_Ter
          WHERE co_tipo_doc = 'FACT' and nro_doc=@sdoc_num

        SELECT  @dtFe_In = fe_us_in FROM  @TableTimestampdFACT
		DECLARE @sPistaMensaje VARCHAR(MAX)
		SET @sPistaMensaje =  ltrim(rtrim(@sdoc_num)) +' [TipoDoc:FACT]'  +'Actualizacion datos Tercero'

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saFacturaVentaInfoTercero', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sPistaMensaje 
		
       SELECT * FROM  @TableTimestampdFACT
		
    END
```

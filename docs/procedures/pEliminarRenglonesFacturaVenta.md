# SP: pEliminarRenglonesFacturaVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesFacturaVenta
DESCRIPCION	: Elimina un registro de la tabla saFacturaVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesFacturaVenta]
    (
      @sDoc_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
	
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE  FROM saFacturaVentaReng
        OUTPUT  deleted.rowguid
                INTO @TableTimestamp
        WHERE   doc_num = @sDoc_NumOri
                AND reng_num = @iReng_NumOri	

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		
        SELECT  @dtFe_De = GETDATE() ,
                @rowGuidOri = rowguid
        FROM    @TableTimestamp

	--Eliminar Historico de Costos
        EXEC [dbo].[pCostoEliminarSalida] @RowGuid_Doc_Orig = @rowGuidOri,
            @strTipo_doc = 'FACT'
            
        EXEC [dbo].[pEliminarRenglonLoteSalida] @gRowguid_Reng = @rowGuidOri,
            @sTipo_doc = N'FACT', @sTablaOri = N'saFacturaVentaReng', @sCo_Us_Mo = @sCo_Us_Mo,
            @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_Sucu_Mo

        IF @dtFe_De IS NOT NULL 
            BEGIN
			DECLARE @sCampos varchar(max)
		   set @sCampos  = ltrim(rtrim(@sDoc_NumOri)) +' [TipoDoc:FACT]' + ' [RengNum:'+ltrim(rtrim(@iReng_NumOri))+']'
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo,
                    @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saFacturaVentaReng',
                    @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCampos--@sDoc_NumOri
            END

    END
```

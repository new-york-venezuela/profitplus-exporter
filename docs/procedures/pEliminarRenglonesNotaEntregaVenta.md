# SP: pEliminarRenglonesNotaEntregaVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesNotaEntregaVenta
DESCRIPCION	: Elimina un registro de la tabla saNotaEntregaVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesNotaEntregaVenta]
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

        DELETE FROM
            saNotaEntregaVentaReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
            AND reng_num = @iReng_NumOri	
		
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
	--Eliminar Historico de Costos
        EXEC [dbo].[pCostoEliminarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'NENT'
        
           EXEC [dbo].[pEliminarRenglonLoteSalida] @gRowguid_Reng = @rowGuidOri,
            @sTipo_doc = N'NENT', @sTablaOri = N'saNotaEntregaVentaReng', @sCo_Us_Mo = @sCo_Us_Mo,
            @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_Sucu_Mo

        IF @dtFe_De IS NOT NULL 
            BEGIN
			 DECLARE @sCampos varchar(max)
		     set @sCampos  = ltrim(rtrim(@sDoc_NumOri)) +' [TipoDoc:NENT]' +  + ' [RengNum:'+ltrim(rtrim(@iReng_NumOri))+']'

		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saNotaEntregaVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCampos--@sDoc_NumOri
            END

    END
```

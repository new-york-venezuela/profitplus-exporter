# SP: pEliminarRenglonesDevolucionCliente
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesDevolucionVenta
DESCRIPCION	: Elimina un registro de la tabla saDevolucionVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesDevolucionCliente]
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
            saDevolucionClienteReng
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
	
        EXEC [pCostoEliminarEntrada] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'DCLI'
	    EXEC [dbo].[pEliminarRenglonLoteEntrada] @gRowguid_Reng = @rowGuidOri,
        @sTipo_doc = N'DCLI', @sTablaOri = N'saDevolucionClienteReng', @sCo_Us_Mo = @sCo_Us_Mo,
        @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_Sucu_Mo
        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDevolucionClienteReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sDoc_NumOri
            END

    END
```

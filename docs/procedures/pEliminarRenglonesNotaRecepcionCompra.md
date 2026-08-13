# SP: pEliminarRenglonesNotaRecepcionCompra
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarRenglonesNotaRecepcionCompra
*DESCRIPCIÓN	:	Elimina un renglon de factura de compra
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS E.
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesNotaRecepcionCompra]
    (
      @iReng_NumOri INT ,
      @sDoc_NumOri CHAR(20) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            saNotaRecepcionCompraReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            reng_num = @iReng_NumOri
            AND doc_num = @sDoc_NumOri

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
        EXEC [pCostoEliminarEntrada] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'NREC'
        EXEC [dbo].[pEliminarRenglonLoteEntrada] @gRowguid_Reng = @rowGuidOri,
        @sTipo_doc = N'NREC', @sTablaOri = N'saNotaRecepcionCompraReng', @sCo_Us_Mo = @sCo_Us_Mo,
        @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_Sucu_Mo
        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saNotaRecepcionCompraReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sDoc_NumOri
            END
    END
```

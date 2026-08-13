# SP: pEliminarFacturaCompra
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarFacturaCompra
*DESCRIPCIÓN	:	Elimina una factura de compra segun su primary key
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarFacturaCompra]
    (
      @sDoc_NumOri CHAR(20) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @tsvalidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
	
	--ELIMINAR COSTOS HISTORICOS DE RENGLONES
        DECLARE @RengNum INT

        DECLARE Renglones_Cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                ACGR.[reng_num]
            FROM
                saFacturaCompraReng AS ACGR
            WHERE
                ACGR.doc_num = @sDoc_NumOri
            ORDER BY
                reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesFacturaCompra] @sDoc_NumOri = @sDoc_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor INTO @RengNum
            END	
        CLOSE Renglones_Cursor
        DEALLOCATE Renglones_Cursor	
	-- FIN ELIMINAR COSTOS
		
        DELETE FROM
            saFacturaCompra
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
            AND validador = @tsValidador	

	--Elimnar Seriales de Entrada del documento
        EXEC [dbo].[pEliminarSerialesEntradaDocumento] @sTipo_Doc = N'COMP', @gRowguid = @gRowguid
	
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
            
		--Eliminar Imagen
			IF @dtFe_De IS NOT NULL AND EXISTS (SELECT rowguidDoc from saDocumentoImagen where rowguidDoc = @rowGuidOri)
			BEGIN
				DECLARE @Co_ima CHAR(6)
				DECLARE @Validador_ima TIMESTAMP
				DECLARE @rowguid_ima UNIQUEIDENTIFIER
				DECLARE contador
```

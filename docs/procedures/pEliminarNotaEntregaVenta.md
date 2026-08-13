# SP: pEliminarNotaEntregaVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarNotaEntregaVenta
*DESCRIPCIÓN	: Elimina una Nota de Enrega
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarNotaEntregaVenta]
    (
      @sDoc_NumOri CHAR(20) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

	--ELIMINAR COSTOS HISTORICOS DE RENGLONES
        DECLARE @RengNum INT

        DECLARE Renglones_Cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                ACGR.[reng_num]
            FROM
                saNotaEntregaVentaReng AS ACGR
            WHERE
                ACGR.doc_num = @sDoc_NumOri
            ORDER BY
                reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesNotaEntregaVenta] @sDoc_NumOri = @sDoc_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor INTO @RengNum
            END	
        CLOSE Renglones_Cursor
        DEALLOCATE Renglones_Cursor	
	-- FIN ELIMINAR COSTOS
	
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
	
        DELETE FROM
            saNotaEntregaVenta
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
            AND validador = @tsValidador	

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
            
	--Eliminar Imagen de Nota de Entrega
		IF @dtFe_De IS NOT NULL AND EXISTS (SELECT rowguidDoc from saDocumentoImagen where rowguidDoc = @rowGuidOri)
			BEGIN
				DECLARE @Co_ima CHAR(6)
				DECLARE @Validador_ima TIMESTAMP
				DECLARE @rowguid_ima UNIQUEIDENTIFIER
				DECLARE contador CURSOR LOCAL FORWARD_ONLY
				FOR
					SELECT
						DI.[co_imag], DI.[validador], DI.[rowguid]
					FROM
						saDocumentoImagen AS DI						
					WHERE
						DI.row
```

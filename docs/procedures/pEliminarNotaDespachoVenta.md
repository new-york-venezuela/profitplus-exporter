# SP: pEliminarNotaDespachoVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarNotaDespachoVenta
*DESCRIPCIÓN	: Elimina una Factura de venta
*AUTOR			: SOFTECH SISTEMAS 
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarNotaDespachoVenta]
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
                NDVR.[reng_num]
            FROM
                saNotaDespachoVentaReng AS NDVR
				INNER JOIN saNotaDespachoVenta AS NDV ON NDV.doc_num = NDVR.doc_num
            WHERE
                NDVR.doc_num = @sDoc_NumOri
				AND NDV.validador = @tsValidador
            ORDER BY
                NDVR.reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesNotaDespachoVenta] @sDoc_NumOri = @sDoc_NumOri, @iReng_NumOri = @RengNum,
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
            saNotaDespachoVenta
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
            AND validador = @tsValidador	


        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
			
		--Elimnar Seriales de Salida del documento
        IF EXISTS ( SELECT
                        seriales_despacho
                    FROM
                        par_emp
                    WHERE
                        seriales_despacho = 1 ) 
            EXEC [dbo].[pEliminarSerialesSalidaDocumento] @sTipo_Doc = N'NDES', @gRowguid = @gRowguid

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @Table
```

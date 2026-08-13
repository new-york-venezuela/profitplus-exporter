# SP: pEliminarFacturaVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarFacturaVenta
*DESCRIPCIÓN	: Elimina una Factura de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarFacturaVenta]
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

        DECLARE @Id UNIQUEIDENTIFIER


	--ELIMINAR COSTOS HISTORICOS DE RENGLONES
        DECLARE @RengNum INT

        DECLARE Renglones_Cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                FVR.[reng_num]
            FROM
                saFacturaVentaReng AS FVR
				INNER JOIN saFacturaVenta AS FV ON FV.doc_num = FVR.doc_num
            WHERE
                FVR.doc_num = @sDoc_NumOri
				AND FV.validador = @tsValidador
            ORDER BY
                FVR.reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesFacturaVenta] @sDoc_NumOri = @sDoc_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor INTO @RengNum
            END	
        CLOSE Renglones_Cursor
        DEALLOCATE Renglones_Cursor	
	-- FIN ELIMINAR COSTOS
		
	--Elimnar Seriales de Salida del documento
        IF EXISTS ( SELECT
                        seriales_despacho
                    FROM
                        par_emp
                    WHERE
                        seriales_despacho = 0 ) 
            EXEC [dbo].[pEliminarSerialesSalidaDocumento] @sTipo_Doc = N'FACT', @gRowguid = @gRowguid
	

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
	
        DELETE FROM
            saFacturaVenta
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
            @Table
```

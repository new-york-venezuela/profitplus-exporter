# SP: pEliminarAjusteEntradaSalida
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarAjuste
*DESCRIPCIÓN : Elimina un ajuste
*AUTOR : SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarAjusteEntradaSalida]
    (
      @sAjue_NumOri CHAR(20) ,
      @tsValidador TIMESTAMP = NULL ,
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

	--ELIMINAR COSTOS HISTORICOS DE RENGLONES
        DECLARE @RengNum INT

        DECLARE Renglones_Cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                AJR.[reng_num]
            FROM
                [saAjusteReng] AS AJR
            WHERE
                AJR.ajue_num = @sAjue_NumOri
            ORDER BY
                reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesAjusteEntradaSalida] @sAjue_NumOri = @sAjue_NumOri,
                    @iReng_NumOri = @RengNum, @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo,
                    @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor INTO @RengNum
            END	
        CLOSE Renglones_Cursor
        DEALLOCATE Renglones_Cursor	
	-- FIN ELIMINAR COSTOS

	--ELIMNAR SERIALES DE ENTRADA DEL DOCUMENTO
        EXEC [dbo].[pEliminarSerialesEntradaDocumento] @sTipo_Doc = N'AJUS', @gRowguid = @gRowguid
        EXEC [dbo].[pEliminarSerialesSalidaDocumento] @sTipo_Doc = N'AJUS', @gRowguid = @gRowguid
	
	--ELIMNAR LOTES DE ENTRADA DEL DOCUMENTO
        EXEC [dbo].[pEliminarLoteSalida] @sTipo_Doc = N'AJUS', @gRowguid = @gRowguid
			
        DELETE FROM
            saAjuste
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            ajue_num = @sAjue_NumOri
            AND validador = @tsValidador

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
            
	--Eliminar Imagen Ajuste Entrada/Salida 
		IF @dtFe_De IS NOT NULL AND EXISTS (SELECT row
```

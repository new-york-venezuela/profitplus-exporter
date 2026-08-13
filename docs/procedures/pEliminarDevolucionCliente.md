# SP: pEliminarDevolucionCliente
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarDevolucionCliente
*DESCRIPCIÓN	: Elimina devolucion cliente
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarDevolucionCliente]
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

		DECLARE @RengNum INT

        DECLARE Renglones_Cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                DCR.[reng_num]
            FROM
                saDevolucionClienteReng AS DCR
				INNER JOIN saDevolucionCliente AS DC ON DC.doc_num = DCR.doc_num
            WHERE
                DCR.doc_num = @sDoc_NumOri
				AND DC.validador = @tsValidador
            ORDER BY
                DCR.reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesDevolucionCliente] @sDoc_NumOri = @sDoc_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor INTO @RengNum
            END	
        CLOSE Renglones_Cursor
        DEALLOCATE Renglones_Cursor

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            saDevolucionCliente
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
            AND validador = @tsValidador	


        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER


		--Elimnar Seriales de Entrada del documento
        EXEC [dbo].[pEliminarSerialesEntradaDocumento] @sTipo_Doc = N'DCLI', @gRowguid = @gRowguid
		
        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
            
	--Eliminar Imagen de Devolución Cliente
		IF @dtFe_De IS NOT NULL AND EXISTS (SELECT rowguidDoc from saDocumentoImagen where rowguidDoc = @rowGuidOri)
			BEGIN
				DECLARE @Co_ima CHAR(6)
				DECLARE @Validador_ima TIMESTAMP
				DECLARE @rowguid_ima UNIQUEIDENTIFIE
```

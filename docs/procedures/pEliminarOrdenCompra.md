# SP: pEliminarOrdenCompra
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarOrdenCompra
*DESCRIPCIÓN	:	Elimina una compra segun su primary key
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
*************************************************************************/

CREATE	PROCEDURE [pEliminarOrdenCompra]
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
		
		--Borro Costo Entradas
        DELETE FROM
            saCostoHistoricoEntrada
        WHERE
            tipo_doc = 'COMP'
            AND doc_orig IN ( SELECT
                                fcr.rowguid
                              FROM
                                saOrdenCompraReng fcr
                              WHERE
                                fcr.doc_num = @sDoc_NumOri )

		
        DELETE FROM
            saOrdenCompra
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
            
	--Eliminar Imagen de Orden de Compra
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
						DI.rowguidDoc = @rowGuidOri
					ORDER BY
						DI.Co_imag

					OPEN contador
					FETCH NEXT FROM contador  INTO @Co_ima, @Validador_ima, @rowguid_ima
					WHILE @@FETCH_STATUS = 0
						BEGIN
							EXEC [dbo].[pEliminarDocumentoImagen]	@gRowguidDocOri = @rowGuidOri, @sCo_ImagOri = @Co_ima,
								@tsValidador = @Validador_ima, @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, 
								@sCo_Sucu_Mo = @sCo_Sucu_Mo, @gRowguid = @rowguid_ima
							FETCH NEXT FROM cont
```

# SP: pEliminarCobro
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarCobro
*DESCRIPCIN : Elimina un Cobro
*AUTOR : SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [pEliminarCobro]
    (
      @sCob_NumOri CHAR(20) ,
      @tsValidador TIMESTAMP ,
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
            saCobro
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            cob_num = @sCob_NumOri
            AND validador = @tsValidador 
--Se eliminan los documentos generados por el cobro
        DELETE FROM
            saDocumentoVenta
        WHERE
            doc_orig = 'COBRO'
            AND nro_orig IN ( SELECT
                                cob_num
                              FROM
                                saCobroDocReng
                              WHERE
                                cob_num = @sCob_NumOri )
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
								@tsValidador = @Validador_ima, @sMaquina = @sMaquina, 
								@sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo, 
								@gRowguid = @rowguid_ima
							FETCH NEXT FROM contador INTO @Co_ima, @Validador_ima, @rowguid_ima
						END
					CLOSE contador
					DEALLOCATE contador
```

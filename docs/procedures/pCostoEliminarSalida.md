# SP: pCostoEliminarSalida
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pCostoEliminarSalida]
    @RowGuid_Doc_Orig UNIQUEIDENTIFIER ,
    @strTipo_doc CHAR(4)
AS 
    BEGIN

	--SET NOCOUNT ON
			
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @Id2 UNIQUEIDENTIFIER
        DECLARE @Cantidad DECIMAL(18, 5)
	
	-- Borra las salidas actuales y
	-- Retorna el valor pendiente a la entrada
        IF ( @strTipo_doc = 'TRAS' ) 
            DECLARE Salidas_Cursor CURSOR LOCAL FORWARD_ONLY
            FOR
                SELECT
                    cod_costo_historico_entrada, cantidad, cod_costo_historico_salida
                FROM
                    saCostoHistoricoSalida
                WHERE
                    saCostoHistoricoSalida.doc_orig = @RowGuid_Doc_Orig
                    AND saCostoHistoricoSalida.tipo_doc IN ( 'TRAS', 'TRAT' )
        ELSE 
            DECLARE Salidas_Cursor CURSOR LOCAL FORWARD_ONLY
            FOR
                SELECT
                    cod_costo_historico_entrada, cantidad, cod_costo_historico_salida
                FROM
                    saCostoHistoricoSalida
                WHERE
                    saCostoHistoricoSalida.doc_orig = @RowGuid_Doc_Orig
                    AND saCostoHistoricoSalida.tipo_doc = @strTipo_doc
	
        OPEN Salidas_Cursor
        FETCH NEXT FROM Salidas_Cursor INTO @Id, @Cantidad, @Id2

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                IF ( @Id IS NOT NULL )
                IF(@strTipo_doc ='NDES')
					BEGIN
						 UPDATE
								saCostoHistoricoEntrada
							SET cantidad_usada = CHE.cantidad_usada 
							FROM saCostoHistoricoEntrada CHE
							WHERE
								cod_costo_historico_entrada = @Id
					END
					ELSE 
                    BEGIN
                        UPDATE
                            saCostoHistoricoEntrada
                        SET cantidad_usada = cantidad_usada - @Cantidad
                        WHERE
                            cod_costo_historico_entrada = @Id
                    END
                DELETE FROM
                    saCostoHistoricoSalida
                WHERE
                    @Id2 = cod_costo_historico_salida

                FETCH NEXT FROM Salidas_Cursor INTO @Id, @Cantidad, @Id2
            END	
        CLOSE Salidas_Cursor
        DEALLOCATE Salidas_Cursor		
	-- Fin Borra las salidas actuales

    END
```

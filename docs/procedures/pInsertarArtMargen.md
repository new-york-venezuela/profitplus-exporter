# SP: pInsertarArtMargen
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarArtMargen
*DESCRIPCIÓN	: Inserta un color
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarArtMargen] ( @sCo_Art CHAR(30)
	
	--@sCo_Us_In	CHAR(6),
	--@sCo_Sucu_In	CHAR(6),
	--@sMaquina		VARCHAR(60) = Null,
	--@sRevisado	CHAR(1),
	--@sTrasnfe		CHAR(1)	
                                              )
AS 
    BEGIN

		--DECLARE @TableTimestamp TABLE (validador VARBINARY(MAX), fe_us_in DATETIME, fe_us_mo DATETIME, rowguid uniqueidentifier)
        DECLARE @I INT
		
        SET @I = 1
        WHILE ( @I <= 12 ) 
            BEGIN
                BEGIN TRY
                    INSERT  INTO saArtMargen
                            ( co_art, co_precio, monto_max, monto_min, co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado,
                              trasnfe, co_sucu_in, co_sucu_mo )
				
				--OUTPUT Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo,Inserted.rowguid  INTO @TableTimestamp
                    VALUES
                            ( @sCo_Art, @I, 20000, 0, ' ', GETDATE(), ' ', GETDATE(), ' ', ' ', ' ', ' ' )
                    SET @I = @I + 1
                END TRY
                BEGIN CATCH
                    SET @I = @I + 1
                    CONTINUE
                END CATCH
            END
    END
```

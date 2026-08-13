# SP: pInsertarConsecutivoSucursal
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarConsecutivo
*DESCRIPCIÓN	:	Actualiza los consecutivos por la sucursal o empresa
*AUTOR			:	SOFTECH SISTEMAS
*FECHA			:	2009-07-14			
***************************************************************************/

CREATE PROCEDURE [pInsertarConsecutivoSucursal]
    (
      @sCo_Sucu CHAR(6) ,
      @sCo_Us_In CHAR(6)
    )
AS 
    SET NOCOUNT ON 
    BEGIN
		
        DECLARE @CodigoConsecutivoActual CHAR(16)
		
        DECLARE tabla_consecutivo CURSOR
        FOR
            SELECT
                co_consecutivo
            FROM
                saConsecutivoTipo 
-- WHERE		(UsoSucursal=1)
	
        OPEN tabla_consecutivo
        FETCH NEXT FROM tabla_consecutivo INTO @CodigoConsecutivoActual

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                IF NOT ( EXISTS ( SELECT
                                    *
                                  FROM
                                    saConsecutivo
                                  WHERE
                                    ( @sCo_Sucu IS NULL
                                      AND saConsecutivo.co_sucur IS NULL
                                      AND saConsecutivo.co_consecutivo = @CodigoConsecutivoActual
                                    )
                                    OR ( @sCo_Sucu = saConsecutivo.co_sucur
                                         AND saConsecutivo.co_consecutivo = @CodigoConsecutivoActual
                                       ) ) ) 
                    BEGIN
                        INSERT  INTO [saConsecutivo]
                                ( [co_consecutivo], /*[valor],*/ [co_sucur], [co_us_in], [fe_us_in], [co_us_mo],
                                  [fe_us_mo] )
                        VALUES
                                ( @CodigoConsecutivoActual, /*0,*/ @sCo_Sucu, @sCo_Us_In, GETDATE(), @sCo_Us_In,
                                  GETDATE() )
				
                    END
                FETCH NEXT FROM tabla_consecutivo INTO @CodigoConsecutivoActual
            END

        CLOSE tabla_consecutivo
        DEALLOCATE tabla_consecutivo
		
    END
    SET NOCOUNT OFF
```

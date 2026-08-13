# SP: pActualizarProgramarPago
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarProgramarPago]
*DESCRIPCIÓN	: Inserta el xml del campo pro_pago desde Programar Pago
*AUTOR			: Softech Sistemas
**************************************************************************/

CREATE PROCEDURE [pActualizarProgramarPago]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @xPro_Pago XML = NULL
	

    )
AS 
    BEGIN	

		--DECLARE @TableTimestamp TABLE (validador VARBINARY(MAX), fe_us_in DATETIME, fe_us_mo DATETIME, rowguid uniqueidentifier)		

        UPDATE
            saDocumentoCompra
        SET pro_pago = @xPro_Pago			 
			
		--OUTPUT Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo,Inserted.rowguid  INTO @TableTimestamp
        WHERE
            nro_doc = @sNro_Doc
            AND co_tipo_doc = @sCo_Tipo_Doc	
				
				
				
    END
```

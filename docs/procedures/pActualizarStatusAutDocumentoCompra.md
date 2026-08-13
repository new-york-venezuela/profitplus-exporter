# SP: pActualizarStatusAutDocumentoCompra
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pActualizarStatusAutDocumentoCompra
*DESCRIPCIÓN	:	Actualiza el status de la autorizacion del pago
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [pActualizarStatusAutDocumentoCompra]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @tsValidador TIMESTAMP ,
      @iPagar INT
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )		

        UPDATE
            saDocumentoCompra
        SET pagar = @iPagar, fe_us_mo = GETDATE()
        OUTPUT
            Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc
            AND nro_doc = @sNro_Doc
            AND validador = @tsvalidador
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
        SELECT
            *
        FROM
            @TableTimestamp
		
    END
```

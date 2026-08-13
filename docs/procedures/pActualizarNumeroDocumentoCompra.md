# SP: pActualizarNumeroDocumentoCompra
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarNumeroDocumentoCompra]
DESCRIPCION: Actualizar el numero de un documento de compra generado por una devolucion
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarNumeroDocumentoCompra]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @sDoc_Num CHAR(20)
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
            dbo.saDevolucionProveedor
        SET nro_doc = @sNro_Doc, co_tipo_doc = @sCo_Tipo_Doc
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO 
		@TableTimestamp
        WHERE
            doc_num = @sDoc_Num
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```

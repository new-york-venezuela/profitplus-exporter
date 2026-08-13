# SP: pActualizarNumeroControlDevProveedor
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarNumeroControlDevProveedor]
DESCRIPCION: Actualizar el numero de control de una devolucion de proveedor
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarNumeroControlDevProveedor]
    (
      @sDoc_Num CHAR(20) ,
      @sN_control CHAR(20) ,
      @sNro_Doc CHAR(20) ,
      @sTipo_Doc CHAR(6)
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
        SET n_control = @sN_control, nro_doc = @sNro_Doc, co_tipo_doc = @sTipo_Doc
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

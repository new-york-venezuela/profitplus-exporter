# SP: pActualizarInfoDocVenta
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarInfoDocVenta]
DESCRIPCION: Actualizar Informción de Documento de Venta
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarInfoDocVenta]
    (
      @sTipo_Doc CHAR(6),
	  @sNro_Doc CHAR(20),
      @sCod_Anulacion CHAR(2),
	  @bAnulado BIT 
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
            dbo.saNCFInfoDocVenta
        SET anulado = @bAnulado, co_anulacion = @sCod_Anulacion
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO 
		@TableTimestamp
        WHERE
			tipo_doc = @sTipo_Doc
			AND
            nro_doc = @sNro_Doc
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```

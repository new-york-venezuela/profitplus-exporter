# SP: pActualizarNCFInfoDocCompra
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarInfoDocVenta]
DESCRIPCION: Actualizar NCF de Documento de Compra
FECHA CREACIÓN: <2019-05-28>
FECHA ACTUALIZACIÓN <2019-06-20>
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarNCFInfoDocCompra]
    (
      @sTipo_Doc CHAR(6),
	  @sNro_Doc CHAR(20),
      @sNcf VARCHAR(19),
	  @sCo_Gasto CHAR(2)
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

		DECLARE @MensajeError VARCHAR(128)

		IF @sNcf <> (SELECT ncf FROM saNCFInfoDocCompra WHERE tipo_doc = @sTipo_Doc AND nro_doc = @sNro_Doc)
		BEGIN 
			IF EXISTS( SELECT * FROM saNCFInfoDocCompra WHERE ncf = @sNcf)
			BEGIN
				SET @MensajeError = 'Ya existe un documento con el mismo Número de Comprobante Fiscal'
				RAISERROR(@MensajeError,16,1)
				RETURN
			END
		END
	
        UPDATE
            dbo.saNCFInfoDocCompra
        SET ncf = @sNcf, co_gasto = @sCo_Gasto
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO 
		@TableTimestamp
        WHERE
			tipo_doc = @sTipo_Doc AND
            nro_doc = @sNro_Doc
	
        SELECT
            *
        FROM
            @TableTimestamp
END
```

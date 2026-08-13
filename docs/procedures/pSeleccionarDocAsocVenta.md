# SP: pSeleccionarDocAsocVenta
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pSeleccionarDocAsocVenta]
DESCRIPCION: Selecciona el documento asociado y numero de los documentos de venta
CREADO POR: SOFTECH SISTEMAS
FECHA CREACIÓN: <2019-06-20>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDocAsocVenta]
    (
      @sDoc_Orig CHAR(6) ,
      @sNro_Orig CHAR(20) ,
      @sCo_Cli CHAR(16)
    )
AS 
    BEGIN

	DECLARE @VALOR INT
		--El Número y tipo de documento existe
		IF EXISTS (SELECT nro_doc FROM  saDocumentoVenta WHERE nro_doc = @sNro_Orig AND co_tipo_doc = @sDoc_Orig AND co_cli = @sCo_Cli)
			SET @VALOR = 1
		--El documento existe y el cliente se encuentran asociado
		ELSE IF EXISTS (SELECT nro_doc FROM  saDocumentoVenta WHERE nro_doc = @sNro_Orig AND co_tipo_doc = @sDoc_Orig)
			SET @VALOR = 2	
		ELSE
		--El documento no existe
			SET @VALOR = 0

		SELECT @VALOR
    END
```

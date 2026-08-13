# SP: pSeleccionarDocAsocCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pSeleccionarDocAsocCompra]
DESCRIPCION: Selecciona el documento asociado y numero de los documentos de compra
CREADO POR: SOFTECH SISTEMAS
FECHA CREACIÓN: <2019-06-20>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDocAsocCompra]
    (
      @sDoc_Orig CHAR(6) ,
      @sNro_Orig CHAR(20) ,
      @sCo_Prov CHAR(16)
    )
AS 
    BEGIN

	DECLARE @VALOR INT
		--El Número y tipo de documento existe
		IF EXISTS (SELECT nro_doc FROM  saDocumentoCompra WHERE nro_doc = @sNro_Orig AND co_tipo_doc = @sDoc_Orig AND co_prov = @sCo_Prov)
			SET @VALOR = 1
		--El documento existe y el cliente se encuentran asociado
		ELSE IF EXISTS (SELECT nro_doc FROM  saDocumentoCompra WHERE nro_doc = @sNro_Orig AND co_tipo_doc = @sDoc_Orig)
			SET @VALOR = 2	
		ELSE
		--El documento no existe
			SET @VALOR = 0

		SELECT @VALOR
    END
```

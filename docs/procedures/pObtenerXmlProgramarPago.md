# SP: pObtenerXmlProgramarPago
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saConfigAjuste`](../tables/saConfigAjuste.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerXmlConfiguracionAjuste
DESCRIPCION: Obtiene la configuracion almacenada en Pro_Pago de Documento de COmpra
CREADO POR: Softech Sistemas
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerXmlProgramarPago]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6)
    )
AS 
    BEGIN	

        DECLARE @MensajeError VARCHAR(256)
        DECLARE @ProPago XML
	--DECLARE @XmlReglas XML
	
        SELECT
            @ProPago = pro_pago
        FROM
            saDocumentoCompra
        WHERE
            nro_doc = @sNro_Doc
            AND co_tipo_doc = @sCo_Tipo_Doc

	/*IF(@XmlData IS NULL)
	BEGIN
		SELECT @XmlData = xml_data , @XmlReglas = xml_reglas
		FROM saConfigAjuste
		WHERE co_mapa = @sCod_Mapa
	END*/

        SELECT
            @ProPago AS pro_pago

    END
```

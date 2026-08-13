# SP: pvpObtenerXmlConfiguracionPuntoV
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvConfigPuntoV`](../tables/pvConfigPuntoV.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpObtenerXmlConfiguracionFacturaVenta
*DESCRIPCIÓN	: Obtiene la configuracion almacenada en el XmlData y XmlReglas
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpObtenerXmlConfiguracionPuntoV]
    (
      @sCod_Usuario CHAR(6) ,
      @sCod_Mapa CHAR(6)
    )
AS 
    BEGIN	

        DECLARE @MensajeError VARCHAR(256)
        DECLARE @XmlData XML
        DECLARE @XmlReglas XML
	
        SELECT
            @XmlData = xml_data, @XmlReglas = xml_reglas
        FROM
            pvConfigPuntoV
        WHERE
            co_usuario = @sCod_Usuario

        IF ( @XmlData IS NULL ) 
            BEGIN
                SELECT
                    @XmlData = xml_data, @XmlReglas = xml_reglas
                FROM
                    pvConfigPuntoV
                WHERE
                    co_mapa = @sCod_Mapa
            END

        SELECT
            @XmlData AS data, @XmlReglas AS reglas

    END
```

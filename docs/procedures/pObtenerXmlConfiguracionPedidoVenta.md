# SP: pObtenerXmlConfiguracionPedidoVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigPedidoVenta`](../tables/saConfigPedidoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerXmlConfiguracionPedidoVenta
DESCRIPCION: Obtiene la configuracion almacenada en el XmlData y XmlReglas
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerXmlConfiguracionPedidoVenta]
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
            saConfigPedidoVenta
        WHERE
            co_usuario = @sCod_Usuario

        IF ( @XmlData IS NULL ) 
            BEGIN
                SELECT
                    @XmlData = xml_data, @XmlReglas = xml_reglas
                FROM
                    saConfigPedidoVenta
                WHERE
                    co_mapa = @sCod_Mapa
            END

        SELECT
            @XmlData AS data, @XmlReglas AS reglas

    END
```

# SP: pObtenerXmlConfiguracionDevolucionCliente
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigDevolucionCliente`](../tables/saConfigDevolucionCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerXmlConfiguracionDevolucionCliente
DESCRIPCION: Obtiene la configuracion almacenada en el XmlData y XmlReglas
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerXmlConfiguracionDevolucionCliente]
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
            saConfigDevolucionCliente
        WHERE
            co_usuario = @sCod_Usuario

        IF ( @XmlData IS NULL ) 
            BEGIN
                SELECT
                    @XmlData = xml_data, @XmlReglas = xml_reglas
                FROM
                    saConfigDevolucionCliente
                WHERE
                    co_mapa = @sCod_Mapa
            END

        SELECT
            @XmlData AS data, @XmlReglas AS reglas

    END
```

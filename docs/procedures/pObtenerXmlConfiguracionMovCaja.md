# SP: pObtenerXmlConfiguracionMovCaja
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConfigMovCaja`](../tables/saConfigMovCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerXmlConfiguracionMovCaja]
DESCRIPCION: Obtiene la configuracion almacenada en el XmlData y XmlReglas
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerXmlConfiguracionMovCaja]
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
            saConfigMovCaja
        WHERE
            co_usuario = @sCod_Usuario

        IF ( @XmlData IS NULL ) 
            BEGIN
                SELECT
                    @XmlData = xml_data, @XmlReglas = xml_reglas
                FROM
                    saConfigMovCaja
                WHERE
                    co_mapa = @sCod_Mapa
            END

        SELECT
            @XmlData AS data, @XmlReglas AS reglas

    END
```

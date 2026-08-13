# SP: pObtenerStatusArticuloRetencion
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pObtenerStatusChequeDevuelto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerStatusArticuloRetencion] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
        DECLARE @bContribuyente BIT
        DECLARE @dePorecentaje DECIMAL(18, 2)

        SELECT
            @bContribuyente = ISNULL(contribu_e, 0), @dePorecentaje = ISNULL(porc_esp, 0)
        FROM
            saproveedor
        WHERE
            co_prov IN ( SELECT
                            reten_iva_tercero
                         FROM
                            saarticulo
                         WHERE
                            co_art = @sCo_Art )
			
        IF ( @bContribuyente = 1 ) 
            SELECT
                @dePorecentaje
        ELSE 
            SELECT
                0

    END
```

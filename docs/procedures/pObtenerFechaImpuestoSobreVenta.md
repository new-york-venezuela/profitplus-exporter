# SP: pObtenerFechaImpuestoSobreVenta
**Tipo**: Obtener
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVenta`](../tables/saImpuestoSobreVenta.md)
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pObtenerFechaImpuestoSobreVenta
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Obtiene el ultimo tipo de impuesto insertado para una fecha
************************************************************************************************/

CREATE PROCEDURE [pObtenerFechaImpuestoSobreVenta]
    (
      @dtFecha SMALLDATETIME ,
      @bVentas BIT = NULL
    )
AS 
    BEGIN


        IF @bVentas = 0 
            BEGIN
                SELECT
                    fecha, tipo_imp, CASE WHEN compras = 1 THEN porc_tasa
                                          ELSE 0
                                     END AS porc_tasa, porc_suntuario
                FROM
                    saImpuestoSobreVentaReng
                WHERE
                    fecha = ( SELECT TOP ( 1 )
                                fecha
                              FROM
                                saImpuestoSobreVenta
                              WHERE
                                fecha <= @dtFecha
                              ORDER BY
                                fecha DESC
                            )
                ORDER BY
                    tipo_imp ASC
            END

        IF @bVentas = 1 
            BEGIN
                SELECT
                    fecha, tipo_imp, CASE WHEN ventas = 1 THEN porc_tasa
                                          ELSE 0
                                     END AS porc_tasa, porc_suntuario
                FROM
                    saImpuestoSobreVentaReng
                WHERE
                    fecha = ( SELECT TOP ( 1 )
                                fecha
                              FROM
                                saImpuestoSobreVenta
                              WHERE
                                fecha <= @dtFecha
                              ORDER BY
                                fecha DESC
                            )
                ORDER BY
                    tipo_imp ASC
            END

        IF @bVentas IS NULL 
            BEGIN
                SELECT
                    fecha, tipo_imp, porc_tasa, porc_suntuario
                FROM
                    saImpuestoSobreVentaReng
                WHERE
                    fecha = ( SELECT TOP ( 1 )
                                fecha
                              FROM
```

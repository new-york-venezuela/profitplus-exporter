# SP: pObtenerMovimietnoArticulo
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerMovimietnoArticulo] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
        DECLARE @bMovimiento BIT
	
        SET @bMovimiento = ( SELECT
                                ISNULL(SUM(co_art), 0) AS total
                             FROM
                                ( SELECT
                                    ( CASE WHEN co_art IS NULL THEN 0
                                           ELSE 1
                                      END ) AS co_art
                                  FROM
                                    saFacturaCompraReng
                                  WHERE
                                    co_art = @sCo_Art
                                  UNION
                                  SELECT
                                    ( CASE WHEN co_art IS NULL THEN 0
                                           ELSE 1
                                      END ) AS co_art
                                  FROM
                                    saFacturaVentaReng
                                  WHERE
                                    co_art = @sCo_Art
                                  UNION
                                  SELECT
                                    ( CASE WHEN co_art IS NULL THEN 0
                                           ELSE 1
                                      END ) AS co_art
                                  FROM
                                    saNotaRecepcionCompraReng
                                  WHERE
                                    co_art = @sCo_Art
                                  UNION
                                  SELECT
                                    ( CASE WHEN co_art IS NULL THEN 0
                                           ELSE 1
                                      END ) AS co_art
                                  FROM
                                    saNotaEntregaVentaReng
                                  WHERE
                                    co_art = @sCo_Art
                                  UNION
                                  SELECT
                                    ( CASE WHEN co_art IS NULL THEN 0
                                           ELSE 1
                                      END ) AS co_art
                                  FROM
                                    saDevolucionClienteReng
                                  WHERE
                                    co_art = @sCo_Art
```

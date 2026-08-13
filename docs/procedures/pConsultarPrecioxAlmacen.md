# SP: pConsultarPrecioxAlmacen
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pConsultarPrecioxAlmacen]
*DESCRIPCIÓN	: Calcula el stock por almacen para un determinado articulo
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-04-20
*FECHA MOD.     : 2021-01-27
**************************************************************************/

CREATE PROCEDURE [dbo].[pConsultarPrecioxAlmacen]
    (
      @pco_art CHAR(30) ,
      @pco_alma CHAR(6) = NULL ,
      @pfecha SMALLDATETIME = NULL
    )
AS 
    BEGIN	
        SELECT
            ISNULL(co_alma, 'TODOS') AS Pk_Co_Alma, co_precio AS Pk_Co_Precio, monto AS Monto, desde AS Pk_Desde, 
            hasta AS Hasta, co_mone as Co_Mone
        FROM
            saArtPrecio
        WHERE
            ( ( @pco_alma = co_alma
                OR @pco_alma IS NULL
              )
              AND ( @pco_art = co_art )
			  AND (Inactivo = 0)
            )
    END
```

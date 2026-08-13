# SP: pSeleccionarRenglonesArtProveedor
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesArtProveedor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
FECHA: 20/08/2009
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesArtProveedor]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Prov CHAR(16)
    )
AS 
    BEGIN
        SELECT
            *, ( SELECT
                    prov_des
                 FROM
                    saProveedor
                 WHERE
                    co_prov = saArtProveedorReng.co_prov
               ) AS prov_des
        FROM
            saArtProveedorReng
        WHERE
            co_art = @sCo_Art
            AND ( co_prov = @sCo_Prov
                  OR @sCo_Prov IS NULL
                )
        ORDER BY
            reng_num ASC
    END
```

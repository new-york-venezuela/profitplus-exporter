# SP: pSeleccionarComisionGeneracion
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)
- [`saComisionTipo`](../tables/saComisionTipo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionGeneracion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionGeneracion] ( @sCo_Generacion CHAR(20) )
AS 
    BEGIN
        SELECT
            CG.*,
            CT.des_comi,
            (V.ven_des) AS ven_des_desde, (V2.ven_des) AS ven_des_hasta,
            (A.art_des) AS art_des_desde, (A2.art_des) AS art_des_hasta,
            (C.cat_des) AS cat_des_desde, (C2.cat_des) AS cat_des_hasta,
            (L.lin_des) AS lin_des_desde, (L2.lin_des) AS lin_des_hasta
        FROM
            saComisionGeneracion CG
            LEFT JOIN saComisionTipo CT ON CT.co_comi = CG.co_comi
            LEFT JOIN saVendedor V ON V.co_ven = CG.co_ven_desde 
            LEFT JOIN saVendedor V2 ON V2.co_ven = CG.co_ven_hasta
            LEFT JOIN saArticulo A ON A.co_art = CG.co_art_desde 
            LEFT JOIN saArticulo A2 ON A2.co_art = CG.co_art_hasta
            LEFT JOIN saCatArticulo C ON C.co_cat = CG.co_cat_desde 
            LEFT JOIN saCatArticulo C2 ON C2.co_cat = CG.co_cat_hasta
            LEFT JOIN saLineaArticulo L ON L.co_lin = CG.co_lin_desde 
            LEFT JOIN saLineaArticulo L2 ON L2.co_lin = CG.co_lin_hasta
        WHERE
            co_generacion = @sCo_Generacion
    END
```

# SP: pSeleccionarAjustePrecioCostoManualRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoReng`](../tables/saAjPrecioCostoReng.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarAjustePrecioCostoManualRenglon
DESCRIPCION	:	Procedimiento para seleccionar todos los tasas asociados a una moneda
CREADO POR	:	SOFTECH SISTEMAS
FECHA		:	<2011-12-12>
ACTUALIZACIÓN:  <2020-06-18>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarAjustePrecioCostoManualRenglon] ( @sCod_Ajuste CHAR(20) )
AS 
    BEGIN
	
        SELECT		DISTINCT
            saAjPrecioCostoReng.reng_num, saAjPrecioCostoReng.*, saArticulo.art_des, saArticulo.prec_om, Au.co_uni,
            saArticulo.rowguid AS articulo_rowguid, saArticulo.tipo_cos
			-->>JN 20200525
			, AP.co_mone, AP.co_art AS validador_Art, saAjPrecioCostoReng.rowguid_ArtPrecio
			--<<JN 20200525
        FROM
            saAjPrecioCostoReng
            INNER JOIN saArticulo ON saAjPrecioCostoReng.co_art = saArticulo.co_art
            INNER JOIN dbo.saArtUnidad AS Au ON Au.co_art = saArticulo.co_art
                                                AND Au.uni_principal = 1
	             --left join  saartprecio pa on pa.co_art=saAjPrecioCostoReng.co_art 
			-->>JN 20200525
			LEFT JOIN saArtPrecio AP ON AP.rowguid = saAjPrecioCostoReng.rowguid_ArtPrecio
			--<<JN 20200525
        WHERE
            cod_ajuste = @sCod_Ajuste
		
    END
```

# SP: pObtenerAjustePrecioCostoManualRenglon
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerAjustePrecioCostoManualRenglon]
DESCRIPCION:    Permite obtener el ajuste de precio del costo manual
CREADO POR:		SOFTECH SISTEMAS
FECHA:			13/10/2009
ACTUALIZACIÓN   31/05/2021
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerAjustePrecioCostoManualRenglon]
    (
      @sCo_Alma_Desde CHAR(6) = NULL ,
      @iTipo_Ajuste INT ,
      @sco_tipoprecio CHAR(6) ,
      @sCo_TipoCosto CHAR(6) = NULL ,
      @sCo_Art_Desde CHAR(30) = NULL ,
      @sCo_Art_Hasta CHAR(30) = NULL ,
      @sCo_Lin_Desde CHAR(6) = NULL ,
      @sCo_SubL_Desde CHAR(6) = NULL ,
      @sCo_Cat_Desde CHAR(6) = NULL ,
      @sCo_Prov_Desde CHAR(16) = NULL ,
      @sItem CHAR(10) = NULL
	  
	  -->>JN 20200602
	  , @sCo_Mone CHAR(6) = NULL
	  -->>JN 20200602		
	
    )
AS 
    BEGIN
        DECLARE @dtFechaDia SMALLDATETIME
		DECLARE @sCo_MoneBase CHAR(6)
		DECLARE @bResultMone BIT = 0

        SET @dtFechaDia = GETDATE()
		SET @sCo_MoneBase = (SELECT g_moneda FROM par_emp)

		IF @sCo_Mone = @sCo_MoneBase 
			BEGIN
				SET @bResultMone= 1
			END
		


	--Tipo Precio
        IF ( @iTipo_Ajuste = 0 ) 
            BEGIN
				IF @bResultMone = 1
					BEGIN
						SELECT
							A.co_Art, A.art_des, A.rowguid, AP.co_alma, AP.co_alma_calculado, AP.co_precio,
							--CASE WHEN A.tipo_cos = '3' THEN CAST(1 AS BIT) -- Ultimo OM
							--	 WHEN A.tipo_cos = '4' THEN CAST(1 AS BIT) -- Promedio OM
							--	 ELSE CAST(0 AS BIT) END 
							AP.precioOm AS prec_OM, ISNULL(AP.desde, @dtFechaDia) AS desde,			
							ISNULL(AP.monto, 0) AS monto, U.co_uni
							-->>JN 20200520
							, AP.co_mone, AP.rowguid_ArtPrecio
							--<<JN 20200520
						FROM
							saArticulo A
							INNER JOIN saArtUnidad U ON U.co_art = A.co_art
														AND U.uni_principal = 1
							LEFT JOIN ( SELECT
											P.co_art, P.co_alma, P.co_precio, P.monto, P.desde, P.hasta, P.co_alma_calculado
											-->>JN 20200520
											,P.co_mone, P.rowguid AS rowguid_ArtPrecio, precioOm AS precioOm
											--<<JN 20200520
										FROM
											saArtPrecio P
										WHERE
											( P.hasta IS NULL
											  OR ( P.hasta IS NOT NULL
												   AND P.hasta >= @dtFechaDia
												 )
											)
```

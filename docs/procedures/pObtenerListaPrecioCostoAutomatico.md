# SP: pObtenerListaPrecioCostoAutomatico
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtMargen`](../tables/saArtMargen.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pObtenerListaPrecioCostoAutomatico]
*CREADO			: <2012-12-12>
*MODIFICADO		: <2021-12-14>
*DESCRIPCIÓN	: Obtiene una lista pre-filtrada con los articulos cuyos precios o costos seran cambiados
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListaPrecioCostoAutomatico]
    (
      @sCo_Alma_Desde CHAR(6) = NULL ,
      @iTipo_Ajuste INT ,
      @sco_tipoprecio CHAR(6) = NULL ,
      @sCo_TipoCosto CHAR(6) = NULL ,
      @sCo_Art_Desde CHAR(30) = NULL ,
      @sCo_Art_Hasta CHAR(30) = NULL ,
      @sCo_Lin_Desde CHAR(6) = NULL ,
      @sCo_Lin_Hasta CHAR(6) = NULL ,
      @sCo_SubL_Desde CHAR(6) = NULL ,
      @sCo_SubL_Hasta CHAR(6) = NULL ,
      @sCo_Cat_Desde CHAR(6) = NULL ,
      @sCo_Cat_Hasta CHAR(6) = NULL ,
      @sCo_Prov_Desde CHAR(16) = NULL ,
      @sCo_Prov_Hasta CHAR(16) = NULL ,
      @dVigencia_Desde DATETIME = NULL ,
      @sItem CHAR(10) = NULL ,
	  @bBasadoEn BIT ,
	  @sTipoCosto CHAR(2) = NULL,
	  @sdFecha_Hasta SMALLDATETIME = NULL ,
	  @sCo_Alma_BasadoEn CHAR(6) = NULL
	  -->>JN 20200626
	  , @sCo_Mone CHAR(6) = NULL
	  -->>JN 202006026	  
	
    )
AS 
    BEGIN
        DECLARE @dtFechaDia SMALLDATETIME
        
       --SET @dtFechaDia = GETDATE()
               
        SET @dtFechaDia = @dVigencia_Desde

		-->>JN 20200626
		DECLARE @sCo_MoneBase CHAR(6)
		DECLARE @bResultMone BIT = 0

        SET @dtFechaDia = GETDATE()
		SET @sCo_MoneBase = (SELECT g_moneda FROM par_emp)

		IF @sCo_Mone = @sCo_MoneBase 
			BEGIN
				SET @bResultMone= 1
			END
		--<<JN 20200626
        
	--Tipo Precio
        IF ( @iTipo_Ajuste = 0 ) 
            BEGIN

				IF @bResultMone = 1
					BEGIN
						SELECT
							A.co_Art, A.art_des, A.rowguid AS rowguidArt, MA.monto_min, Ma.monto_Max, AP.co_alma,
							AP.co_alma_calculado, AP.co_precio, CASE WHEN A.tipo_cos = '3' THEN CAST(1 AS BIT) -- Ultimo OM
																		WHEN A.tipo_cos = '4' THEN CAST(1 AS BIT) -- Promedio OM
																		ELSE CAST(0 AS BIT)
																END AS prec_OM, ISNULL(AP.desde, @dtFechaDia) AS desde,
					--AP.hasta AS hasta,
							/*Sit. 2012358*/
							/*ISNULL(AP.monto, 0)*/
							ISNULL(
								--AJUSTE BASADO EN COSTO PROMEDIO
								CASE WHEN @bBasadoEn = 1 THEN
									ROUND(dbo.ConsultarCostoxAlmacenxFecha(A.co_art,@s
```

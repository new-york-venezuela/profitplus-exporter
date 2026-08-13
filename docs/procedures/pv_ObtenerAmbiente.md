# SP: pv_ObtenerAmbiente
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`pvConfigPuntoV`](../tables/pvConfigPuntoV.md)
- [`pvParEmp`](../tables/pvParEmp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerAmbiente]
*CREACIÓN		:	<2013-09-09>
*MODIFICACIÓN	:	<2020-08-07>
*DESCRIPCIÓN	:	OBTIENE EL LOS DATOS DE LA EMPRESA ADMINISTRATIVA, LOS PARAMETROS DE LA EMPRESA DE 
					PUNTO DE VENTA, EL MANEJO DE LAS ETIQUETAS (CODIGOS DE BARRA) Y DE LA CONFIGURACION DE 
					USUARIO DE UN MAPA O USUARIO DADO.
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerAmbiente]
(                              
		@sEmployee_i	CHAR(6),
		@sMapa			CHAR(6)
)
AS
BEGIN
		DECLARE @saMonedaBase			CHAR(6)
		DECLARE @sUsu_pr				CHAR(6) 
		DECLARE @sCta_ing				CHAR(20)
		DECLARE @sDescrip_cta			CHAR(60)
		DECLARE @sCaja_prin				CHAR(6)
		DECLARE @sDes_cajp				CHAR(60)
		DECLARE	@iDecimalprecio			INT
		DECLARE	@iDecimalexistencia		INT
		DECLARE	@iMax_lin				INT
		DECLARE	@bP_desc_glo			BIT

-->>JN 20200727
		DECLARE @sMoneda2						CHAR(6)
		DECLARE @sCta_ingMoneda2				CHAR(20)
		DECLARE @sDescrip_ctaMoneda2			CHAR(60)
		DECLARE @sCaja_prinMoneda2				CHAR(6)
		DECLARE @sDes_cajpMoneda2				CHAR(60)
		DECLARE @sMoneda3						CHAR(6)
		DECLARE @sCta_ingMoneda3				CHAR(20)
		DECLARE @sDescrip_ctaMoneda3			CHAR(60)
		DECLARE @sCaja_prinMoneda3				CHAR(6)
		DECLARE @sDes_cajpMoneda3				CHAR(60)
--<<JN 20200727
                
     --PARAMETROS GENERALES DE EMPRESA ADMINISTRATIVA
	 SELECT  @saMonedaBase = g_moneda,
        @iDecimalexistencia = i_dec_stock,
        @iDecimalprecio = i_dec_precio, 
        @iMax_lin = v_max_reng,
        @bP_desc_glo = p_desc_glo 
        FROM par_emp

     -- PARAMETROS GENERALES DE PUNTO DE VENTA
     SELECT @sUsu_pr = a.cod_usu,
            @sCta_ing = a.co_cta_ingr_egr,
            @sDescrip_cta = c.descrip,
            @sCaja_prin = a.cod_caja,
            @sDes_cajp = b.descrip,
-->>JN 20200727
			@sCta_ingMoneda2 = a.co_cta_ingr_egr_moneda2,
			@sDescrip_ctaMoneda2 = c2.descrip,
			@sCaja_prinMoneda2 = a.cod_caja_moneda2,
			@sDes_cajpMoneda2 = b2.descrip,
			@sMoneda2 = a.co_Mone_moneda2,

			@sCta_ingMoneda3 = a.co_cta_ingr_egr_moneda3,
			@sDescrip_ctaMoneda3 = c3.descrip,
			@sCaja_prinMoneda3 = a.cod_caja_moneda3,
			@sDes_cajpMoneda3 = b3.descrip,
			@sMoneda3 = a.co_Mone_moneda3
--<<JN 20200727 
            FROM pvParEmp a
            INNER JOIN saCaja b ON a.cod_caja = b.cod_caja
			INNER JOIN  saCuentaIngEgr c
```

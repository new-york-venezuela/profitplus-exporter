# SP: RepRelacionIGTFxPagosSinMediacFinancNew
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/01/2016>
-- Description:	<RepRelacionIGTFxPagosSinMediacFinancNew>
-- =============================================
CREATE PROCEDURE [dbo].[RepRelacionIGTFxPagosSinMediacFinancNew]

    @sCo_Caja_d CHAR(10) = NULL,
	@sCo_Caja_h CHAR(10) = NULL,
	@sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,  
    @dFecha_d  smalldatetime = null,	
    @dFecha_h  smalldatetime = null,
    @cOrigenMovi CHAR(6) = 'TODO' ,
	@sCo_Mone CHAR(6) = NULL ,
	@iPorc_imp DECIMAL(18,2) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0	

	
AS 
    BEGIN
	SET NOCOUNT ON ;
		IF ( @sCo_Mone IS NULL ) 
			RAISERROR('Debe suministrar un codigo de moneda',16,1)   

	SELECT
		  
		  MC.cod_caja, CA.descrip, MC.mov_num, MC.fecha, MC.doc_num, CA.co_mone, MC.descrip, MC.origen, 
		  CASE WHEN MC.anulado=1 THEN 0 ELSE MC.monto_d END AS monto_d,
		  MC.anulado, @iPorc_imp as por_IGTF,
		 -- CASE WHEN MC.anulado=1 THEN 0.00 ELSE (ROUND((MC.monto_d * [dbo].[fObtenerImpuestoTransacciones]('ITF',MC.fecha)/100),2)) END AS IGTF
		 CASE WHEN MC.anulado=1 THEN 0.00 ELSE (ROUND(((MC.monto_d * @iPorc_imp)/100),2)) END AS IGTF, MC.tasa --Jortiz se agrega el campo tasa para el reporte RepRelacionIGTFxPagosSinMediacFinancNew.rpt
			FROM
			
			 saMovimientoCaja AS MC
			INNER JOIN saCaja AS CA ON CA.cod_caja = MC.cod_caja

			WHERE

			( ( @sCo_Caja_d IS NULL
				OR @sCo_Caja_d <=  MC.cod_caja
			  )
			  AND ( @sCo_Caja_h IS NULL
					OR  MC.cod_caja <= @sCo_Caja_h
				  )
			)
			 AND ( ( @sCo_CuentaIngr_d IS NULL
					OR MC.co_cta_ingr_egr >= @sCo_CuentaIngr_d
				  )
				  AND ( @sCo_CuentaIngr_h IS NULL
						OR MC.co_cta_ingr_egr <= @sCo_CuentaIngr_h
					  )
					)
					AND ( ( @dFecha_d IS NULL
					OR dbo.FechaSimple(MC.fecha) >= @dFecha_d
				  )
				  AND ( @dFecha_h IS NULL
						OR dbo.FechaSimple(MC.fecha) <= @dFecha_h
					  )
				)
			AND ( @sCo_Mone IS NULL
				  OR co_mone = @sCo_Mone
				)
			 AND (
					( @cOrigenMovi = 'TODO' )
				  OR
					( @cOrigenMovi = MC.origen)  
				)
			AND		
			(
					MC.tipo_mov = 'E'
					AND MC.forma_pag = 'EF'
			)

			ORDER BY
				CASE @sDir
					WHEN 'DESC' THEN CASE @sCampOrderBy
										WHEN 'fecha' THEN MC.fecha
									END
				END DESC, CASE @sDir
							WHEN 'DESC' THEN CASE @sCampOrderBy
```

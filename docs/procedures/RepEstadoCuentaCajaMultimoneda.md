# SP: RepEstadoCuentaCajaMultimoneda
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2017-09-17>
-- Modified date: <2017-09-21>
-- Description:	<Saldo en Cuentas de Cajas>
-- =============================================
CREATE PROCEDURE [dbo].[RepEstadoCuentaCajaMultimoneda]

    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_CodCaja_d CHAR(6) = NULL ,
    @cCo_CodCaja_h CHAR(6) = NULL ,
    @cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL ,
    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @cTipoMovi CHAR(6) = NULL ,
	@Co_Moneda CHAR(6) = NULL ,
	@Co_Moneda_Rep CHAR (6) = NULL,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS 
    BEGIN
          SET NOCOUNT ON ;

	    IF @sFecha_h IS NOT NULL 
            SET @sFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sFecha_h))

/****Valores por defecto****/
        IF ( @cTipoMovi IS NULL ) 
            SET @cTipoMovi = 'TODO'
					




			select CU.cod_caja, CU.inactivo, CU.co_mone, MO.relacion, CU.descrip,

			--wosuna situacion 129529
			  Case 
			  WHEN ((@Co_Moneda = CU.co_mone and @Co_Moneda_Rep is null) or (@Co_Moneda=@Co_Moneda_Rep)) 
			      then 1
			  WHEN  ((@Co_Moneda_Rep is not null and MO.relacion = 0) or (@Co_Moneda_Rep is not null and MO.relacion = 1))
			      then
				  ([dbo].[TasaAUnaFecha](CU.co_mone, 1, @sFecha_h)/[dbo].[TasaAUnaFecha](@Co_Moneda_Rep, 1, @sFecha_h))
              else 
			       [dbo].[TasaAUnaFecha](CU.co_mone, 1, @sFecha_h)
               end AS tasa_fec,

					--CASE 
					--	WHEN (MOV_TOTAL.tasa > 0 AND (@Co_Moneda IS NULL OR @Co_Moneda <> CU.co_mone)) 
					--	THEN MOV_TOTAL.tasa	
					--	WHEN ((@Co_Moneda = CU.co_mone)) 
					--		THEN 1
					--	ELSE 
					--		[dbo].[TasaAUnaFecha](CU.co_mone, 1, @sFecha_h)
					--END AS tasa_fec,


					dbo.SaldoCajaAUnaFecha(CU.cod_caja, @sFecha_d - 1) AS saldo_ini1,
					ISNULL(idb,0.00) as idb, ISNULL(monto_d, 0.00) as monto_d , isnull(monto_h, 0.00) as monto_h, 
					UPPER(MO.mone_des) as mone_des,
					 '' as num_cta,
					@Co_Moneda as Mon_Fil, @Co_Moneda_Rep as Mon_Rep,
					MOV_TOTAL.tipo,
					MOV_TOTAL.mov_num,
					MOV_TOTAL.descrip_mov,
					MOV_TOTAL.fecha,
					MOV_TOTAL.tipo_op AS tipo_op,
					MOV_TOTAL.doc_num,
					MOV_TOTAL.idb,
					MOV_TOTAL.origen,
					MOV_TOTAL.a
```

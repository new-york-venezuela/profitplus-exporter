# SP: RepEstadoCuentaBancoMultimoneda
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2019-02-14>
-- Description:	<Estado de Cuenta Bancaria Multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepEstadoCuentaBancoMultimoneda]
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

        IF ( @cTipoMovi IS NULL ) 
            SET @cTipoMovi = 'TODO'
					
		 		SELECT MBAN.cod_cta, MBAN.anulado, MO.co_mone, MO.relacion, MBAN.descrip,
					--CASE 
						--WHEN (MBAN.tASa > 0 AND (@Co_Moneda IS NULL OR @Co_Moneda <> CB.co_mone))  THEN MBAN.tASa	
						--WHEN ((@Co_Moneda = CB.co_mone)) THEN 1
						--ELSE 
							--[dbo].[TASaAUnaFecha](CB.co_mone, 1, @sFecha_d)
					
					--KC:>> Sit. #106448
					CASE
						when ((@Co_Moneda = CB.co_mone and @Co_Moneda_Rep is null) or (@Co_Moneda=@Co_Moneda_Rep)) 
							then 1
						when ((@Co_Moneda_Rep is not null and MO.relacion = 0) or (@Co_Moneda_Rep is not null and MO.relacion = 1))
							then 
							([dbo].[TasaAUnaFecha](CB.co_mone, 1, @sFecha_h)/[dbo].[TasaAUnaFecha](@Co_Moneda_Rep, 1, @sFecha_h))
						else 
							[dbo].[TasaAUnaFecha](CB.co_mone, 1, @sFecha_h)
						
							END AS tASa_fec,


								--<<

					--ROUND(dbo.SaldoCajaAUnaFecha(MBAN.cod_cta, @sFecha_h - 1), 0.00) AS saldo_inicial,

					--KC : Sit. #105747 >>
					--ROUND(dbo.SaldoBancoAUnaFecha2(CB.cod_cta, @sFecha_d - 1, 2, 'ZZZZ'), 2) AS saldo_inicial,
					--<<
					ROUND(dbo.SaldoBancoAUnaFecha4(CB.cod_cta , @sFecha_d -1 ,  2 ),2) AS saldo_inicial, 
					
					--ISNULL(MBAN.idb,0.00)
					CASE 
					WHEN (MBAN.idb is null)
					   then 0
                    else  
					MBAN.idb * CASE WHEN (MBAN.tipo_op = 'NC' AND MBAN.origen = 'CHD')
											THEN 1
											ELSE -1
											END
											END
					 AS idb, 


						--<<
```

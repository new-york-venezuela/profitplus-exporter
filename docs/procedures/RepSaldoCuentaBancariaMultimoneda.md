# SP: RepSaldoCuentaBancariaMultimoneda
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2017-09-17>
-- Modified date: <2017-09-21>
-- Description:	<Saldo en Cuentas Bancarias>
-- =============================================
CREATE PROCEDURE [dbo].[RepSaldoCuentaBancariaMultimoneda]
	-- Add the parameters for the stored procedure here
    @sCo_CodCuenta_d CHAR(6) = NULL ,
    @sCo_CodCuenta_h CHAR(6) = NULL ,
    @sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,
    @sCo_Descripcion_d CHAR(60) = NULL ,
    @sCo_Descripcion_h CHAR(60) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @Co_Moneda CHAR(6) = NULL ,
	@Co_Moneda_Rep CHAR (6) = NULL,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

			
			select CU.cod_cta, CU.inactivo, CU.co_mone, MO.relacion, BA.des_ban, 
					CASE 
						when ((@Co_Moneda = CU.co_mone and @Co_Moneda_Rep is null) or (@Co_Moneda=@Co_Moneda_Rep)) 
							then 1
						when ((@Co_Moneda_Rep is not null and MO.relacion = 0) or (@Co_Moneda_Rep is not null and MO.relacion = 1))
							then 
							([dbo].[TasaAUnaFecha](CU.co_mone, 1, @dFecha_h)/[dbo].[TasaAUnaFecha](@Co_Moneda_Rep, 1, @dFecha_h))
						else 
							[dbo].[TasaAUnaFecha](CU.co_mone, 1, @dFecha_h)
					END as tasa_fec,

					--ROUND(dbo.SaldoBancoAUnaFecha2(CU.cod_cta, @dFecha_d - 1, 2, 'ZZZZ'), 2) AS saldo_ini1,
					ROUND(dbo.SaldoBancoAUnaFecha4(CU.cod_cta , @dFecha_d -1 ,  2 ),2) AS saldo_ini1, 

					ISNULL(idb,0.00) as idb, ISNULL(monto_d, 0.00) as monto_d , isnull(monto_h, 0.00) as monto_h, 
					UPPER(MO.mone_des) as mone_des,
					(left(CU.num_cta,4) +'-'+SUBSTRING(CU.num_cta,5,4)+'-'+substring(CU.num_cta,9,2)+'-'+right(CU.num_cta,10)) as num_cta,
					@Co_Moneda as Mon_Fil, @Co_Moneda_Rep as Mon_Rep
			from saCuentaBancaria AS CU 
                INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
                INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
			LEFT JOIN (
 			SELECT
                MB.cod_cta, 
                SUM(ROUND((MB.idb) * CASE WHEN  ((MB.tipo_op = 'CHD' AND MB.origen = 'PAG') or (MB.tipo_op = 'NC' AND MB.origen = 'CHD'))--la primera condicion es imposible
											THEN 1
											ELSE -1
```

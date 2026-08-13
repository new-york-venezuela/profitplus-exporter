# SP: RepMovimientoEdoCuentaNoConciliado
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
-- Create date: <22/01/2016>
-- Description:	<RepMovimientoEdoCuentaNoConciliado>
-- LAST DATE:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepMovimientoEdoCuentaNoConciliado]
    @sCodCuenta_d CHAR(6) = NULL ,
    @sCodCuenta_h CHAR(6) = NULL ,
	@sDoc_Num_d CHAR(20) = NULL , --NRO DE DOCUMENTO
	@sDoc_Num_h CHAR(20) = NULL ,
    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @bHeaderRep BIT = 0
	 
AS 
    BEGIN
        SET NOCOUNT ON ;

		IF @sFecha_d IS NOT NULL 
            SET @sFecha_d = dbo.FechaSimple(@sFecha_d)
        IF @sFecha_h IS NOT NULL 
            SET @sFecha_h = dbo.FechaSimple(@sFecha_h)

		SELECT MB.*, cu.num_cta, ba.des_ban
		FROM    saMovimientoBanco AS MB
				INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
				INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
				INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
		WHERE ( MB.anulado = 0 and mb.dep_con = 0 and conciliado = 0)
		AND ( ( @sCodCuenta_d IS NULL OR CU.cod_cta >= @sCodCuenta_d )
					AND ( @sCodCuenta_h IS NULL OR CU.cod_cta <= @sCodCuenta_h  )
			)
		AND ( ( @sDoc_Num_d IS NULL OR MB.doc_num>= @sDoc_Num_d) AND ( @sDoc_Num_h IS NULL OR MB.doc_num <= @sDoc_Num_h))
		AND ( ( @sFecha_d IS NULL OR dbo.FechaSimple(MB.fecha) >= @sFecha_d) AND ( @sFecha_h IS NULL OR dbo.FechaSimple(MB.fecha) <= @sFecha_h ))
		ORDER BY MB.cod_cta, MB.fecha, MB.mov_num

    END
```

# SP: RepMovimientoBancoNoConciliado
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
-- Last Update Date: 2017-09-15
-- Description:	<RepMovimientoBancoNoConciliado>
-- =============================================
CREATE PROCEDURE [dbo].[RepMovimientoBancoNoConciliado]
(
	@cCo_Numero_d CHAR(20) = NULL ,
	@cCo_Numero_h CHAR(20) = NULL ,
    @cCodCuenta_d CHAR(6) = NULL ,
    @cCodCuenta_h CHAR(6) = NULL ,
	@cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL,
	@sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
	@cTipo_Op CHAR(15) = NULL , --TIPO DE MOVIMIENTO 
	@sOrigen CHAR(10) = NULL , --ORIGEN DEL MOVIMIENTO
	@sDoc_Num_d CHAR(20) = NULL , --NRO DE DOCUMENTO
	@sDoc_Num_h CHAR(20) = NULL ,
	@sCo_Moneda CHAR(6) = NULL ,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
)
AS 
    BEGIN
        SET NOCOUNT ON ;
		
		IF @sFecha_d IS NOT NULL 
            SET @sFecha_d = dbo.FechaSimple(@sFecha_d)
        IF @sFecha_h IS NOT NULL 
            SET @sFecha_h = dbo.FechaSimple(@sFecha_h)

		/****Valores por defecto****/
        IF ( @cTipo_Op IS NULL ) 
            SET @cTipo_Op = 'TODO'

        IF ( @sOrigen IS NULL ) 
            SET @sOrigen = 'TODO'

		SELECT ISNULL(dbo.saSaldoConciliacion(cu.cod_cta,cu.cod_cta, YEAR(MB.fecha), MONTH(MB.fecha)), 0) AS Saldo_Inicial, 
		MB.mov_num, MB.descrip, MB.cod_cta, MB.fecha, MB.tipo_op, MB.doc_num, MB.monto_d, MB.monto_h, 
		MB.idb *(case when mb.monto_h<=0 then 1 else -1 end) as idb, 
		MB.dep_con, cu.num_cta, ba.des_ban
		FROM    saMovimientoBanco AS MB
				INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
				INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
				INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
		WHERE ( MB.anulado = 0 and mb.conciliado = 0)
		AND ( (@cCo_Numero_d IS NULL OR MB.mov_num >= @cCo_Numero_d) AND ( @cCo_Numero_h IS NULL OR MB.mov_num <= @cCo_Numero_h)) --MOV_NUM
		AND ( ( @cCodCuenta_d IS NULL OR CU.cod_cta >= @cCodCuenta_d ) AND ( @cCodCuenta_h IS NULL OR CU.cod_cta <= @cCodCuenta_h) )
		AND ( ( @cCo_CuentaIngr_d IS NULL OR MB.co_cta_ingr_egr >= @cCo_CuentaIngr_d ) AND ( @cCo_CuentaIngr_h IS NULL OR MB.co_cta_ingr_egr <= @cCo_CuentaIngr_h ))
        AND ( ( @sFecha_d IS NULL OR dbo.FechaSimple(MB.fecha) >= @sFecha_d) AND ( @sFecha_h IS NULL OR dbo.FechaSimple(MB.fecha) <= @sFecha_h ))
		AND ( ( @cTipo_Op = 'TODO' )   -
```

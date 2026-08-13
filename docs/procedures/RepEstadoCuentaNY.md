# SP: RepEstadoCuentaNY
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18/07/2012>
-- Last Update Date: 2017-06-27
-- Description:	<Estado de Cuentas Bancarias>
-- =============================================
CREATE PROCEDURE [dbo].[RepEstadoCuentaNY]
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_CodCuenta_d CHAR(6) = NULL ,
    @cCo_CodCuenta_h CHAR(6) = NULL ,
    @cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL ,
    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @cTipoMovi CHAR(6) = NULL ,
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
		

        SELECT
            'Cuenta' AS tipo, CU.num_cta, --1
            CU.inactivo, --2
            CU.co_mone,  --3
            MO.mone_des, --4
            BA.co_ban,--5
            BA.des_ban,--6 
            MB.mov_num,--7
            MB.descrip,--8
            MB.cod_cta,--9
            MB.fecha,--10
            MB.tipo_op,--11
            MB.doc_num, --12
            MB.monto_d * ( CASE WHEN MB.anulado = 1 THEN 0
                                ELSE 1
                           END ) AS monto_d, --13
            MB.monto_h * ( CASE WHEN MB.anulado = 1 THEN 0
                                ELSE 1
                           END ) AS monto_h, --14
			MB.idb * case when MB.monto_d > 0 then 1 else -1 end as idb,--15 
			MB.origen, --16
            MB.anulado, --17
            ISNULL(dbo.SaldoBancoAUnaFecha3(CU.cod_cta, @sFecha_d, @sFecha_h, 2), 0) AS saldo_ini1, --18,
			(case when MB.origen='OPA' THEN (select top 1 cl.cli_des from sacliente as cl INNER JOIN saCobro as c  on cl.co_cli=c.co_cli)END)as co_cli
        FROM
            saMovimientoBanco AS MB
            INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
            INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
            INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
        WHERE
			MB.saldo_ini <> 1 AND MB.anulado = 0  AND 
            ( ( @cCo_Numero_d IS NULL
```

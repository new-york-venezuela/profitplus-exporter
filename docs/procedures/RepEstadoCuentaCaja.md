# SP: RepEstadoCuentaCaja
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18/07/2012>
-- Last Date Update: 2017-08-31
-- Description:	<Estado de Cuentas (Cajas)>
-- =============================================
CREATE PROCEDURE [dbo].[RepEstadoCuentaCaja]
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

		DECLARE @saldos TABLE
       (
             cod_caja CHAR(6)
             ,saldo_ini DECIMAL(18,2)
           , primary key (cod_caja)
       )

	    INSERT INTO @saldos
		select cu.cod_caja, ISNULL(dbo.SaldoCajaAUnaFecha(CU.cod_caja, @sFecha_d - 1), 0.00) as saldo_ini
				from saCaja CU
				where 
				(@cCo_CodCuenta_d IS NULL OR CU.cod_caja >= @cCo_CodCuenta_d)
				AND (@cCo_CodCuenta_h IS NULL OR CU.cod_caja <= @cCo_CodCuenta_h)


        IF @sFecha_h IS NOT NULL 
            SET @sFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sFecha_h))

/****Valores por defecto****/
        IF ( @cTipoMovi IS NULL ) 
            SET @cTipoMovi = 'TODO'
		

        SELECT
            'Caja' AS tipo, CU.descrip AS num_cta, --1
            CU.inactivo,--2
            CU.co_mone, --3
            MO.mone_des,--4
            '' AS co_ban,--5
            '' AS des_ban,--6
            MB.mov_num,--7
            MB.descrip,--8
            MB.cod_caja AS cod_cta,--9
            MB.fecha,--10
            MB.tipo_mov AS tipo_op, --11
            MB.doc_num, --12
            MB.monto_d * ( CASE WHEN MB.anulado = 1 THEN 0
                                ELSE 1
                           END ) AS monto_d, --13
            MB.monto_h * ( CASE WHEN MB.anulado = 1 THEN 0
                                ELSE 1
                           END ) AS monto_h, --14
            0.00 AS idb, --15
            MB.origen, --16
            MB.anulado,--17
			SI.saldo_ini  AS saldo_ini1 --18
        FROM
            saMovimientoCaja AS MB
            INNER JOIN saCaja AS CU ON CU.cod_caja = MB.cod_caja
```

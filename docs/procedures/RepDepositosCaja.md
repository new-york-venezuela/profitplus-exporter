# SP: RepDepositosCaja
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- ======================================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/08/2011>
-- Last Update: <2019-09-30>
-- Description:	<Reporte (Resumen) de Depósitos de Caja>
-- ======================================================
CREATE PROCEDURE [dbo].[RepDepositosCaja]
	-- Add the parameters for the stored procedure here
    @d_Fecha_d SMALLDATETIME = NULL ,
    @d_Fecha_h SMALLDATETIME = NULL ,
	@sNumDep_d CHAR (20) = NULL ,
	@sNumDep_h CHAR (20) = NULL ,
	@sNumPlanilla_d CHAR (10) = NULL ,
	@sNumPlanilla_h CHAR (10) = NULL ,
	@sCtaBan_d CHAR (6) = NULL ,
	@sCtaBan_h CHAR (6) = NULL ,
	@sCtaIng_d CHAR (20) = NULL ,
	@sCtaIng_h CHAR (20) = NULL ,
	@sSucursal CHAR (6) = NULL ,
	@sMoneda CHAR (6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    	SET @d_Fecha_d = dbo.FechaSimple(@d_Fecha_d)
    	SET @d_Fecha_h = dbo.FechaSimple(@d_Fecha_h)
    	

		SELECT
			DB.dep_num, DB.fecha, DB.deposito as planilla, (BR.comision + BR.impuesto) * -1 as ComImp,
            (MC.monto_h * ( CASE WHEN MC.forma_pag = 'CH' THEN 1
                                ELSE 0
                           END )) AS TotalCheque,
            (MC.monto_h * ( CASE WHEN MC.forma_pag = 'TJ' THEN 1
                                ELSE 0
                           END )) AS TotalTarjeta, DB.total_efec*0 as total_efec,
			CB.cod_cta, CB.num_cta, CB.co_mone, BA.des_ban, (MC.monto_h - (BR.comision + BR.impuesto)) as total_dep
        FROM
            saDepositoBanco AS DB 
			INNER JOIN saDepositoBancoReng AS BR ON DB.dep_num = BR.dep_num
	    	LEFT JOIN saMovimientoCaja AS MC ON BR.mov_afec_c = MC.mov_num
			INNER JOIN saCuentaBancaria AS CB ON DB.cod_cta = CB.cod_cta
			INNER JOIN saBanco AS BA ON CB.co_ban = BA.co_ban
        WHERE
			DB.activado ='1' AND

		--Filtros Desde/Hasta
            ( ( @d_Fecha_d IS NULL
                OR dbo.FechaSimple(DB.fecha) >= @d_Fecha_d
              )
              AND ( @d_Fecha_h IS NULL
                    OR dbo.FechaSimple(DB.fecha) <= @d_Fecha_h
                  )
            )
           AND ( ( @sNumDep_d IS NULL
                OR DB.dep_num >= @sNumDep_d
              )
              AND ( @sNumDep_h IS NULL
                    OR DB.dep_num <= @sNumDep_h
                  )
            )
            AND ( ( @sNumPlanilla_d IS NULL
                OR DB.depos
```

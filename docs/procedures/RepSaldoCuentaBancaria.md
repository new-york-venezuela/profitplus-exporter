# SP: RepSaldoCuentaBancaria
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
-- Modified date: <2017-06-07>
-- Description:	<Saldo en Cuentas Bancarias>
-- =============================================
CREATE PROCEDURE [dbo].[RepSaldoCuentaBancaria]
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
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
 
---Sit.#814205 (02/02/2017-HZ)-1: Se crea un temporal para calcular el saldo Inicial de cada registro
	  BEGIN TRY
		IF EXISTS (SELECT * FROM  tempdb.sys.tables WHERE name like '%#tmp_movsldo1%')
			DROP TABLE #tmp_movsldo1

			CREATE TABLE #tmp_movsldo1 (
				[cod_cta] [char](6) NOT NULL,
				[idb] [decimal](18, 2) NOT NULL,
				[num_cta] [char](20) NOT NULL,
				[co_mone] [char](6) NOT NULL,
				[inactivo] [bit] NOT NULL,
				[des_ban] [varchar](60) NOT NULL,
				[monto_d] [decimal](18, 2) NOT NULL,
				[monto_h] [decimal](18, 2) NOT NULL,
				[saldo_ini1] [decimal](18, 2) NOT NULL,
				[tasa_fec] [decimal](12, 5) NOT NULL,
				[campo1] [varchar](60) NULL,
				[campo2] [varchar](60) NULL,
				[campo3] [varchar](60) NULL,
				[campo4] [varchar](60) NULL,
				[campo5] [varchar](60) NULL,
				[campo6] [varchar](60) NULL,
				[campo7] [varchar](60) NULL,
				[campo8] [varchar](60) NULL,
				[tasa] [decimal](12, 5) NOT NULL,
				[mov_num] [char](10) NOT NULL,
				[fecha] [smalldatetime] NOT NULL,
				[saldo_fin1] [decimal](18, 2) NOT NULL
			)	  

		IF EXISTS (SELECT * FROM  tempdb.sys.tables WHERE name like '%#tmp_movsldo2%')
			DROP TABLE #tmp_movsldo2

			CREATE TABLE #tmp_movsldo2 (
				[cod_cta] [char](6) NOT NULL,
				[idb] [decimal](18, 2) NOT NULL,
				[num_cta] [char](20) NOT NULL,
				[co_mone] [char](6) NOT NULL,
				[inactivo] [bit] NOT NULL,
				[des_ban] [varchar](60) NOT NULL,
				[monto_d] [decimal](18, 2) NOT NULL,
				[monto_h] [decimal](18, 2) NOT NULL,
				[saldo_ini1] [decimal](18
```

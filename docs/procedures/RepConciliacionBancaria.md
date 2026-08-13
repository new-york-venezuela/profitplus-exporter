# SP: RepConciliacionBancaria
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/01/2016>
-- Last Update Date: 2017-09-15
-- Description:	<RepConciliacionBancaria>
-- =============================================
CREATE PROCEDURE [dbo].[RepConciliacionBancaria]
    @cCodCuenta_d CHAR(6) = NULL ,
    @cCodCuenta_h CHAR(6) = NULL ,
	@sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL,
    @iAnho AS INT = NULL ,
    @cMes AS INT = NULL
AS 
    BEGIN
		SET NOCOUNT ON ;
		IF ( @iAnho IS NULL ) 
			RAISERROR('Debe suministrar un Año',16,1)  

		IF ( @cMes IS NULL ) 
			RAISERROR('Debe suministrar un Mes',16,1)  
           
		IF ( @cMes > 12 OR @cMes < 1) 
			RAISERROR('El valor del mes debe estar entre 1 y 12',16,1)  

		DECLARE @TmovBan TABLE
		(
			mov_num char(20) NOT NULL,
			descrip varchar (60) NULL,
			cod_cta char( 6) NOT NULL,
			co_cta_ingr_egr char (20) NOT NULL,
			fecha smalldatetime NOT NULL,
			tasa decimal(18, 5) NOT NULL,
			tipo_op char(2) NOT NULL,
			doc_num varchar(20) NOT NULL,
			monto_d decimal(18, 2) NOT NULL,
			monto_h decimal(18, 2) NOT NULL,
			idb decimal(18, 2) NOT NULL,
			saldo_ini bit NOT NULL,
			origen char(3) NOT NULL,
			cob_pag char(20) NULL,
			dep_num char(20) NULL,
			conciliado bit NOT NULL,
			ori_dep bit NOT NULL,
			anulado bit NOT NULL,
			dep_con int NOT NULL,
			fec_con smalldatetime NULL,
			cod_ingben char(6) NULL,
			fecha_che smalldatetime NOT NULL,
			feccom smalldatetime NULL,
			numcom int NULL,
			subTotalDebe decimal(18, 2) NULL,
			subTotalHaber decimal(18, 2) NULL,
			subTotalIdb decimal(18, 2) NULL,
			dSaldoInicialCuenta decimal(18,2),
			dSaldo decimal(18,2)
		)
		------- CAMPOS QUE SE MANEJARAN EN EL CURSOR
		DECLARE
			@sMov_num char(20) ,
			@sDescrip varchar (60) ,
			@sCod_cta char( 6) ,
			@sCo_cta_ingr_egr char (20) ,
			@sdfecha smalldatetime ,
			@dTasa decimal(18, 5) ,
			@sTipo_op char(2) ,
			@sDoc_num varchar(20) ,
			@dMonto_d decimal(18, 2) ,
			@dMonto_h decimal(18, 2) ,
			@dIdb decimal(18, 2) ,
			@bSaldo_ini bit ,
			@sOrigen char(3) ,
			@sCob_pag char(20) ,
			@sDep_num char(20) ,
			@bConciliado bit ,
			@bOri_dep bit ,
			@bAnulado bit ,
			@iDep_con int ,
			@sdFec_con smalldatetime ,
			@sCod_ingben char(6) ,
			@sdFecha_che smalldatetime ,
			@sdFeccom smalldatetime ,
			@iNumcom int
		-------
		declare 
			@dSaldoInicialCuenta decimal (18,2),
			@d
```

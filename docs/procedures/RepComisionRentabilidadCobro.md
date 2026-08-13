# SP: RepComisionRentabilidadCobro
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)
- [`saComisionResultado`](../tables/saComisionResultado.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/02/2011>
-- Last Update: <13/07/2020>
-- Description:	<RepComisionRentabilidadCobro>
-- =============================================
CREATE PROCEDURE [dbo].[RepComisionRentabilidadCobro]
	  @dFecha_d  DATETIME = NULL,
      @dFecha_h  DATETIME = NULL,
      @sCo_Ven_d CHAR(6) = NULL,
      @sCo_Ven_h  CHAR(6) = NULL,
      @sTipoRen  CHAR(6) = NULL,
	  @sCo_sucu CHAR(10) = NULL,
	  @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
--- Sit.#17953 (12/06/2017)-HZ -1:	Se agregó tabla temporal para trabajar con cursores y poder controlar mejor las diferentes 
---									transacciones en un mismo cobro. (Ej. Cobros con chq, que son devueltos después, etc.)
		BEGIN TRY
		IF EXISTS (SELECT * FROM  tempdb.sys.tables WHERE name like '%#comi_cob%')
				DROP TABLE  #comi_cob
		END TRY
		BEGIN CATCH 
			PRINT 'ERROR al crear la tabla temporal especifica (#comi_cob)'
		END CATCH
		CREATE TABLE #comi_cob (
			co_ven		VARCHAR(6), 
			co_cli		VARCHAR(16),
			fecha_cobro SMALLDATETIME,
			cli_des		VARCHAR(100),  --VARCHAR(60),
			fecha		SMALLDATETIME,
			fecha_hasta	SMALLDATETIME,
			fecha_desde	SMALLDATETIME,
			co_comi		VARCHAR(6),
			monto_01	DECIMAL(18,2),
			monto_02	DECIMAL(18,2),
			monto_03	DECIMAL(18,2),
			monto_04	DECIMAL(18,2),
			monto_05	DECIMAL(18,2),
			monto_06	DECIMAL(18,5),
			monto_07	DECIMAL(18,5),
			monto_08	DECIMAL(18,5),
			monto_09	DECIMAL(18,5),
			monto_10	DECIMAL(18,5),
			aux_01		VARCHAR(128),--VARCHAR(6),
			aux_02		VARCHAR(128),--VARCHAR(6),
			aux_03		VARCHAR(128),--VARCHAR(30),
			aux_04		VARCHAR(128),--VARCHAR(30),
			aux_05		VARCHAR(128),--VARCHAR(6),
			co_sucu_in	VARCHAR(6),
			tipo		VARCHAR(16),
			num_doc		VARCHAR(20),
			cob_num		VARCHAR(20),
			co_tipo_doc	CHAR(6),  --VARCHAR(6),
			mont_cob	DECIMAL(18,2),
			ven_des		VARCHAR(60),
			co_cli2		VARCHAR(16) --VARCHAR(10) 
		)   -- crea tabla temporal para grabar	
		INSERT INTO #comi_cob
--- Fin Sit.#17953 - 1

		SELECT F.co_ven, 
		F.co_cli,
		F.fecha as fecha_cobro, 
		C.cli_des, 
		CG.fecha, 
		CG.fecha_hasta, 
		CG.fecha_desde,
		CG.co_comi,		 
		CR.monto_01,
		CR.Monto_02, 
		CR.Monto_03, 
		CR.Monto_04, 
		CR.Monto_05, 
		CR.Monto_06,
		CR.Monto_07,
		CR.Monto_08,
		CR.Monto_09,
		CR.Monto_10,
		CR.Aux_01,
		CR.Aux_02,
		CR.Aux_03,
		CR.Aux_04,
		CR.Aux_05,
		FV.co_sucu_in, 
		CR.tablaOri
```

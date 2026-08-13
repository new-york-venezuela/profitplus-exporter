# SP: RepTransferenciaEntreCuentas
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <11/02/2015>
-- Modify date: <30/01/2019> Se Incorporó la Funcion CONVERT date(Fecha corta) para los parámetros y sus respectivos campos
-- Description:	<Reporte Transferencia Entre Cuentas>
-- LAST DATE:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepTransferenciaEntreCuentas]
	@sco_trans_ban_d CHAR(20) = NULL ,
    @scta_Origen_d CHAR(6) = NULL ,
    @scta_destino_d CHAR(6) = NULL ,
    @dfecha_d DateTime = NULL ,
	@dfecha_Origen_d DateTime = NULL ,
	@dfecha_Destino_d DateTime = NULL ,
    @scta_ingr_egr_origen_d CHAR(20) = NULL ,
	@scta_ingr_egr_destino_d CHAR(20) = NULL ,
    @sco_trans_ban_h CHAR(20) = NULL ,
    @scta_Origen_h CHAR(6) = NULL ,
    @scta_destino_h CHAR(6) = NULL ,
    @dfecha_h DateTime = NULL ,
	@dfecha_Origen_h DateTime = NULL ,
	@dfecha_Destino_h DateTime = NULL ,
    @scta_ingr_egr_origen_h CHAR(20) = NULL ,
	@scta_ingr_egr_destino_h CHAR(20) = NULL ,
	@sProcesado	CHAR(6) = 'TODO',
	@bHeaderRep BIT = 0 
AS 
    BEGIN
        SET NOCOUNT ON ;
		DECLARE @bProcesado BIT
		if @sProcesado < ='SIT '
			SET @bProcesado = 1
		else
			SET @bProcesado = 0
			
			

        SELECT        dbo.saTransferenciaEntreCuentas.co_trans_ban, dbo.saTransferenciaEntreCuentas.des_trans_ban, dbo.saTransferenciaEntreCuentas.fecha, 
                         dbo.saTransferenciaEntreCuentas.procesado, dbo.saTransferenciaEntreCuentas.monto, dbo.saTransferenciaEntreCuentas.comision, 
                         dbo.saTransferenciaEntreCuentas.cta_origen, dbo.saTransferenciaEntreCuentas.cta_ingr_egr_origen, dbo.saTransferenciaEntreCuentas.fecha_origen, 
                         dbo.saTransferenciaEntreCuentas.mov_ban_origen, dbo.saTransferenciaEntreCuentas.referencia_origen, dbo.saTransferenciaEntreCuentas.cta_comision, 
                         dbo.saTransferenciaEntreCuentas.cta_ingr_egr_comision, dbo.saTransferenciaEntreCuentas.mov_ban_comision, dbo.saTransferenciaEntreCuentas.cta_destino, 
                         dbo.saTransferenciaEntreCuentas.cta_ingr_egr_destino, dbo.saTransferenciaEntreCuentas.fecha_destino, dbo.saTransferenciaEntreCuentas.mov_ban_destino, 
                         dbo.saTransferenciaEntreCuentas.referencia_destino, dbo.saTransferenciaEntreCuentas.campo1, dbo.saTransferenciaEntreCuentas.campo2, 
                         dbo.saTransferenciaEntreCuentas.campo3, dbo.s
```

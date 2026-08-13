# SP: pSeleccionarTransferenciaEntreCuentas
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTransferenciaEntreCuentas
DESCRIPCION: Seleccion de un registro de la saTransferenciaEntreBancos
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarTransferenciaEntreCuentas] ( @sco_trans_ban CHAR(20) )
AS 
    BEGIN


		SELECT DISTINCT 
                         dbo.saTransferenciaEntreCuentas.co_trans_ban, dbo.saTransferenciaEntreCuentas.des_trans_ban, dbo.saTransferenciaEntreCuentas.fecha, 
                         dbo.saTransferenciaEntreCuentas.procesado, dbo.saTransferenciaEntreCuentas.monto, 
                         dbo.saTransferenciaEntreCuentas.comision, dbo.saTransferenciaEntreCuentas.cta_origen, dbo.saTransferenciaEntreCuentas.cta_ingr_egr_origen, 
                         dbo.saTransferenciaEntreCuentas.fecha_origen, dbo.saTransferenciaEntreCuentas.mov_ban_origen, dbo.saTransferenciaEntreCuentas.referencia_origen, dbo.saTransferenciaEntreCuentas.cta_comision, 
                         dbo.saTransferenciaEntreCuentas.cta_ingr_egr_comision, dbo.saTransferenciaEntreCuentas.mov_ban_comision, dbo.saTransferenciaEntreCuentas.referencia_comis, dbo.saTransferenciaEntreCuentas.cta_destino, 
                         dbo.saTransferenciaEntreCuentas.cta_ingr_egr_destino, dbo.saTransferenciaEntreCuentas.fecha_destino, dbo.saTransferenciaEntreCuentas.mov_ban_destino, dbo.saTransferenciaEntreCuentas.referencia_destino, 
                         dbo.saTransferenciaEntreCuentas.campo1, dbo.saTransferenciaEntreCuentas.campo2, dbo.saTransferenciaEntreCuentas.campo3, 
                         dbo.saTransferenciaEntreCuentas.campo4, dbo.saTransferenciaEntreCuentas.campo5, dbo.saTransferenciaEntreCuentas.campo6, 
                         dbo.saTransferenciaEntreCuentas.campo7, dbo.saTransferenciaEntreCuentas.campo8, dbo.saTransferenciaEntreCuentas.co_us_in, 
                         dbo.saTransferenciaEntreCuentas.co_sucu_in, dbo.saTransferenciaEntreCuentas.fe_us_in, dbo.saTransferenciaEntreCuentas.co_us_mo, 
                         dbo.saTransferenciaEntreCuentas.co_sucu_mo, dbo.saTransferenciaEntreCuentas.fe_us_mo, dbo.saTransferenciaEntreCuentas.revisado, 
                         dbo.saTransferenciaEntreCuentas.trasnfe, dbo.saTransferenciaEntreCuentas.validador, dbo.saTransferenciaEnt
```

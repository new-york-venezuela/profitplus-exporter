# SP: pValidarCostoAjusteReng
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2017-11-17>
-- Description:	<Validar el Costo de los Ajustes por Renglon>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarCostoAjusteReng]
       @AjueNumDesde as char(20),
       @AjueNumHasta as char(20)
AS 
BEGIN

declare @iDecCosto as int
declare @iTipoInventario as int

select @iDecCosto = i_dec_costo, @iTipoInventario = I_Costo_Inventario from par_emp

SET NOCOUNT ON;

if @iTipoInventario = 1 -- Costo promedio
       DECLARE RENGLONES_FIX CURSOR LOCAL FAST_FORWARD FOR
       select R.rowguid, R.cost_unit, ROUND(ISNULL(SUM(CS.cantidad * CS.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto)  as costo_new
             from saAjusteReng R
             INNER join saTipoAjuste TA on TA.co_tipo = R.co_tipo and TA.tipo_trans = 1
             LEFT join saCostoHistoricoSalida CS ON CS.doc_orig = R.rowguid 
             where 
             (@AjueNumDesde is null OR @AjueNumDesde <= R.ajue_num)
             and (@AjueNumHasta is null OR @AjueNumHasta >= R.ajue_num)
             group by R.rowguid, R.cost_unit
             having  ROUND(ISNULL(SUM(CS.cantidad * CS.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) <> R.cost_unit and ROUND(ISNULL(SUM(CS.cantidad * CS.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) > 0
else
       DECLARE RENGLONES_FIX CURSOR LOCAL FAST_FORWARD FOR
       select R.rowguid, R.cost_unit, ROUND(ISNULL(SUM(CS.cantidad * CE.costo) / sum(CS.cantidad),0.00000),@iDecCosto)  as costo_new 
             from saAjusteReng R
             INNER join saTipoAjuste TA on TA.co_tipo = R.co_tipo and TA.tipo_trans = 1
             LEFT join saCostoHistoricoSalida CS ON CS.doc_orig = R.rowguid 
             LEFT join saCostoHistoricoENTRADA CE ON CS.cod_costo_historico_entrada = CE.cod_costo_historico_entrada
             where 
                    (@AjueNumDesde is null OR @AjueNumDesde <= R.ajue_num)
             and (@AjueNumHasta is null OR @AjueNumHasta >= R.ajue_num)
             group by R.rowguid,R.cost_unit
             having  ROUND(ISNULL(SUM(CS.cantidad * CE.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) <> R.cost_unit and ROUND(ISNULL(SUM(CS.cantidad * CE.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) > 0

Declare @id as uniqueidentifier
Declare @OldCosto as decimal(18,5)
Declare @NewCosto as decimal(18,5)
DECLARE @PistaMensaje AS VARCHAR(MAX)
DECLARE @HoraC
```

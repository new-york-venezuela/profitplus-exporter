# SP: pValidarCostoArtCompuestoGenReng
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2017-11-17>
-- Description:	<Validar el Costo de los Articulos Compuestos Generados por Renglon>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarCostoArtCompuestoGenReng]
       @GeneNumDesde as char(20),
       @GeneNumHasta as char(20)
AS 
BEGIN

declare @iDecCosto as int
declare @iTipoInventario as int

select @iDecCosto = i_dec_costo, @iTipoInventario = I_Costo_Inventario from par_emp

SET NOCOUNT ON;

if @iTipoInventario = 1 -- Costo promedio
       DECLARE RENGLONES_FIX CURSOR LOCAL FAST_FORWARD FOR
       select R.rowguid, R.cost_unit, ROUND(ISNULL(SUM(CS.cantidad * CS.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto)  as costo_new
             from saArtCompuestoGenReng R
             LEFT join saCostoHistoricoSalida CS ON CS.doc_orig = R.rowguid 
             where 
             (@GeneNumDesde is null OR @GeneNumDesde <= R.gene_num)
             and (@GeneNumHasta is null OR @GeneNumHasta >= R.gene_num)
             group by R.rowguid, R.cost_unit
             having  ROUND(ISNULL(SUM(CS.cantidad * CS.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) <> R.cost_unit and ROUND(ISNULL(SUM(CS.cantidad * CS.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) > 0
else
       DECLARE RENGLONES_FIX CURSOR LOCAL FAST_FORWARD FOR
       select R.rowguid, R.cost_unit, ROUND(ISNULL(SUM(CS.cantidad * CE.costo) / sum(CS.cantidad),0.00000),@iDecCosto)  as costo_new 
             from saArtCompuestoGenReng R
             LEFT join saCostoHistoricoSalida CS ON CS.doc_orig = R.rowguid 
             LEFT join saCostoHistoricoENTRADA CE ON CS.cod_costo_historico_entrada = CE.cod_costo_historico_entrada
             where 
                    (@GeneNumDesde is null OR @GeneNumDesde <= R.gene_num)
             and (@GeneNumHasta is null OR @GeneNumHasta >= R.gene_num)
             group by R.rowguid,R.cost_unit
             having  ROUND(ISNULL(SUM(CS.cantidad * CE.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) <> R.cost_unit and ROUND(ISNULL(SUM(CS.cantidad * CE.costo_pro) / sum(CS.cantidad),0.00000),@iDecCosto) > 0

Declare @id as uniqueidentifier
Declare @OldCosto as decimal(18,5)
Declare @NewCosto as decimal(18,5)
DECLARE @PistaMensaje AS VARCHAR(MAX)
DECLARE @HoraCorrida DATETIME

OPEN RENGLONES_FIX
FETCH NEXT FROM RENGLONES_FIX INTO @id, @OldCosto, @NewCosto

WHILE @@FETCH_STATUS = 0
```

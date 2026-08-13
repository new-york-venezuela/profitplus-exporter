# SP: RepInfContableCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`scCentro`](../tables/scCentro.md)
- [`scCuenta`](../tables/scCuenta.md)
- [`scGastos`](../tables/scGastos.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23-07-2014>
-- Description:	<Información Contable de Cliente>
-- =============================================
CREATE PROCEDURE [dbo].[RepInfContableCliente]
	@sCo_Cli_d CHAR(16) = NULL,
	@sCo_Cli_h CHAR(16) = NULL,
	@sTip_Cli_d CHAR(6) = NULL,
	@sTip_Cli_h CHAR(6) = NULL,
	@sCo_Ven_d CHAR(6) = NULL,
	@sCo_Ven_h CHAR(6) = NULL,
	@sCo_Zon_d CHAR(6) = NULL,
	@sCo_Zon_h CHAR(6) = NULL,
	@sCo_Cue_d CHAR(20) = NULL,
	@sCo_Cue_h CHAR(20) = NULL,
	@sCo_Gas_d CHAR(6) = NULL,
	@sCo_Gas_h CHAR(6) = NULL,
	@sCo_NumCarp_d CHAR(6) = NULL,
	@sCo_NumCarp_h CHAR(6) = NULL,
	@sCo_Sucursal CHAR(6) = NULL,
	@sCampOrderBy VARCHAR(16) = NULL,
	@sDir VARCHAR(6) = NULL,
	@bHeaderRep BIT = 0
AS
BEGIN
	SET NOCOUNT ON;
	Select A.co_cli, A.num_carp, A.Descripcion, case when ltrim(A.monto) = '' then 0 else cast(A.monto as decimal(18,5)) end as monto,
	A.co_cue, A.co_gas, A.co_cen, A.des_cen, case when ltrim(A.porc) = '' then 0 else cast (A.porc as decimal(18,5)) end as porc, 
	CLI.cli_des,
	CUE.des_cue,
	GAS.des_gas
	FROM(

	Select	A.co_cli, '01' as num_carp,
		A.dis_cen.query( '/InformacionContable/Carpeta01/Descripcion').value('/','varchar(128)') as Descripcion, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/Monto').value('/','varchar(18)') as monto, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/CuentaContable').value('/','varchar(20)') as co_cue, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/CuentaGasto').value('/','varchar(8)') as co_gas, 
		C.N.value('(Codigo)[1]', 'varchar(6)') as co_cen,
		(select des_cen from scCentro where co_cen=C.N.value('(Codigo)[1]', 'varchar(6)')) as des_cen,
		C.N.value('(Porcentaje)[1]', 'varchar(12)') as porc
	from	saCliente A
		outer apply A.dis_cen.nodes('InformacionContable/Carpeta01/DistribucionCentros/CentroCosto') as C(N)
	Where 
		((@sCo_Cli_d IS NULL OR A.co_cli >= @sCo_Cli_d)		AND (@sCo_Cli_h IS NULL OR A.co_cli <= @sCo_Cli_h))
	AND ((@sTip_Cli_d IS NULL OR A.tip_cli >= @sTip_Cli_d)	AND (@sTip_Cli_h IS NULL OR A.tip_cli <= @sTip_Cli_h))
	AND ((@sCo_Ven_d IS NULL OR A.co_ven >= @sCo_Ven_d)		AND (@sCo_Ven_h IS NULL OR A.co_ven <= @sCo_Ven_h))
	AND ((@sCo_Zon_d IS NULL OR A.co_zon >= @sCo_Zon_d)		AND (@sCo_Zon_h IS NULL OR A.co_zon <= @sCo_Zon_h))
	AND (@sCo_Sucursal IS NULL OR A.co_sucu_in = @sCo_Sucursal)
	AND	((@sCo_NumCarp_d IS NULL OR '01' >= @sCo_NumCarp_d)	AND ( @sCo_NumCarp_h I
```

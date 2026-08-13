# SP: RepInfContableDepositoBanco
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`scCentro`](../tables/scCentro.md)
- [`scCuenta`](../tables/scCuenta.md)
- [`scGastos`](../tables/scGastos.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2014-08-07>
-- Description:	<Información Contable Deposito de Banco>
-- =============================================
CREATE PROCEDURE [dbo].[RepInfContableDepositoBanco]
	@sNumero_d CHAR(20) = NULL,
	@sNumero_h CHAR(20) = NULL,
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
	@sCod_Cta_d CHAR(6) = NULL,
    @sCod_Cta_h CHAR(6) = NULL,
	@sCo_Cta_d CHAR(20) = NULL,
	@sCo_Cta_h CHAR(20) = NULL,
	@dFechaInt_d SMALLDATETIME = NULL,
	@dFechaInt_h SMALLDATETIME = NULL,
	@iNum_Com_d INT = NULL,
	@iNum_Com_h INT = NULL,
	@sCo_Cue_d CHAR(20) = NULL,
	@sCo_Cue_h CHAR(20) = NULL,
	@sCo_Gas_d CHAR(6) = NULL,
	@sCo_Gas_h CHAR(6) = NULL,
	@sCo_NumCarp_d CHAR(6) = NULL,
	@sCo_NumCarp_h CHAR(6) = NULL,
	@sFil_Fecha CHAR(4) = NULL,
	@sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS
BEGIN
	SET NOCOUNT ON;
  
  If @sFil_Fecha IS NULL
	set @sFil_Fecha='NO'
  
  IF @dFecha_d IS NOT NULL
	set @dFecha_d = dbo.FechaSimple(@dFecha_d)
  
  IF @dFecha_h IS NOT NULL
	set @dFecha_h = dbo.FechaSimple(@dFecha_h)

  IF @dFechaInt_d IS NOT NULL
	set @dFechaInt_d = dbo.FechaSimple(@dFechaInt_d)

  IF  @dFechaInt_h IS NOT NULL
	set @dFechaInt_h = dbo.FechaSimple(@dFechaInt_h)

  Select A.dep_num, BAN.fecha, BAN.feccom, BAN.numcom, A.num_carp, A.Descripcion,
  case when ltrim(A.monto) = '' then 0 else cast(A.monto as decimal(18,5)) end as monto, A.co_cue, A.co_gas, 
  A.co_cen, A.des_cen, case when ltrim(A.porc) = '' then 0 else cast(A.porc as decimal(18,5)) end as porc, 
  CUE.des_cue, 
  GAS.des_gas
 From (

 Select	A.dep_num, A.feccom, '01' as num_carp,
		A.dis_cen.query( '/InformacionContable/Carpeta01/Descripcion').value('/','varchar(128)') as Descripcion, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/Monto').value('/','varchar(18)') as monto, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/CuentaContable').value('/','varchar(20)') as co_cue, 
		A.dis_cen.query( '/InformacionContable/Carpeta01/CuentaGasto').value('/','varchar(8)') as co_gas, 
		C.N.value('(Codigo)[1]', 'varchar(6)') as co_cen,
		(select des_cen from scCentro where co_cen=C.N.value('(Codigo)[1]', 'varchar(6)')) as des_cen,
		C.N.value('(Porcentaje)[1]', 'varchar(12)') as porc
from	saDepositoBanco A
		outer apply A.dis_cen.nodes('InformacionContable/Carpeta01/
```

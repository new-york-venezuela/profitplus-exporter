# SP: pValidarIntegracionesAdm
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <26/02/2018>
-- Description:	<Valida los comprobantes de diario con sus respectivas integraciones
-- solo 2K12
-- =============================================
CREATE PROCEDURE [dbo].[pValidarIntegracionesAdm]
	(
		@bCorregir BIT = 0, 
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
BEGIN

	SET NOCOUNT ON;
	declare @empcont char(25)
	declare @empadm char(25)
	Declare @SQL Varchar(Max);
--- Validando en Administrativo
	select @empcont = emp_cont from par_emp
	select @empadm = cod_emp from par_emp
    if @empcont = ''
         raiserror ('No se encuentra la empresa de Contabilidad. ',16,1)


	set @sql = 'select numcom as num_compro,feccom as fec_compro,saintegr.inte_num as inte_num, ''I01'' as tipo,''La integración '' + str(ltrim(rtrim(saintegr.inte_num))) + 
				 '' Genero el comprobante ''+ str(ltrim(rtrim(numcom))) +'' que no existe en contabilidad. *NC '' as motivo from '+@empadm+'.dbo.saintegr where inte_num > 0 and numcom <> '''' and numcom not in (select comp_num from '+@empcont+'.dbo.sccompro) and saintegr.numcom is not null order by saintegr.numcom'


	Exec(@SQL)


END
```

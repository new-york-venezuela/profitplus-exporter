# SP: RepPistasAutenticacionPuntoVenta
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saPista`](../tables/saPista.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08-08-2014>
-- Description:	<Pistas de Autenticación al Sistema>
-- =============================================
CREATE PROCEDURE [dbo].[RepPistasAutenticacionPuntoVenta]
	@dFecha_d SMALLDATETIME = NULL,
	@dFecha_h SMALLDATETIME = NULL,
	@sUsuario_d CHAR(6) = NULL,
	@sUsuario_h CHAR(6) = NULL,
	@sTipo_Op CHAR(6) = NULL,
	@sCo_Sucursal CHAR(6) = NULL,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS
BEGIN
	SET NOCOUNT ON;

	IF @dFecha_d IS NOT NULL
		set @dFecha_d = dbo.FechaSimple(@dFecha_d)

	IF @dFecha_h IS NOT NULL
		set @dFecha_h = dbo.FechaSimple(@dFecha_h)
		declare @sTabla as CHAR(10)
		IF @sTipo_Op = 'E'
			set @sTabla = 'pvLogOut'
		else
			set @sTabla = 'pvLogIn'

	select B.fecha_ini, B.fecha_fin, B.rowguidOri as idsession,	P.fecha, P.tablaOri, P.maquina, 
		P.usuario_id, P.co_sucu, case when ltrim(P.tablaOri) = 'pvLogOut' then 'S' else P.tipo_op end as tipo_op, P.campos
	from 	saPista P	
	inner join
	(select rowguidOri, min(fecha) as fecha_ini, max(fecha) as fecha_fin
	from	saPista
	where tablaOri in('pvLogIn','pvLogOut')
	group by rowguidOri) B
	ON B.rowguidOri = P.rowguidOri
	where P.tablaOri in('pvLogIn','pvLogOut') 
		AND ((@sUsuario_d iS NULL OR usuario_id >= @sUsuario_d) AND (@sUsuario_h IS NULL OR usuario_id <= @sUsuario_h))
		AND ((@dFecha_d IS NULL OR dbo.FechaSimple(B.fecha_ini) >= @dFecha_d) AND (@dFecha_h IS NULL OR dbo.FechaSimple(B.fecha_fin) <= @dFecha_h))
		AND (@sTipo_Op IS NULL OR @sTipo_Op='TODO' OR (P.tablaOri = @sTabla))
		AND (@sCo_Sucursal IS NULL OR co_sucu = @sCo_Sucursal)
	Order by B.fecha_ini Desc    
END
```

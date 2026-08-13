# SP: pvpConsultarTurno
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: PV_pActualizarConfigPuntoV
*DESCRIPCIÓN	: Consulta turnos
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpConsultarTurno]
	@sNumTurno_D CHAR(20) = NULL ,
    @sNumTurno_H CHAR(20) = NULL ,
    @sCoTurno_D CHAR(6) = NULL ,
    @sCoTurno_H CHAR(6) = NULL ,
    @sCoCaja_D CHAR(6) = NULL ,
    @sCoCaja_H CHAR(6) = NULL ,
    @sCoUserCaja_D CHAR(6) = NULL ,
    @sCoUserCaja_H CHAR(6) = NULL ,
    @sCoUserSuper_D CHAR(6) = NULL ,
    @sCoUserSuper_H CHAR(6) = NULL ,
    @sdFechaInit_D smalldatetime = NULL ,
    @sdFechaInit_H smalldatetime = NULL ,
    @sdFechaFin_D smalldatetime = NULL ,
    @sdFechaFin_H smalldatetime = NULL ,
    @sStatus CHAR(10) = NULL ,
    @iRestringe int = NULL
AS
BEGIN
	SET NOCOUNT ON;

	SELECT num_turno , status, cod_caja, co_turno, fecha_ini, fecha_fin, user_caj, user_sup, restringe, saldo
	from pvTurnoExe as turno
	where	( rtrim(ltrim(num_turno)) >= rtrim(ltrim(@sNumTurno_D))		or @sNumTurno_D		is null ) and
			( rtrim(ltrim(num_turno)) <= rtrim(ltrim(@sNumTurno_H))		or @sNumTurno_H		is null ) and
			( co_turno >= @sCoTurno_D		or @sCoTurno_D		is null ) and
			( co_turno <= @sCoTurno_H		or @sCoTurno_H		is null ) and
			( cod_caja >= @sCoCaja_D		or @sCoCaja_D		is null ) and
			( cod_caja <= @sCoCaja_H		or @sCoCaja_H		is null ) and
			( user_caj >= @sCoUserCaja_D	or @sCoUserCaja_D	is null ) and
			( user_caj <= @sCoUserCaja_H	or @sCoUserCaja_H	is null ) and
			( user_sup >= @sCoUserSuper_D	or @sCoUserSuper_D	is null ) and
			( user_sup <= @sCoUserSuper_H	or @sCoUserSuper_H	is null ) and
			( dbo.FechaSimple(fecha_ini) >= @sdFechaInit_D	or @sdFechaInit_D	is null ) and
			( dbo.FechaSimple(fecha_ini) <= @sdFechaInit_H	or @sdFechaInit_H	is null ) and
		    ( dbo.FechaSimple(fecha_fin) >= @sdFechaFin_D	or @sdFechaFin_D	is null ) and
			( dbo.FechaSimple(fecha_fin) <= @sdFechaFin_H	or @sdFechaFin_H	is null ) 
			and
			( exists (select * from dbo.SplitString(rtrim(ltrim(@sStatus)),'-') where part = rtrim(ltrim(turno.status)))  or @sStatus	is null ) and
			( @iRestringe = restringe		or @iRestringe		= -1 or @iRestringe is null)
END
```

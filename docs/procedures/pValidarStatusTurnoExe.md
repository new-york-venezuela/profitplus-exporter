# SP: pValidarStatusTurnoExe
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`pvCobroExt`](../tables/pvCobroExt.md)
- [`pvDevolucionClienteExt`](../tables/pvDevolucionClienteExt.md)
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarStatusTurnoExe]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

Declare @num_turno  char(20)
Declare @estado  char(2)
Declare @NumFacturas int
Declare @NumCobros int
Declare @NumDevCli int
Declare @NumMovCaj int
Declare @FechaFin datetime 
Declare @Id uniqueidentifier

DECLARE @ValResult TABLE ( Motivo VARCHAR(256) )
DECLARE @strMensaje varchar(256)
DECLARE @HoraCorrida DATETIME
DECLARE @bError bit
Declare @estadoNew  char(2)

DECLARE VALIDAR_TURNO_CARAC CURSOR LOCAL FAST_FORWARD
FOR 
	select T.num_turno, T.status, 
	(select count(*) from [dbo].[pvFacturaVentaExt] F where F.rowguid_num_turno = T.rowguid) as NumFacturas,
	(select count(*) from [dbo].[pvCobroExt] C where C.rowguid_num_turno = T.rowguid) as NumCobros,
	(select count(*) from [dbo].[pvDevolucionClienteExt] D where D.rowguid_num_turno = T.rowguid) as NumDevCli,
	(select count(*) from [dbo].[pvMovimientoCajaExt] M where M.rowguid_num_turno = T.rowguid) as NumMovCaj,
	T.fecha_fin, T.rowguid 
	from [dbo].[pvTurnoExe] T

OPEN VALIDAR_TURNO_CARAC
FETCH NEXT FROM VALIDAR_TURNO_CARAC INTO @num_turno, @estado, @NumFacturas, @NumCobros,
	@NumDevCli, @NumMovCaj,@FechaFin, @Id 


WHILE @@FETCH_STATUS = 0 
BEGIN
	Set @bError = 0

	If (@estado = 'E')
	Begin
		If (@NumFacturas>0 OR  @NumCobros>0 or 	@NumDevCli > 0 OR @NumMovCaj> 0)
		Begin
			Set @bError = 1
			Set @estadoNew = 'A'
		End
	End

	If (@estado = 'A')
	Begin
		If (@NumFacturas=0 AND  @NumCobros=0 AND @NumDevCli = 0 AND @NumMovCaj = 0 AND @FechaFin >= getdate())
		Begin
			Set @bError = 1
			Set @estadoNew = 'E'
		End
	End


	SET @HoraCorrida = GETDATE()
	if (@bError = 1)
	Begin
		Set @strMensaje = 'El número de turno de punto de venta "' + rtrim(@num_turno) + '" tiene como estado "' + rtrim(@estado) + '" y el correcto es "' + rtrim(@estadoNew) + '".'

		INSERT  INTO @ValResult ( Motivo ) VALUES (@strMensaje)

		IF ( @bCorregir = 1 )
		Begin
			UPDATE [pvTurnoExe] set status = @estadoNew where rowguid = @id
			EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida,
				@sCo_Sucu = NULL, @sTablaOri = 'pvTurnoExe', @rowguidOri = @id,
                @sTipo_Op = N'M', @sMaquina = NULL, @sCampos = @strMensaje
		End

		EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                    @sTablaOri = 'pvTurnoExe', @rowguidO
```

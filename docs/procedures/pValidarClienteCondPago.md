# SP: pValidarClienteCondPago
**Tipo**: Validar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <21/06/2017>
-- Last Update date: <2017-06-27>
-- Description:	<Validacion Condicion de Pago de Clientes>
-- =============================================
Create PROCEDURE [dbo].[pValidarClienteCondPago]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(384) )
	DECLARE STATUS_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            select E.co_cli, E.cond_pag from saCliente E
		where  not exists (select * from saCondicionPago R Where R.co_cond = E.cond_pag) 


		OPEN STATUS_VALIDAR

		DECLARE @PistaMensaje AS VARCHAR(MAX)
		DECLARE @pCo_cli char(16)
		DECLARE @pCond_pag char(6)
		DECLARE @HoraCorrida DATETIME
		DECLARE @Hostname varchar (60)
		Set @Hostname = Host_NAME()

		FETCH NEXT FROM STATUS_VALIDAR 
	    INTO @pCo_cli, @pCond_pag

        WHILE @@FETCH_STATUS = 0 
		BEGIN
				if (@pCond_pag Is not Null)
				begin
                SET @PistaMensaje = 'El cliente de codigo "' + RTRIM(@pCo_cli)
                    + '" posee condicion de pago "'+RTRIM(@pCond_pag) + '" que no se encuentra definida. NC' 
        
			   SET @HoraCorrida = GETDATE()
                EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                    @sTablaOri = 'saCliente', @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = @Hostname,
                    @sCampos = @PistaMensaje
				
			    INSERT  INTO @ValStatusResult
                        ( Motivo )
                VALUES
                        ( @PistaMensaje )
				end
                FETCH NEXT FROM STATUS_VALIDAR 
			INTO @pCo_cli, @pCond_pag
			
        END    

        CLOSE STATUS_VALIDAR

        DEALLOCATE STATUS_VALIDAR

        SELECT
            *
        FROM
            @ValStatusResult

    END
```

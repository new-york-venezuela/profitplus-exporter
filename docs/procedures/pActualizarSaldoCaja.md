# SP: pActualizarSaldoCaja
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************
*NOMBRE:		pActualizarSaldoCaja
*DESCRIPCIÓN:	Actualiza Saldo de caja
*AUTOR:			SOFTECH SISTEMAS
***********************************************************************/

CREATE PROCEDURE [dbo].[pActualizarSaldoCaja]
    (
      @sCodigo CHAR(6) ,
      @sCodigoOri CHAR(6) ,
      @sTipo CHAR(2) ,
      @sTipoOri CHAR(2) ,
      @deSaldo DECIMAL(18, 2) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 

    )
AS 
    BEGIN           
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              saldo DECIMAL(18, 2)
            )
        DECLARE @intResultado INT
             
        UPDATE
            saSaldoCaja
        SET tipo = @sTipo,
                    cod_caja = @sCodigo,
                    saldo = saldo + @deSaldo
        OUTPUT
            inserted.validador, inserted.saldo
            INTO @TableTimestamp
        WHERE
            cod_caja = @sCodigoOri
            AND tipo = @sTipoOri
             --En caso de no existir
        SELECT
            @intResultado = COUNT(*)
        FROM
            @TableTimestamp
        IF ( @intResultado = 0 ) 
            BEGIN
                INSERT  INTO saSaldoCaja
                        ( cod_caja, tipo, saldo, revisado, trasnfe )
                OUTPUT  inserted.validador, inserted.saldo
                        INTO @TableTimestamp
                VALUES
                        ( @sCodigo, @sTipo, @deSaldo, NULL, NULL )
            END
    END
```

# SP: pActualizarSaldoBanco
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/**********************************************************************
*NOMBRE:		pActualizarSaldoBanco
*DESCRIPCIÓN:	Actualiza Saldo de una cuenta bancaria (NOTA: se asume el tipo D <Disponible> como total)
*AUTOR:			SOFTECH SISTEMAS
***********************************************************************/

CREATE PROCEDURE [pActualizarSaldoBanco]
    (
      @sCodigo CHAR(6) ,
      @sCodigoOri CHAR(6) ,
      @sTipo CHAR(2) ,
      @sTipoOri CHAR(2) ,
      @deSaldo DECIMAL(18, 2) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    SET NOCOUNT ON 
    BEGIN         
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              saldo DECIMAL(18, 2)
            )
        DECLARE @intResultado INT
            
        UPDATE
            saSaldoBanco
        SET saldo = saldo + @deSaldo
        OUTPUT
            inserted.validador, inserted.saldo
            INTO @TableTimestamp
        WHERE
            cod_cta = @sCodigoOri
            AND tipo = @sTipoOri
            --En caso de no existir
        SELECT
            @intResultado = COUNT(*)
        FROM
            @TableTimestamp
        IF ( @intResultado = 0 ) 
            BEGIN
                INSERT  INTO saSaldoBanco
                        ( cod_cta, tipo, saldo, revisado, trasnfe )
                OUTPUT  inserted.validador, inserted.saldo
                        INTO @TableTimestamp
                VALUES
                        ( @sCodigo, @sTipo, @deSaldo, NULL, NULL )
            END
    END
    SET NOCOUNT OFF
```

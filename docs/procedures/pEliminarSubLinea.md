# SP: pEliminarSubLinea
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saColor`](../tables/saColor.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pEliminarSubLinea]
*DESCRIPCIÓN	:	Elimina un registro en la tabla  sub_lin
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [pEliminarSubLinea]
    (
      @sCo_SublOri CHAR(6) ,
      @sCo_LinOri CHAR(6) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saSubLinea
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_subl = @sCo_SublOri
            AND co_lin = @sCo_LinOri
            AND validador = @tsValidador

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
				-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saColor', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_SublOri
            END

    END
```

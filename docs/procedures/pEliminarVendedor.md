# SP: pEliminarVendedor
**Tipo**: Eliminar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pEliminarVendedor
*DESCRIPCIÓN	: Elimina un Vendedor
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pEliminarVendedor]
    (
      @sCo_VenOri CHAR(6) ,
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
            saVendedor
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_ven = @sCo_VenOri
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
                    @sTablaOri = 'saVendedor', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_VenOri
            END
			
    END
```

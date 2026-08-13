# SP: pEliminarLineaArticulo
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarTablaLin_Art
DESCRIPCION: Eliminar Tabla Lin_Art
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarLineaArticulo]
    (
      @sCo_LinOri CHAR(6) ,
      @tsValidador TIMESTAMP = NULL ,
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
            saLineaArticulo
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_lin = @sCo_LinOri
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
                    @sTablaOri = 'saLineaArticulo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_LinOri
            END
    END
```

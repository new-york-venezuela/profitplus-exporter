# SP: pEliminarTipoProveedor
**Tipo**: Eliminar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pEliminarTablaTipo_Pro
*DESCRIPCIÓN	:	Elimina un registro en la tabla  tipo_pro
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarTipoProveedor]
    (
      @sTip_ProOri CHAR(6) ,
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
            saTipoProveedor
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            tip_pro = @sTip_ProOri
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
                    @sTablaOri = 'saTipoProveedor', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sTip_ProOri
            END

    END
```

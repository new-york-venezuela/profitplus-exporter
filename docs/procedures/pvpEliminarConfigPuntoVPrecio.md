# SP: pvpEliminarConfigPuntoVPrecio
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvConfigPuntoVPrecio`](../tables/pvConfigPuntoVPrecio.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpEliminarConfigPuntoVPrecio
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tablapvConfigPuntoVPrecio
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpEliminarConfigPuntoVPrecio]
    (
      @sCo_ConfigOri CHAR(6) ,
      @sCo_Precio CHAR(6) ,
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
            pvConfigPuntoVPrecio
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_config = @sCo_ConfigOri
            AND co_precio = @sCo_Precio


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
                    @sTablaOri = 'pvConfigPuntoVPrecio', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCo_ConfigOri
            END
    END
```

# SP: pEliminarRenglonesPrecioArticulo
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesPrecioArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
FECHA: 19/08/2009
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesPrecioArticulo]
    (
      @iRENG_NUMOri INT ,
      @sCo_ArtOri CHAR(30) ,
      @sCo_PrecioOri CHAR(6) ,
      @sCo_AlmaOri CHAR(6) ,
      @sCo_Alma_CalculadoOri CHAR(6) ,
      @dDesdeOri DATETIME ,
      @bPrecioOmOri BIT ,
      @sco_mone CHAR(6) = NULL,
      @binactivo BIT = NULL,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
       
    )
AS 
    BEGIN
       
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
             
        DELETE FROM
            saArtPrecio
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_precio = @sCo_PrecioOri
            AND co_alma_calculado = @sCo_Alma_CalculadoOri
            AND desde = @dDesdeOri
            AND precioOm = @bPrecioOmOri
             
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
                    @sTablaOri = 'saArtPrecio', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ArtOri
            END            

    END
```

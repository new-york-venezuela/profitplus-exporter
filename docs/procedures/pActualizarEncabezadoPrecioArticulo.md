# SP: pActualizarEncabezadoPrecioArticulo
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <18/11/2009>
-- Description:	<Actualiza el Encabezado del Renglon para Indicar que cambio>
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarEncabezadoPrecioArticulo]
    (
      @sCo_Art CHAR(30) ,
      @sCo_TipoPrecio CHAR(4) = NULL ,
      @sCo_Alma CHAR(6) = NULL ,
      @dDesde DATETIME = NULL ,
      @dHasta DATETIME = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 			
	
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        DECLARE @dtFe_In DATETIME

        DECLARE @rowGuidOri UNIQUEIDENTIFIER
			
        UPDATE
            saArticulo
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_Art
            AND validador = @tsValidador

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saArticulo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
			@sCampos = 'Actualización de renglón.'

        SELECT
            *
        FROM
            @TableTimestamp

    END
```

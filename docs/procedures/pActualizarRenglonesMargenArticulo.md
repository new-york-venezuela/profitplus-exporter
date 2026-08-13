# SP: pActualizarRenglonesMargenArticulo
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pActualizarTabla saMargenArticulo 
*DESCRIPCIÓN	:	Actualiza un registro en la tabla  margen
*AUTOR			:	Softech Sistemas
******************************************************************/

CREATE PROCEDURE [pActualizarRenglonesMargenArticulo]
    (
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @sco_art CHAR(30) ,
      @sco_artOri CHAR(30) ,
      @sCo_Precio CHAR(6) ,
      @sCo_PrecioOri CHAR(6) ,
      @demonto_min DECIMAL(18, 5) ,
      @demonto_max DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp AS TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        UPDATE
            saArtMargen
        SET co_art = @sco_art, co_precio = @sCo_Precio, monto_min = @demonto_min, monto_max = @demonto_max,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sco_artOri
            AND co_precio = @sCo_PrecioOri
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtMargen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos			
            END
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```

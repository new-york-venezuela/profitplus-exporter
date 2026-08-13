# SP: pInsertarImagenArticulo
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtImagen`](../tables/saArtImagen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pInsertarImagenArticulo
*DESCRIPCIÓN	: Inserta la imagen de un articulo
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pInsertarImagenArticulo]
    (
      @sCo_Art CHAR(30) ,
      @sTip CHAR(6) ,
      @sImagen_Des VARCHAR(60) = NULL ,
      @baPicture VARBINARY(MAX) = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @srevisado CHAR(1) ,
      @strasnfe CHAR(1)
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

        INSERT  INTO saArtImagen
                ( co_art, tip, imagen_des, picture, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, revisado, trasnfe, co_us_mo, co_sucu_mo, fe_us_mo )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Art, @sTip, @sImagen_Des, @baPicture, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Us_In, @sCo_sucu_In, GETDATE(), @srevisado, @strasnfe, @sCo_Us_In,
                  @sCo_sucu_In, GETDATE() )
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saImagenArtic', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Art			
					
        SELECT
            *
        FROM
            @TableTimestamp

    END
```

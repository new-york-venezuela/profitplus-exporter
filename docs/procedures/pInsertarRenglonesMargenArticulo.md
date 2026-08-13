# SP: pInsertarRenglonesMargenArticulo
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarTablaMargenArticulo 
*DESCRIPCIÓN	:	Inserta un registro en la tabla  Margen de Articulo
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pInsertarRenglonesMargenArticulo]
    (
      @iRENG_NUM INT ,
      @sco_art CHAR(30) ,
      @sCo_Precio CHAR(6) ,
      @demonto_min DECIMAL(18, 5) ,
      @demonto_max DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp AS TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        INSERT  INTO saArtMargen
                ( co_art, co_precio, monto_min, monto_max, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo,
                  fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sco_art, @sCo_Precio, @demonto_min, @demonto_max, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sTrasnfe, @sRevisado )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtMargen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sco_art			
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```

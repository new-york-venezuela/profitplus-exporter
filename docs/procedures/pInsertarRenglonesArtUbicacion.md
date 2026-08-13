# SP: pInsertarRenglonesArtUbicacion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtUbicacion`](../tables/saArtUbicacion.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarArtUbicacion
*DESCRIPCIÓN	:	Inserta un registro en la tabla saArtUbicacion
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [dbo].[pInsertarRenglonesArtUbicacion]
    (
      @iRENG_NUM INT ,
	  @sCo_Art CHAR(30) ,
	  @sCo_Alma CHAR(6) ,
	  @sCo_Ubicacion CHAR(6) ,
	  @sCo_Ubicacion2 CHAR(6) = NULL,
	  @sCo_Ubicacion3 CHAR(6) = NULL,
	  @sDes_Ubicacion VARCHAR(120) = NULL,
	  @iOrden INT,
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
		
        INSERT  INTO saArtUbicacion
                ( co_art, co_alma, co_ubicacion, co_ubicacion2, co_ubicacion3, des_ubicacion, orden,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                (@sCo_Art, @sCo_Alma, @sCo_Ubicacion, @sCo_Ubicacion2, @sCo_Ubicacion3, @sDes_Ubicacion,
				@iOrden, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
				@sTrasnfe, @sRevisado )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @sCamposI NVARCHAR(70)

		SET @sCamposI = @sCo_Art + ', ' + @sCo_Alma + ', ' + @sCo_Ubicacion + ', ' + @sCo_Ubicacion2 + ', ' + @sCo_Ubicacion3

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtUbicacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCamposI
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```

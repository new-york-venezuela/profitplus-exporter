# SP: pActualizaNumeroLote
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pValidarExistenciaLote]
*DESCRIPCIÓN	: Validar existencia del lote en saLote
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-10-08
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizaNumeroLote]
    (
	  @sCo_Art CHAR (30),
	  @sNumeroLoteOld VARCHAR(250)  , 
	  @sNumeroLoteNew VARCHAR(250) , 
	  @sMaquina VARCHAR(60) = NULL ,
	  @sCo_Sucu_Mo CHAR(6) ,
	  @sCo_Us_Mo CHAR(6)  , 
	   @sCampos VARCHAR(MAX) = NULL 

    --  @gRowguid UNIQUEIDENTIFIER
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

		SELECT @sNumeroLoteOld , @sNumeroLoteNew  


        IF NOT EXISTS(SELECT * FROM saLoteEntrada WHERE co_art = @sCo_Art  AND numero_lote = @sNumeroLoteOld  ) 
			AND	NOT EXISTS(SELECT * FROM saLoteSalida WHERE co_art = @sCo_Art  AND numero_lote = @sNumeroLoteOld )
			BEGIN 

				RAISERROR('Para este artículo no hay lotes que se puedan modificar. ',16,1)
                RETURN ;
			END 

			-- Si hay en Lote de entrada  >> 

			UPDATE saLoteEntrada SET numero_lote =  @sNumeroLoteNew 
			 OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
			WHERE co_art = @sCo_Art  AND numero_lote = @sNumeroLoteOld


		-- Si hay en lote de Salida 
 
			UPDATE saLoteSalida SET numero_lote =  @sNumeroLoteNew 
			 OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
			WHERE co_art = @sCo_Art   AND numero_lote = @sNumeroLoteOld


			   SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = (SELECT rowguid from saArticulo where co_art = @sCo_Art )
        FROM
            @TableTimestamp



        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArticulo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
					@sCampos = @sCampos
            END




    END
```

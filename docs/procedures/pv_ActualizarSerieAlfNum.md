# SP: pv_ActualizarSerieAlfNum
**Tipo**: PV-Actualizar
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ActualizarSerieAlfNum]
*DESCRIPCIÓN	: ACTUALIZA EL NUMERO DE SERIE YA SEA NUMERICO O ALFANUMERICO
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarSerieAlfNum]
	 (
		@Co_Serie			CHAR(20) ,
		@Prox_n				BIGINT				=	NULL ,
		@Prox_a				CHAR(20)			=	NULL ,
		@sCo_Us_Mo			CHAR(6) ,
		@sCo_Sucu_Mo		CHAR(6)				=	NULL ,
		@sMaquina			VARCHAR(60)			=	NULL ,
		@sCampos			VARCHAR(MAX)		=	NULL ,
		@sRevisado			CHAR(1) ,
		@sTrasnfe			CHAR(1) ,
		@tsValidador		TIMESTAMP			=	NULL ,
		@gRowguid			UNIQUEIDENTIFIER	=	NULL 

	 )
AS
	BEGIN
		DECLARE @TableTimestamp TABLE
		      (
		         fe_us_in DATETIME ,
		         fe_us_mo DATETIME ,
		         rowguid UNIQUEIDENTIFIER
		       )
		IF (@Prox_n <> 0)
			BEGIN
				UPDATE
					saSerie
				SET
					prox_n = @Prox_n
				OUTPUT
					inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
						INTO @TableTimestamp
				WHERE
					co_serie = @Co_Serie
			END
		IF (@Prox_a is not null)
			BEGIN
				UPDATE
					saSerie
				SET
					prox_a = @Prox_a
				OUTPUT
					inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
						INTO @TableTimestamp
				WHERE
					co_serie = @Co_Serie
			END

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
                    @sTablaOri = 'saSerie', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @Co_Serie
            END
END
```

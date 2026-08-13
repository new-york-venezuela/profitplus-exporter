# SP: pv_ActualizarMovCajaAnular
**Tipo**: PV-Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ActualizarMovCajaAnular]
*DESCRIPCIÓN	:	ACTUALIZA EL ESTADO A ANULADO = TRUE  DE UN MOVIMIENTO DE CAJA DADO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarMovCajaAnular]
    (
	  @sNro_Movimiento	CHAR(20),
	  @sCo_Us_Mo		CHAR(6) ,
	  @sCo_Sucu_Mo		CHAR(6)				=	NULL ,
	  @sMaquina			VARCHAR(60)			=	NULL ,
	  @sCampos			VARCHAR(MAX)		=	NULL ,
	  @sRevisado		CHAR(1) ,
	  @sTrasnfe			CHAR(1) ,
	  @tsValidador		TIMESTAMP			=	NULL ,
	  @gRowguid			UNIQUEIDENTIFIER	=	NULL 
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

		UPDATE saMovimientoCaja
			SET anulado = 1
				 OUTPUT	inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
							INTO @TableTimestamp
		WHERE
            mov_num = @sNro_Movimiento

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
                    @sTablaOri = 'saMovimientoCaja', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sNro_Movimiento 
            END
	END
```

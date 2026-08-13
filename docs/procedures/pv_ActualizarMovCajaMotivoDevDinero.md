# SP: pv_ActualizarMovCajaMotivoDevDinero
**Tipo**: PV-Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ActualizarMovCajaMotivoDevDinero
*DESCRIPCIÓN	:	ACTUALIZA EL MOTIVO DE LA DEVOLUCION DE DINERO EMITIDA DESDE PUNTO DE VENTA
					EN EL CAMPO1 DE LA TABLA 'saMovimientoCaja'
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarMovCajaMotivoDevDinero]
    (
	  @sMovNum			CHAR(20),
	  @sCampo1			VARCHAR(60)			=	NULL ,
      @sCampo2			VARCHAR(60)			=	NULL ,
      @sCampo3			VARCHAR(60)			=	NULL ,
      @sCampo4			VARCHAR(60)			=	NULL ,
      @sCampo5			VARCHAR(60)			=	NULL ,
      @sCampo6			VARCHAR(60)			=	NULL ,
      @sCampo7			VARCHAR(60)			=	NULL ,
      @sCampo8			VARCHAR(60)			=	NULL ,
	  
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
			SET campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, 
			    campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8
				OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestamp
		WHERE
            mov_num = @sMovNum

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
                    @sCampos = @sMovNum 
            END
	END
```

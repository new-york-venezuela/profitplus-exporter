# SP: pv_ActualizarStatusTurno
**Tipo**: PV-Actualizar
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ActualizarStatusTurno]
*DESCRIPCIÓN	: ACTUALIZA EL STATUS DE UN TURNO DADO (CIERRA UN TURNO DADO)
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarStatusTurno]
(
	@sNumTurno			CHAR(20),
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
SET NOCOUNT ON
BEGIN
	DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

	UPDATE pvTurnoExe SET STATUS = 'C' 
		OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestamp
			WHERE num_turno = @sNumTurno;

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
                    @sTablaOri = 'pvTurnoExe', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sNumTurno
            END
END
```

# SP: pvpActualizarEjecutarTurnosEstado
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pvpActualizarEjecutarTurnosEstado]
*DESCRIPCIÓN	: ACTUALIZA EL ESTATUS DE UN TURNO DADO, ESTE SP LO USA ADM 8.0 Y PV 2.0
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpActualizarEjecutarTurnosEstado]
    (
	  @sNum_Turno			VARCHAR(20),
	  @sCo_Turno			CHAR(6) ,
	  @sStatus				CHAR(2),
      @sCo_us_mo			CHAR (6),
      @sCo_sucu_mo			CHAR (6),
      @sMaquina				VARCHAR(60),
	  @sRevisado			CHAR(1) ,
	  @sTrasnfe				CHAR(1) ,
	  @tsValidador			TIMESTAMP 
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

        UPDATE
            pvTurnoExe
        SET [status] = @sStatus,
		 co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, 
		 fe_us_mo = GETDATE()
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Num_Turno = @sNum_Turno and co_turno = @sCo_Turno
            AND validador = @tsValidador	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
				declare @sCampos varchar (32)
				set @sCampos = 'status: ->' + @sStatus
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'pvTurnoExe', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestamp
    END
```

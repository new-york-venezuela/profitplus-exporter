# SP: pvpActualizarTurno
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurno`](../tables/pvTurno.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpActualizarTurno
*DESCRIPCIÓN	: Actualiza un Turno
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpActualizarTurno]
    (
      @sCo_Turno CHAR(6) ,
      @sDes_Turno VARCHAR(60) ,
      @sCo_TurnoOri CHAR(6) ,
      @iHora_ini Integer ,
      @iMinu_ini Integer ,
      @sAmpm_ini CHAR(1),
      @iHora_fin Integer ,
      @iMinu_fin Integer ,
      @sAmpm_fin CHAR (1),
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Sucu_In CHAR(6) = NULL,
      @sCo_us_mo CHAR (6),
      @sCo_sucu_mo CHAR (6) = NULL,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1)= NULL ,
      @sTrasnfe CHAR(1) = NULL,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 

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
            pvTurno
        SET 
        
            co_turno = @sCo_Turno, des_turno = @sDes_Turno, hora_ini = @iHora_ini, minu_ini = @iMinu_ini, ampm_ini = @sAmpm_ini, hora_fin = @iHora_fin, minu_fin = @iMinu_fin, ampm_fin = @sAmpm_fin,  campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Turno = @sCo_TurnoOri
            AND validador = @tsValidador	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar P
```

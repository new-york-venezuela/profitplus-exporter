# SP: pActualizarRenglonesCheque
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pActualizarCheque
*DESCRIPCIÓN	: Actualiza un cheque
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarRenglonesCheque]
    (
      @iReng_Num INT = NULL , -- Por compatibilidad de framework
      @iReng_NumOri INT = NULL ,	-- Por compatibilidad de framework
      @sCo_Cheq CHAR(20) ,
      @sCo_CheqOri CHAR(20) ,
      @sCo_Chra CHAR(6) ,
      @sCo_ChraOri CHAR(6) ,
      @sStatus CHAR(3) ,
      @sdFec_Emis DATETIME ,
      @sDescrip VARCHAR(60) ,
      @sMov_Num CHAR(20) = NULL ,
      @sdFec_Ent DATETIME = NULL ,
      @sEntreg_a VARCHAR(60) = NULL ,
      @sComent VARCHAR(MAX) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) ,
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
            saCheque
        SET Co_Cheq = @sCo_Cheq, Co_Chra = @sCo_Chra, mov_num = @sMov_Num, [Status] = @sStatus, Descrip = @sDescrip,
            Fec_emis = @sdFec_Emis, Fec_ent = @sdFec_Ent, Entreg_a = @sEntreg_a, Comentario = @sComent,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.validador,inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Cheq = @sCo_CheqOri
            AND Co_Chra = @sCo_ChraOri
            AND validador = @tsValidador

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
                    @sTablaOri = 'saCheque', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sC
```

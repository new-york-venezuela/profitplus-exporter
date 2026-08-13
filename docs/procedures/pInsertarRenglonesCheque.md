# SP: pInsertarRenglonesCheque
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pInsertarCheque
*DESCRIPCIÓN	: Inserta un cheque
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO		: SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesCheque]
    (
      @iReng_Num INT = NULL , -- Por compatibilidad de framework
      @sCo_Cheq CHAR(20) ,
      @sCo_Chra CHAR(6) ,
      @sStatus CHAR(3) ,
      @sDescrip VARCHAR(60) ,
      @sdFec_Emis DATETIME ,
      @sMov_Num CHAR(20) = NULL ,
      @sdFec_Ent DATETIME = NULL ,
      @sEntreg_a VARCHAR(60) = NULL ,
      @sComent VARCHAR(MAX) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsvalidador TIMESTAMP = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saCheque
                ( co_cheq, co_chra, [Status], Descrip, Fec_emis, Fec_ent, Entreg_a, Comentario, co_us_in, fe_us_in,
                  co_us_mo, fe_us_mo, co_sucu_in, co_sucu_mo, mov_num )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Cheq, @sCo_Chra, @sStatus, @sDescrip, @sdFec_Emis, @sdFec_Ent, @sEntreg_a, @sComent, @sCo_Us_In,
                  GETDATE(), @sCo_Us_In, GETDATE(), @sCo_Sucu_In, @sCo_Sucu_In, @sMov_Num )



        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saCheque', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Cheq

        SELECT
            *
        FROM
            @TableTimestamp
    END
```

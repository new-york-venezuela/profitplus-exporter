# SP: pInsertarRenglonesConciliacionD
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pInsertarConciliacionA
*DESCRIPCIÓN	: Inserta un registro en la tabla saConciliacionDetalle
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO		: 
************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesConciliacionD]
    (
      @iRENG_NUM INT ,
      @sCo_Auto_Con CHAR(6) ,
      @dFec_Mov DATETIME ,
      @sTipo_Op CHAR(15) ,
      @sDoc_Num CHAR(20) ,
      @sDescrip VARCHAR(60) = NULL ,
      @deMonto_D DECIMAL(18, 2) ,
      @deMonto_H DECIMAL(18, 2) ,
      @deIdb DECIMAL(18, 2) ,
      @bDep_Con BIT = 0 ,
      @sOrigen CHAR(10) ,
      @bRepetido BIT ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR ,
      @sTrasnfe CHAR
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saConciliacionDetalle
                ( reng_num, co_auto_con, fec_mov, tipo_op, doc_num, descrip, monto_d, monto_h, idb, dep_con, origen,
                  co_us_in, repetido, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iRENG_NUM, @sCo_Auto_Con, @dFec_Mov, @sTipo_Op, @sDoc_Num, @sDescrip, @deMonto_D, @deMonto_H, @deIdb,
                  @bDep_Con, @sOrigen, @sCo_Us_In, @bRepetido, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saConciliacionDetalle', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Auto_Con

        SELECT
            *
        FROM
            @TableTimestamp
    END
```

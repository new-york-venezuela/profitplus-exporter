# SP: pActualizarRenglonesConciliacionD
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)

## Código (excerpt)
```sql
/*=============================================
*NOMBRE			: pActualizarRenglonesConciliacionD
*DESCRIPCIÓN	: Actualiza la tabla saConciliacionDetalle
*AUTOR			: Softech Sistemas
=============================================*/

CREATE PROCEDURE [pActualizarRenglonesConciliacionD]
    (
      @sCo_Auto_Con CHAR(6) ,
      @sCo_Auto_ConOri CHAR(6) ,
      @sdFec_Mov DATETIME ,
      @sTipo_Op CHAR(15) ,
      @sDoc_Num CHAR(20) ,
      @sDescrip VARCHAR(60) = NULL ,
      @deMonto_D DECIMAL(18, 2) ,
      @deMonto_H DECIMAL(18, 2) ,
      @deIdb DECIMAL(18, 2) ,
      @iDep_Con INT = NULL ,
      @sOrigen CHAR(10) ,
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 

    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saConciliacionDetalle
        SET reng_num = @iReng_Num, co_auto_con = @sCo_Auto_Con, fec_mov = @sdFec_Mov, tipo_op = @sTipo_Op,
            doc_num = @sDoc_Num, descrip = @sDescrip, monto_d = @deMonto_D, monto_h = @deMonto_H, idb = @deIdb,
            dep_con = @iDep_Con, origen = @sOrigen, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_auto_con = @sCo_Auto_ConOri
            AND reng_num = @iReng_NumOri	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saConciliacionDetalle', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M',
                    @sMaquina = @sMaquina, @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestamp
    END
```

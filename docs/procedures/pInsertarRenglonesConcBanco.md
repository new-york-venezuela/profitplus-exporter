# SP: pInsertarRenglonesConcBanco
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConcBanco`](../tables/saConcBanco.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pInsertarConciliacionA
*DESCRIPCIÓN	: Inserta un registro en la tabla saConcBanco
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO		: 
************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesConcBanco]
    (
      @sCo_Auto_Con CHAR(6) ,
      @iReng_Num INT ,
      @sMov_Num CHAR(20) ,
      @dFec_Conc DATETIME = NULL ,
      @bCon_Auto BIT ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
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
		
        INSERT  INTO saConcBanco
                ( co_auto_con, reng_num, mov_num, fec_conc, con_auto, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                  co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Auto_Con, @iReng_Num, @sMov_Num, GETDATE(), @bCon_Auto, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
		

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saConcBanco', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Auto_Con

        SELECT
            *
        FROM
            @TableTimestamp
    END
```

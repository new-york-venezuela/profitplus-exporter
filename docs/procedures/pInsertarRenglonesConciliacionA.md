# SP: pInsertarRenglonesConciliacionA
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pInsertarConciliacionA
*DESCRIPCIÓN	: Inserta un registro en la tabla saConciliacionAutoReng
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO		: 
************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesConciliacionA]
    (
      @iReng_Num INT = NULL ,
      @sCod_Cta CHAR(6) ,
      @iMesArchivo INT ,
      @iAnoArchivo INT ,
      @sCo_Auto_Con CHAR(6) ,
      @dFecImpor DATETIME ,
      @sStatus CHAR(3) ,
      @baArchivo VARBINARY(MAX) ,
      @iTamanoPaquete INT ,
      @iTotalMov INT ,
      @iTotalCon INT ,
      @iTotalRep INT ,
      @deSaldoEc DECIMAL(18, 5) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR = NULL ,
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

        INSERT  INTO saConciliacionAutoReng
                ( cod_cta, mesArchivo, anoArchivo, co_auto_con, fecImpor, status, archivo, tamanoPaquete, totalMov,
                  totalCon, totalRep, saldoEc, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado,
                  trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCod_Cta, @iMesArchivo, @iAnoArchivo, @sCo_Auto_Con, @dFecImpor, @sStatus, @baArchivo,
                  @iTamanoPaquete, @iTotalMov, @iTotalCon, @iTotalRep, @deSaldoEc, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
		

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saConciliacionAutoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Auto_Con

        SELECT
            *
        FROM
            @TableTimestamp
    END
```

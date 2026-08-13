# SP: pActualizarRenglonesConciliacionA
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pActualizarRenglonesConciliacionA
*DESCRIPCIÓN	: Actualiza la tabla saConciliacionAutoReng
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [pActualizarRenglonesConciliacionA]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Auto_Con CHAR(6) ,
      @sCo_Auto_ConOri CHAR(6) ,
      @sCod_Cta CHAR(6) ,
      @iMesArchivo INT ,
      @iAnoArchivo INT ,
      @dFecImpor DATETIME ,
      @sStatus CHAR(3) ,
      @baArchivo VARBINARY(MAX) ,
      @iTamanoPaquete INT ,
      @iTotalMov INT ,
      @iTotalCon INT ,
      @iTotalRep INT ,
      @deSaldoEc DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCampos VARCHAR(MAX) ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER 
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
            saConciliacionAutoReng
        SET cod_cta = @sCod_Cta, mesArchivo = @iMesArchivo, anoArchivo = @iAnoArchivo, co_auto_con = @sCo_Auto_Con,
            fecImpor = @dFecImpor, status = @sStatus, archivo = @baArchivo, tamanoPaquete = @iTamanoPaquete,
            totalMov = @iTotalMov, totalCon = @iTotalCon, totalRep = @iTotalRep, co_us_mo = @sCo_Us_Mo,
            co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_auto_con = @sCo_Auto_ConOri

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
                    @sTablaOri = 'saConciliacionAutoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M',
                    @sMaquina = @sMaquina, @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestam
```

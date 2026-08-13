# SP: pInsertarRenglonesTipoSerie
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarRenglonesTipoSerie
*DESCRIPCIÓN	: Inserta un registro en la tabla saSerie
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesTipoSerie]
    (
      @iReng_Num INT ,
      @sCo_Tipo_Serie CHAR(6) ,
      @sCo_Serie CHAR(20) ,
      @sDesde_A CHAR(20) ,
      @iDesde_N BIGINT ,
      @sHasta_A CHAR(20) ,
      @iHasta_N BIGINT ,
      @sProx_A CHAR(20) ,
      @iProx_N BIGINT ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_Sucu_In CHAR(6) ,
      @sCo_Us_in CHAR(6) ,
      @sMaquina VARCHAR(60)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saSerie
                ( reng_num, co_tipo_serie, co_serie, desde_a, desde_n, hasta_a, hasta_n, prox_a, prox_n, co_us_in,
                  co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iReng_Num, @sCo_Tipo_Serie, @sCo_Serie, @sDesde_A, @iDesde_N, @sHasta_A, @iHasta_N, @sProx_A,
                  @iProx_N, @sCo_Us_in, @sCo_Sucu_In, GETDATE(), @sCo_Us_in, @sCo_Sucu_In, GETDATE(), @sRevisado,
                  @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saSerie', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Serie
		
        SELECT
            *
        FROM
            @TableTimestamp
    END
```

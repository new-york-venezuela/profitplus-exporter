# SP: pActualizarRenglonesTipoSerie
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saSerie`](../tables/saSerie.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	pActualizarRenglonesTipoSerie
-- DESCRIPCION	:	Actualiza un registro en la tabla saConsecutivo
-- CREADO POR	:	SOFTECH SISTEMAS
-- =============================================

CREATE PROCEDURE [dbo].[pActualizarRenglonesTipoSerie]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Tipo_Serie CHAR(6) ,
      @sCo_Tipo_SerieOri CHAR(6) ,
      @sCo_Serie CHAR(20) ,
      @sDesde_A CHAR(20) ,
      @iDesde_N BIGINT ,
      @sHasta_A CHAR(20) ,
      @iHasta_N BIGINT ,
      @sProx_A CHAR(20) ,
      @iProx_N BIGINT ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCampos VARCHAR(MAX) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp AS TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	 if not exists( select reng_num from saSerie where reng_num = @iReng_NumOri AND co_tipo_serie = @sCo_Tipo_SerieOri)
	 begin
	    set @iReng_NumOri=null
		select  @iReng_NumOri=reng_num from saSerie where rowguid =@gRowguid
	 end


	 if @iReng_NumOri is not null
	 begin
        UPDATE
            saSerie
        SET reng_num = @iReng_Num, co_tipo_serie = @sCo_Tipo_Serie, co_serie = @sCo_Serie, desde_a = @sDesde_A,
            desde_n = @iDesde_N, hasta_a = @sHasta_A, hasta_n = @iHasta_N, prox_a = @sProx_A, prox_n = @iProx_N,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            reng_num = @iReng_NumOri
            AND co_tipo_serie = @sCo_Tipo_SerieOri
	end
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

		set @sCampos  = 'Tipo Serie: '+ @sCo_Tipo_SerieOri + 'Código Serie: '+ @sCo_Serie + ' '+ @sCampos

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saSerie', @rowguid
```

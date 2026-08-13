# SP: pActualizarTipoAjuste
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pActualizarTipoAjuste
*DESCRIPCIÓN	:	Actualiza un registro en la tabla  tipo_aju
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pActualizarTipoAjuste]
    (
      @sCo_Tipo CHAR(6) ,
      @sCo_TipoOri CHAR(6) ,
      @sDes_Tipo VARCHAR(60) ,
      @sTipo_Trans CHAR(1) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp AS TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        UPDATE
            saTipoAjuste
        SET co_tipo = @sCo_Tipo, des_tipo = @sDes_Tipo, tipo_trans = @sTipo_Trans, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo = @sCo_TipoOri
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
                    @sTablaOri = 'saTipoAjuste', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos
            END

        SELECT
```

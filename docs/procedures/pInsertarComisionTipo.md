# SP: pInsertarComisionTipo
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionTipo`](../tables/saComisionTipo.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarTablaComisionTipo
*DESCRIPCIÓN	:	Inserta un registro en la tabla  Comision Tipo
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pInsertarComisionTipo]
    (
      @sCo_Comi CHAR(6) ,
      @sDes_Comi VARCHAR(60) ,
      @bInactivo BIT,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
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
		
        INSERT  INTO saComisionTipo
                ( co_comi, des_comi, inactivo, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in,
                  co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Comi, @sDes_Comi, @bInactivo, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8,
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saComisionTipo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Comi

        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```

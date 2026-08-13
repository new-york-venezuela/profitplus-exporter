# SP: pInsertarConceptoISLR
**Tipo**: Insertar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saConISLR`](../tables/saConISLR.md)

## Código (excerpt)
```sql
/********************************************************************************************
*NOMBRE			:	pInsertarConceptoIslr
*DESCRIPCION	:	Inserta un registro en la tabla con_islr
*AUTOR			:	SOFTECH SISTEMAS
********************************************************************************************/

CREATE PROCEDURE [pInsertarConceptoISLR]
    (
      @sCo_Islr CHAR(6) ,
      @sIslr_Des VARCHAR(60) ,
      @sIslr_DesLarga VARCHAR(MAX) ,
      @sNumeral CHAR(6) = NULL,
      @sLiteral CHAR(6) = NULL,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
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

        INSERT  INTO saConISLR
                ( co_islr, islr_des, islr_deslarga, numeral, literal, campo1, campo2, campo3, campo4, campo5, campo6,
                  campo7, campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Islr, @sIslr_Des, @sIslr_DesLarga, @sNumeral, @sLiteral, @sCampo1, @sCampo2, @sCampo3, @sCampo4,
                  @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saConISLR', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Islr

        SELECT
            *
        FROM
            @TableTimestamp

    END
```

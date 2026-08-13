# SP: pInsertarColor
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saColor`](../tables/saColor.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarColor
*DESCRIPCIÓN	: Inserta un color
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarColor]
    (
      @sCo_Color CHAR(6) ,
      @sDes_Color VARCHAR(60) ,
      @sCampo_Adic VARCHAR(60) = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
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

        INSERT  INTO saColor
                ( co_color, des_color, campo_adic, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Color, @sDes_Color, @sCampo_Adic, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_Sucu_In,
                  @sCo_Sucu_In )


        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saColor', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Color
		
        SELECT
            *
        FROM
            @TableTimestamp
    END
```

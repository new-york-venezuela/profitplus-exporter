# SP: pInsertarSubLinea
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pInsertarSubLinea]
*DESCRIPCIÓN	:	Inserta un registro en la tabla  sub_lin
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [pInsertarSubLinea]
    (
      @sCo_Subl CHAR(6) ,
      @sSubl_Des VARCHAR(60) ,
      @sCo_Lin CHAR(6) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCo_Sucu_In CHAR(6) ,
      @sCo_Imun CHAR(15) ,
      @sCo_Reten CHAR(6) ,
      @sI_Subl_Des VARCHAR(60) ,
      @bMovil BIT	
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

        INSERT  INTO saSubLinea
                ( co_subl, subl_des, co_lin, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in,
                  fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo, co_imun, co_reten, i_subl_des,
                  movil )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Subl, @sSubl_Des, @sCo_Lin, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7,
                  @sCampo8, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_Sucu_In,
                  @sCo_Sucu_In, @sCo_Imun, @sCo_Reten, @sI_Subl_Des, @bMovil )


        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saSubLinea', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Subl
		
        SELECT
            *
        FROM
```

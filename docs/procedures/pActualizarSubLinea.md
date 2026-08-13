# SP: pActualizarSubLinea
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pActualizarSubLinea]
*DESCRIPCIÓN	:	Actualiza un registro en la tabla  sub_lin
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [pActualizarSubLinea]
    (
      @sCo_Subl CHAR(6) ,
      @sCo_SublOri CHAR(6) ,
      @sSubl_Des VARCHAR(60) ,
      @sCo_Lin CHAR(6) ,
      @sCo_LinOri CHAR(6) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sI_Subl_Des VARCHAR(60) = NULL ,
      @sCo_Imun CHAR(15) ,
      @sCo_Reten CHAR(6) ,
      @bMovil BIT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
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

        UPDATE
            saSubLinea
        SET co_subl = @sCo_Subl, subl_des = @sSubl_Des, co_lin = @sCo_Lin, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe, co_imun = @sCo_Imun, co_reten = @sCo_Reten,
            i_subl_des = @sI_Subl_Des, movil = @bMovil
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_subl = @sCo_SublOri
            AND co_lin = @sCo_LinOri
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
                EXEC
```

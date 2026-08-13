# SP: pActualizarLineaArticulo
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarLineaArticulo
DESCRIPCION: Actualiza Tabla Lin_Art
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarLineaArticulo]
    (
      @sCo_Lin CHAR(6) ,
      @sCo_LinOri CHAR(6) ,
      @sLin_Des VARCHAR(60) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @sCo_Imun CHAR(15) = NULL ,
      @sCo_Reten CHAR(6) = NULL ,
      @deComi_Lin DECIMAL(18, 2) ,
      @deComi_Lin2 DECIMAL(18, 2) ,
      @bVa BIT ,
      @sI_Lin_Des VARCHAR(60) ,
      @bMovil BIT ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
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
            ) ;
    
        UPDATE
            saLineaArticulo
        SET co_lin = @sCo_Lin, lin_des = @sLin_Des, dis_cen = @sDis_Cen, co_imun = @sCo_Imun, co_reten = @sCo_Reten,
            comi_lin = @deComi_Lin, comi_lin2 = @deComi_Lin2, va = @bVa, i_lin_des = @sI_Lin_Des, movil = @bMovil,
            campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5,
            campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_lin = @sCo_LinOri
            AND validador = @tsValidador

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGui
```

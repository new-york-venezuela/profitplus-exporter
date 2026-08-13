# SP: pActualizarAlmacen
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarSubAlmacen]
*DESCRIPCIÓN	: Actualizar un sub-almacen
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarAlmacen]
    (
      @sCo_Alma CHAR(6) ,
      @sCo_AlmaOri CHAR(6) ,
      @sDes_Alma VARCHAR(60) ,
      @sCo_Sucur CHAR(6) ,
      @bNoVenta BIT ,
      @bNoCompra BIT ,
      @bMateriales BIT ,
      @bProduccion BIT ,
      @bAlm_Temp BIT ,
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
      @gRowguid UNIQUEIDENTIFIER = NULL ,
	  @sdireccion VARCHAR(MAX) = NULL 

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
            saAlmacen
        SET co_alma = @sCo_Alma, des_alma = @sDes_Alma, co_sucur = @sCo_Sucur, noventa = @bNoVenta,
            nocompra = @bNoCompra, materiales = @bMateriales, produccion = @bProduccion, alm_temp = @bAlm_Temp,
            campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5,
            campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe,direccion = @sdireccion
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_alma = @sCo_AlmaOri
            AND validador = @tsValidador
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pi
```

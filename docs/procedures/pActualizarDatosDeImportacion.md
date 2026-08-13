# SP: pActualizarDatosDeImportacion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2016-08-10>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pActualizarDatosDeImportacion
*DESCRIPCIÓN	: Actualiza Datos De Importacion
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarDatosDeImportacion]
    (
      @gRowguid_Factura_Renglon UNIQUEIDENTIFIER ,
      @sFact_Num VARCHAR(20) ,
      @sBl_Awb_Cpi VARCHAR(60) = NULL,
	  @iTasa int = NULL,
	  @deTasaValor DECIMAL(21, 8) = NULL,
	  @deTotal DECIMAL(18, 5) = NULL,
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
	  @tsValidador TIMESTAMP = NULL,
      @gRowguid UNIQUEIDENTIFIER = NULL 

    )
AS 
    BEGIN	

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saDatosDeImportacion
        SET fact_num = @sFact_Num, bl_awb_cpi= @sBl_Awb_Cpi, tasa = @iTasa, total_imp = @deTotal, tasa_valor = @deTasaValor,
		    campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_factura_renglon = @gRowguid_Factura_Renglon	

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
                    @sTablaOr
```

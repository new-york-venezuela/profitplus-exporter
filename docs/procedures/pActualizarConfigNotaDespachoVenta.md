# SP: pActualizarConfigNotaDespachoVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigNotaDespachoVenta`](../tables/saConfigNotaDespachoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarConfigNotaDespachoVenta
*DESCRIPCIÓN	: Actualiza la configuracion del proceso Nota de Despacho
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarConfigNotaDespachoVenta]
    (
      @sCo_Config CHAR(6) ,
      @sCo_ConfigOri CHAR(6) ,
      @sDes_Config VARCHAR(60) ,
      @sCo_Usuario CHAR(6) = NULL ,
      @sCo_Mapa CHAR(6) = NULL ,
      @xXml_Squema XML = NULL ,
      @xXml_Data XML = NULL ,
      @xXml_Reglas XML = NULL ,
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
            )

        UPDATE
            saConfigNotaDespachoVenta
        SET co_config = @sCo_Config, des_config = @sDes_Config, co_usuario = @sCo_Usuario, co_mapa = @sCo_Mapa,
            xml_squema = @xXml_Squema, xml_data = @xXml_Data, xml_reglas = @xXml_Reglas, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_config = @sCo_ConfigOri
            AND validador = @tsValidador	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
```

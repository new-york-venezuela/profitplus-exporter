# SP: pInsertarConfigFacturaCompra
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saConfigFacturaCompra`](../tables/saConfigFacturaCompra.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:pInsertarConfigFacturaCompra
*DESCRIPCIÓN	: Inserta una Configuración en la tabla saConfigFacturaCompra
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarConfigFacturaCompra]
    (
      @sCo_Config CHAR(6) ,
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

        INSERT  INTO saConfigFacturaCompra
                ( co_config, des_config, co_usuario, co_mapa, xml_squema, xml_data, xml_reglas, campo1, campo2, campo3,
                  campo4, campo5, campo6, campo7, campo8, co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe,
                  co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Config, @sDes_Config, @sCo_Usuario, @sCo_Mapa, @xXml_Squema, @xXml_Data, @xXml_Reglas, @sCampo1,
                  @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, GETDATE(),
                  @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_Sucu_In, @sCo_Sucu_In )


        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saConfigFacturaCompra', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I
```

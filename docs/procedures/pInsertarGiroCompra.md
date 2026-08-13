# SP: pInsertarGiroCompra
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saGiroCompra`](../tables/saGiroCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarGiroCompra
*DESCRIPCIÓN	:	Inserta un Giro Compra
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pInsertarGiroCompra]
    (
      @sco_Giro CHAR(20) ,
      @sdes_Giro VARCHAR(60) ,
      @sco_prov CHAR(16) ,
      @sdfecha SMALLDATETIME ,
      @icant_giro INT ,
      @sFrecuencia CHAR(2) ,
      @sdfec_p_giro SMALLDATETIME ,
      @deporc_interes DECIMAL(18, 2) ,
      @sco_tipo_doc CHAR(6) = NULL ,
      @snro_doc CHAR(20) = NULL ,
      @demont_doc DECIMAL(18, 2) ,
      @sCob_Num CHAR(20) = NULL ,
      @bprocesado BIT ,
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
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL

    )
AS 
    BEGIN
		
        DECLARE @Tabletimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saGiroCompra
                ( co_Giro, des_Giro, co_prov, fecha, cant_giro, Frecuencia, fec_p_giro, co_tipo_doc, nro_doc, mont_doc,
                  porc_interes, cob_Num, procesado, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, revisado, trasnfe, fe_us_in, fe_us_mo, co_us_mo )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sco_Giro, @sdes_Giro, @sco_prov, @sdfecha, @icant_giro, @sFrecuencia, @sdfec_p_giro, @sco_tipo_doc,
                  @snro_doc, @demont_doc, @deporc_interes, @sCob_Num, @bprocesado, @sCampo1, @sCampo2, @sCampo3,
                  @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, @sRevisado, @sTrasnfe,
                  GETDATE(), GETDATE(), @sCo_Us_In )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri =
```

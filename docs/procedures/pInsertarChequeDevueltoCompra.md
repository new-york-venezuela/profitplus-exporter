# SP: pInsertarChequeDevueltoCompra
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarChequeDevueltoCompra
*DESCRIPCIÓN	:	Inserta un cheque devuelto
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pInsertarChequeDevueltoCompra]
    (
      @sco_cheq_dev CHAR(20) ,
      @sdes_cheq_dev VARCHAR(60) ,
      @sco_prov CHAR(16) ,
      @sdfecha SMALLDATETIME ,
      @snum_doc CHAR(20) ,
      @bincluye_imp BIT ,
      @scod_cta CHAR(6) ,
      @sco_tipo_doc CHAR(6) = NULL ,
      @snro_doc CHAR(20) = NULL ,
      @demont_doc DECIMAL(18, 2) ,
      @sdfec_cheq SMALLDATETIME ,
      @sco_ban CHAR(6) ,
      @stip_imp CHAR(1) = NULL ,
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

        INSERT  INTO saChequeDevueltoCompra
                ( co_cheq_dev, des_cheq_dev, co_prov, fecha, num_doc, incluye_imp, cod_cta, co_tipo_doc, nro_doc,
                  mont_doc, fec_cheq, co_ban, tip_imp, procesado, campo1, campo2, campo3, campo4, campo5, campo6, campo7,
                  campo8, co_us_in, co_sucu_in, revisado, trasnfe, fe_us_in, fe_us_mo, co_us_mo )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sco_cheq_dev, @sdes_cheq_dev, @sco_prov, @sdfecha, @snum_doc, @bincluye_imp, @scod_cta, @sco_tipo_doc,
                  @snro_doc, @demont_doc, @sdfec_cheq, @sco_ban, @stip_imp, @bprocesado, @sCampo1, @sCampo2, @sCampo3,
                  @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, @sRevisado, @sTrasnfe,
                  GETDATE(), GETDATE(), @sCo_Us_In )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIF
```

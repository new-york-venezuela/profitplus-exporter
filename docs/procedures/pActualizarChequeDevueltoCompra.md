# SP: pActualizarChequeDevueltoCompra
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pActualizarChequeDevueltoCompra
*DESCRIPCIÓN	:	Actualiza cheque devuelto 
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pActualizarChequeDevueltoCompra]
    (
      @sco_cheq_dev CHAR(20) ,
      @sco_cheq_devOri CHAR(20) ,
      @sdes_cheq_dev VARCHAR(60) ,
      @sco_prov CHAR(16) ,
      @sdfecha SMALLDATETIME ,
      @snum_doc CHAR(20) ,
      @bincluye_imp BIT ,
      @scod_cta CHAR(6) ,
      @sco_tipo_doc CHAR(6) ,
      @snro_doc CHAR(20) ,
      @demont_doc DECIMAL(18, 2) ,
      @sdfec_cheq SMALLDATETIME ,
      @sco_ban CHAR(6) ,
      @stip_imp CHAR(1) ,
      @bprocesado BIT ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @tsValidador TIMESTAMP ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
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

        UPDATE
            saChequeDevueltoCompra
        SET co_cheq_dev = @sco_cheq_dev, des_cheq_dev = @sdes_cheq_dev, co_prov = @sco_prov, fecha = @sdfecha,
            num_doc = @snum_doc, incluye_imp = @bincluye_imp, cod_cta = @scod_cta, co_tipo_doc = @sco_tipo_doc,
            nro_doc = @snro_doc, mont_doc = @demont_doc, fec_cheq = @sdfec_cheq, co_ban = @sco_ban, tip_imp = @stip_imp,
            procesado = @bprocesado, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo,
            co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, inserted.rowguid
            INTO @Tabletime
```

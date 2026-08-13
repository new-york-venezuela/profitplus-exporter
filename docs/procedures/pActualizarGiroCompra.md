# SP: pActualizarGiroCompra
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saGiroCompra`](../tables/saGiroCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pActualizarGiroCompra
*DESCRIPCIÓN	:	Actualiza Giro compra
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pActualizarGiroCompra]
    (
      @sco_Giro CHAR(20) ,
      @sco_Giro_Ori CHAR(20) ,
      @sCob_Num CHAR(20) ,
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
            saGiroCompra
        SET co_giro = @sco_Giro, des_giro = @sdes_Giro, co_prov = @sco_prov, fecha = @sdfecha, cant_giro = @icant_giro,
            Frecuencia = @sFrecuencia, fec_p_giro = @sdfec_p_giro, porc_interes = @deporc_interes,
            co_tipo_doc = @sco_tipo_doc, nro_doc = @snro_doc, mont_doc = @demont_doc, cob_num = @sCob_num,
            procesado = @bprocesado, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo,
            co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, inserted.rowguid
            INTO @Tabletimestamp
        WHERE
            co_giro = @sco_giro_Ori
```

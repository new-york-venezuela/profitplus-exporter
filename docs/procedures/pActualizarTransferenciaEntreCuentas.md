# SP: pActualizarTransferenciaEntreCuentas
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2015-02-13>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pActualizarTransferenciaEntreCuentas
*DESCRIPCIÓN	:	Actualiza Transferencia Entre Cuentas 
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarTransferenciaEntreCuentas]
    (
        @sco_trans_ban CHAR(20), 
		@sco_trans_banOri CHAR(20), 
		@sdes_trans_ban CHAR(60), 
		@dfecha DATETIME, 
		@bprocesado BIT, 
		@demonto DECIMAL(18,2), 
		@decomision DECIMAL(18,2) = 0, 
		@scta_origen CHAR(6), 
		@scta_ingr_egr_origen CHAR(20), 
		@dfecha_origen DATETIME, 
		@smov_ban_origen CHAR(20),
		@sreferencia_origen CHAR(60),  
		@scta_comision CHAR(6), 
		@scta_ingr_egr_comision CHAR(20), 
		@smov_ban_comision CHAR(20), 
		@scta_destino CHAR(6), 
		@scta_ingr_egr_destino CHAR(20), 
		@dfecha_destino DATETIME, 
		@smov_ban_destino CHAR(20),
		@sreferencia_destino CHAR(60), 
		@sCampo1 VARCHAR(60) = NULL ,
		@sCampo2 VARCHAR(60) = NULL ,
		@sCampo3 VARCHAR(60) = NULL ,
		@sCampo4 VARCHAR(60) = NULL ,
		@sCampo5 VARCHAR(60) = NULL ,
		@sCampo6 VARCHAR(60) = NULL ,
		@sCampo7 VARCHAR(60) = NULL ,
		@sCampo8 VARCHAR(60) = NULL ,
		--@sCo_Us_In CHAR(6) ,
		@sCo_Sucu_In CHAR(6) = NULL ,
		@sMaquina VARCHAR(60) = NULL ,
		@sRevisado CHAR(1) ,
		@sCampos VARCHAR(MAX) = NULL ,
		@sTrasnfe CHAR(1) ,
		@sCo_Us_Mo CHAR(6) ,
		@sCo_Sucu_Mo CHAR(6) ,
		@tsValidador TIMESTAMP ,
		@growguid UNIQUEIDENTIFIER,
		@sBan_Origen CHAR(6),
		@sBan_Destino CHAR(6),
		@deTasa decimal(21, 8),
		@sreferencia_comis CHAR(60),
		@deTasa_Origen decimal(21, 8)
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

			IF @decomision is NULL 
				 set @decomision = 0 


        UPDATE
            saTransferenciaEntreCuentas
        SET co_trans_ban = @sco_trans_ban, des_trans_ban = @sdes_trans_ban, fecha = @dfecha, procesado = @bprocesado, 
			monto = @demonto, comision = @decomision,cta_origen = @scta_origen, cta_ingr_egr_origen = @scta_ingr_egr_origen, 
			fecha_origen = @dfecha_origen, mov_ban_origen = @smov_ban_origen, referencia_origen = @sreferencia_origen, cta_comision = @scta_comision, cta_ingr_egr_comision = @scta_i
```

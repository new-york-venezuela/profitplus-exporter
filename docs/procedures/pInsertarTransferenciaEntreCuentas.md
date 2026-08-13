# SP: pInsertarTransferenciaEntreCuentas
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pInsertarTransferenciaEntreCuentas
*DESCRIPCIÓN	:	Inserta una transferencia entre cuentas
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarTransferenciaEntreCuentas]
    (
		@sco_trans_ban CHAR(20), 
		@sdes_trans_ban CHAR(60), 
		@dfecha DATETIME, 
		@bprocesado BIT,  
		@demonto DECIMAL(18,2) = 0, --NUMERIC, 
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
		@sCo_Us_In CHAR(6) ,
		@sCo_Sucu_In CHAR(6) = NULL ,
		@sMaquina VARCHAR(60) = NULL ,
		@sRevisado CHAR(1) ,
		@sTrasnfe CHAR(1),
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

        INSERT  INTO saTransferenciaEntreCuentas
				(co_trans_ban, des_trans_ban, fecha, procesado, monto, comision, cta_origen, 
				cta_ingr_egr_origen, fecha_origen, mov_ban_origen, referencia_origen, cta_comision, cta_ingr_egr_comision, 
				mov_ban_comision, cta_destino, cta_ingr_egr_destino, fecha_destino, mov_ban_destino, referencia_destino, 
				campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, 
				fe_us_in,co_us_mo, fe_us_mo, revisado, trasnfe, tasa, referencia_comis, tasa_origen)
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
```

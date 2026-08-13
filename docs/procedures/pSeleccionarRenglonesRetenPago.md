# SP: pSeleccionarRenglonesRetenPago
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarRenglonesRetenPago]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER
    )
AS 
    BEGIN
		IF (SELECT COUNT(*) FROM saPagoRentenReng PRIR INNER JOIN saPagoDocReng AS PDR ON PRIR.Rowguid_Reng_Cob = PDR.rowguid
				INNER JOIN saPagoDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
				INNER JOIN saDocumentoCompra AS DC ON PDR1.nro_doc = DC.nro_doc AND DC.co_tipo_doc = PDR1.co_tipo_doc
			WHERE Rowguid_Reng_Cob = @gRowguid_Reng_Cob) >= 1
		BEGIN
			--RETENCION INDIVIDUAL
			SELECT
				PRIR.*, DC.nro_doc AS Nro_Doc_Orig, DC.co_tipo_doc AS Tipo_Doc_Orig, dc.nro_fact AS Nro_Fact_Orig,
				PDR.cob_num
			FROM
				saPagoRentenReng PRIR
				INNER JOIN saPagoDocReng AS PDR ON PRIR.Rowguid_Reng_Cob = PDR.rowguid
				INNER JOIN saPagoDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
				INNER JOIN saDocumentoCompra AS DC ON PDR1.nro_doc = DC.nro_doc
													  AND DC.co_tipo_doc = PDR1.co_tipo_doc
			WHERE
				Rowguid_Reng_Cob = @gRowguid_Reng_Cob
		END
		ELSE
		BEGIN
			SELECT
			--RETENCION GLOBAL
				max(PRIR.reng_num) reng_num, PRIR.rowguid_reng_cob, PRIR.co_islr, max(PRIR.monto) monto,  max(PRIR.monto_reten) monto_reten,
				max(PRIR.monto_obj) monto_obj, max(PRIR.sustraendo) sustraendo, max(PRIR.porc_retn) porc_retn, cast(max(cast(PRIR.automatica as int)) as bit) automatica,
				PRIR.co_us_in, PRIR.co_sucu_in, PRIR.co_us_mo, PRIR.co_sucu_mo, PRIR.fe_us_mo, max(PRIR.revisado) revisado, max(PRIR.trasnfe) trasnfe,
				PRIR.rowguid, max(DC.nro_doc) AS Nro_Doc_Orig, max(DC.co_tipo_doc) AS Tipo_Doc_Orig, max(dc.nro_fact) AS Nro_Fact_Orig,
				max(PDR.cob_num) cob_num, PRIR.rowguid_fact
				FROM
					saPagoRentenReng PRIR
					INNER JOIN saPagoDocReng AS PDR ON PRIR.Rowguid_Reng_Cob = PDR.rowguid --PDR = ISLR
					INNER JOIN saPagoDocReng AS PDR1 ON PDR1.rowguid_reng_ori = PDR.rowguid --PDR1= FACT
					INNER JOIN saDocumentoCompra AS DC ON PDR1.nro_doc = DC.nro_doc
														  AND DC.co_tipo_doc = PDR1.co_tipo_doc
				WHERE
					Rowguid_Reng_Cob =  @gRowguid_Reng_Cob 
			GROUP BY PRIR.co_islr, PRIR.rowguid_reng_cob, PRIR.co_us_in, PRIR.co_sucu_in, PRIR.co_us_mo, PRIR.co_sucu_mo, PRIR.fe_us_mo, PRIR.rowguid, PRIR.rowguid_fact
		END
    END
```

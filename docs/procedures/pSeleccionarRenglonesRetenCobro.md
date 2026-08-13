# SP: pSeleccionarRenglonesRetenCobro
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroRentenReng`](../tables/saCobroRentenReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesRetenCobro]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER
    )
AS 
    BEGIN
	IF (SELECT COUNT(*) FROM saCobroRentenReng CRIR INNER JOIN saCobroDocReng AS CDR ON CRIR.Rowguid_Reng_Cob = CDR.rowguid
				INNER JOIN saCobroDocReng AS CDR1 ON CDR.rowguid_reng_ori = CDR1.rowguid
				INNER JOIN saDocumentoVenta AS DV ON CDR1.nro_doc = DV.nro_doc AND DV.co_tipo_doc = CDR1.co_tipo_doc
			WHERE Rowguid_Reng_Cob = @gRowguid_Reng_Cob) >= 1
		BEGIN
			--RETENCION INDIVIDUAL
			SELECT
				CRIR.*, DV.nro_doc AS Nro_Doc_Orig, DV.co_tipo_doc AS Tipo_Doc_Orig, '' AS Nro_Fact_Orig,
				CDR.cob_num
			FROM
				saCobroRentenReng CRIR
				INNER JOIN saCobroDocReng AS CDR ON CRIR.Rowguid_Reng_Cob = CDR.rowguid
				INNER JOIN saCobroDocReng AS CDR1 ON CDR.rowguid_reng_ori = CDR1.rowguid
				INNER JOIN saDocumentoVenta AS DV ON CDR1.nro_doc = DV.nro_doc
													  AND DV.co_tipo_doc = CDR1.co_tipo_doc
			WHERE
				Rowguid_Reng_Cob = @gRowguid_Reng_Cob
	END
		ELSE
		BEGIN
			SELECT
			--RETENCION GLOBAL
				MAX(CRIR.reng_num) reng_num, CRIR.rowguid_reng_cob, CRIR.co_islr, MAX(CRIR.monto) monto,  MAX(CRIR.monto_reten) monto_reten,
				MAX(CRIR.monto_obj) monto_obj, MAX(CRIR.sustraendo) sustraendo, MAX(CRIR.porc_retn) porc_retn, CAST(MAX(CAST(CRIR.automatica as int)) as bit) automatica,
				CRIR.co_us_in, CRIR.co_sucu_in, CRIR.co_us_mo, CRIR.co_sucu_mo, CRIR.fe_us_mo, MAX(CRIR.revisado) revisado, MAX(CRIR.trasnfe) trasnfe,
				CRIR.rowguid, MAX(DV.nro_doc) AS Nro_Doc_Orig, MAX(DV.co_tipo_doc) AS Tipo_Doc_Orig, MAX(DV.nro_doc) AS Nro_Fact_Orig,
				MAX(CDR.cob_num) cob_num, CRIR.rowguid_fact
				FROM
					saCobroRentenReng CRIR
					INNER JOIN saCobroDocReng AS CDR ON CRIR.Rowguid_Reng_Cob = CDR.rowguid --PDR = ISLR
					INNER JOIN saCobroDocReng AS CDR1 ON CDR1.rowguid_reng_ori = CDR.rowguid --PDR1= FACT
					INNER JOIN saDocumentoVenta AS DV ON CDR1.nro_doc = DV.nro_doc
														  AND DV.co_tipo_doc = CDR1.co_tipo_doc
				WHERE
					Rowguid_Reng_Cob =  @gRowguid_Reng_Cob 
				GROUP BY CRIR.co_islr, CRIR.rowguid_reng_cob, CRIR.co_us_in, CRIR.co_sucu_in, CRIR.co_us_mo, CRIR.co_sucu_mo, CRIR.fe_us_mo, CRIR.rowguid, CRIR.rowguid_fact
		END
    END
```

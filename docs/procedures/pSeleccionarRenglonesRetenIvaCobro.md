# SP: pSeleccionarRenglonesRetenIvaCobro
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroRetenIvaReng`](../tables/saCobroRetenIvaReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesRetenIvaCobro]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER
    )
AS 
    BEGIN
	
        SELECT
            DV.nro_doc, DV.co_tipo_doc, PRIR.*, 
			CASE 
				WHEN PRIR.monto_ret_imp = 0 THEN 0.00 
				ELSE
				( ( PRIR.monto_ret_imp * 100 ) / DV.monto_imp )
			END AS porc_reten,

            DV.nro_doc AS numero_fact, DV.nro_doc AS numero_fact
            
        FROM
            saCobroRetenIvaReng AS PRIR
            INNER JOIN saCobroDocReng AS PDR ON PRIR.Rowguid_Reng_Cob = PDR.rowguid
            INNER JOIN saCobroDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
            INNER JOIN saDocumentoVenta AS DV ON PDR1.nro_doc = DV.nro_doc
                                                 AND DV.co_tipo_doc = PDR1.co_tipo_doc
          
        WHERE
            PRIR.Rowguid_Reng_Cob = @gRowguid_Reng_Cob

    END
```

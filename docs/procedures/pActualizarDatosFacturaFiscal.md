# SP: pActualizarDatosFacturaFiscal
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
CREATE PROC [dbo].[pActualizarDatosFacturaFiscal]
/******************************************************************************
* Stored Procedure : Actualiza los datos fiscales en la factura               *
* Desarrollador    : Softech Sistemas.                                           *
******************************************************************************/
    (
      @Fprofit CHAR(20) ,
      @impfis CHAR(20) ,
      @impfisfac CHAR(20) ,
      @ultZ CHAR(15)
    )
AS 
    BEGIN
	DECLARE @fecha_actual DATE = CAST(GETDATE() AS DATE)

        UPDATE
            saFacturaVenta
        SET impfis = @impfis, impfisfac = @impfisfac, imp_nro_z = @ultZ
		, fe_us_in = GETDATE() , fe_us_mo = GETDATE() 
		
		, fec_emis = CASE 
                  WHEN CAST(fec_emis AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_emis
               END,
		  fec_reg = CASE 
                  WHEN CAST(fec_reg AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_reg
               END,
          fec_venc = CASE 
                  WHEN CAST(fec_venc AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_venc
               END
		

        WHERE
            doc_num = @Fprofit

        UPDATE
            saDocumentoVenta
        SET impfis = @impfis, impfisfac = @impfisfac, imp_nro_z = @ultZ
		 , fe_us_in = GETDATE() , fe_us_mo = GETDATE() 
		
		, fec_emis = CASE 
                  WHEN CAST(fec_emis AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_emis
               END,
		  fec_reg = CASE 
                  WHEN CAST(fec_reg AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_reg
               END,
          fec_venc = CASE 
                  WHEN CAST(fec_venc AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_venc
               END
		
        WHERE
            nro_doc = @Fprofit
            AND co_tipo_doc = 'FACT'
    END
```

# SP: RepArchivo608NCF
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24/02/2017>
-- Description:	<DGII Formato de Envío de Comprobantes Anulados (608)>
-- =============================================
CREATE PROCEDURE [dbo].[RepArchivo608NCF] 

    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
				SELECT
					A.*
				FROM
					(
						SELECT 
							dv.co_tipo_doc, dv.nro_doc, dv.co_cli, rdv.ncf, dv.fec_emis,
							dv.fe_us_mo AS FECHA_ANULACION, 
							rdv.co_anulacion AS TIPO_ANULA 
						FROM
							saDocumentoVenta dv
							INNER JOIN saNCFInfoDocVenta rdv ON rdv.tipo_doc = dv.co_tipo_doc AND rdv.nro_doc = dv.nro_doc
						WHERE   
							dv.anulado = 1

					UNION ALL

						SELECT
							DC.co_tipo_doc, DC.nro_doc, DC.co_prov, NCF.ncf, DC.fec_emis,
							DC.fe_us_mo AS FECHA_ANULACION,
							NCF.co_anulacion AS TIPO_ANULA

						FROM
							saDocumentoCompra DC
							INNER JOIN saNCFInfoDocCompra NCF ON NCF.tipo_doc = DC.co_tipo_doc AND NCF.nro_doc = DC.nro_doc
						WHERE   
							DC.anulado = 1
					) A
				WHERE
					( @sFecha_d IS NULL
						OR dbo.FechaSimple(A.fec_emis) >= @sFecha_d
					)
					AND
					( @sFecha_h IS NULL
						OR dbo.FechaSimple(A.fec_emis) <= @sFecha_h
					)
								
				ORDER BY
					A.fec_emis 
			
		

    END
```

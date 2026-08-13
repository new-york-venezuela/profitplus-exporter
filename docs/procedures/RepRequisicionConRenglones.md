# SP: RepRequisicionConRenglones
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Cotizaciones de Proveedores por Proveedor >
-- LAST DATE:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepRequisicionConRenglones] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
	@cStatus CHAR(10) = NULL ,
	@sCo_Ubicacion CHAR(6) = NULL ,
	@sResponsable CHAR(128) = NULL ,
    @bHeaderRep     BIT = 0
AS 
    BEGIN
    
	SET NOCOUNT ON;
	    
        SELECT
			  PC.doc_num, PCR.fe_us_in, PCR.estatus, PCR.co_ubicacion, UBI.des_ubicacion, PCR.autorizado, PCR.responsable,
			  PCR.descripcion,PCRREN.reng_num, PCRREQREN.estatus, PCRREQREN.satisface, PCRREN.co_art,
			  A.art_des, PCRREN.co_uni, PCRREN.total_art, PCRREQREN.fecha_requerida,
			  PCRREQREN.fecha_real_entrega, PCRREQREN.comentario

        FROM
			saPlantillaCompraReng PCRREN 
			INNER JOIN saPlantillaCompra PC ON PC.doc_num = PCRREN.doc_num
			INNER JOIN saPlantillaCompraReq PCR ON PCR.rowguid_plantilla_compra = PC.rowguid
			INNER JOIN saPlantillaCompraReqRenglon PCRREQREN ON PCRREQREN.rowguid_plantilla_renglon = PCRREN.rowguid
			inner join saUbicacion UBI ON UBI.co_ubicacion = PCR.co_ubicacion
			--Documento:
			INNER JOIN saArticulo A ON A.co_art = PCRREN.co_art
		WHERE
            ( ( @cCo_Numero_d IS NULL
                OR PC.doc_num >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR PC.doc_num <= @cCo_Numero_h
                  )
            )
            AND ( ( @dCo_fecha_d IS NULL
                    OR dbo.FechaSimple(PCR.fecha) >= @dCo_fecha_d
                  )
                  AND ( @dCo_fecha_h IS NULL
                        OR dbo.FechaSimple(PCR.fecha) <= @dCo_fecha_h
                      )
                )
			AND (  (@cStatus IS NULL
					OR @cStatus = '3')
					OR PCR.estatus = @cStatus
					)
			AND ( @sCo_Ubicacion IS NULL
					OR PCR.co_ubicacion = @sCo_Ubicacion
					)
			AND ( @sResponsable IS NULL
					OR PCR.responsable like '%' + rtrim(@sResponsable) + '%'
					)
    END
```

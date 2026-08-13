# SP: RepComisionRentabilidadVenta
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)
- [`saComisionResultado`](../tables/saComisionResultado.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/02/2011>
-- Description:	<RepComisionRentabilidadVenta>
-- LAST DATE:2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepComisionRentabilidadVenta]
	  @dFecha_d  DATETIME = NULL,
      @dFecha_h  DATETIME = NULL,
      @sCo_Ven_d CHAR(6) = NULL,
      @sCo_Ven_h  CHAR(6) = NULL,
      @sTipoRen  CHAR(6) = NULL,
	  @sCo_sucu CHAR(10) = NULL,
      @bHeaderRep BIT = 0 
AS 
    BEGIN
        SET NOCOUNT ON ;
	
		SELECT FV.co_ven,
		FV.co_cli, 
		FV.cli_des, 
		CG.fecha,
		CG.fecha_hasta, 
		CG.fecha_desde,		
		CR.monto_01,
		CR.Monto_02, 
		CR.Monto_03, 
		CR.Monto_04, 
		CR.Monto_05, 
		CR.Monto_06,
		CR.Monto_07,
		CR.Monto_08,
		CR.Monto_09,
		CR.Monto_10,
		CR.Aux_01,
		CR.Aux_02,
		CR.Aux_03,
		CR.Aux_04,
		CR.Aux_05, 
		
		CG.co_comi,
		FV.co_sucu_in, 
		CASE 
		WHEN CR.tablaOri = 'saFacturaVentaReng' THEN 'FACT' 
		WHEN CR.tablaOri = 'saDevolucionClienteReng' THEN 'DEVO' 
		WHEN CR.tablaOri = ' saDocumentoVenta' THEN 'DOC'
		END  as tipo,
		FV.doc_num,
		V.ven_des 
		FROM saComisionResultado as CR 
		INNER JOIN saComisionGeneracion as CG ON CR.co_generacion = CG.co_generacion
		INNER JOIN 
		
(SELECT FV.doc_num, FV.co_ven, FVR.rowguid, 
		C.co_cli,C.cli_des, FV.co_sucu_in FROM saFacturaVentaReng as FVR 
		INNER JOIN saFacturaVenta as FV ON FVR.doc_num = FV.doc_num 
		and FV.anulado = 0
		INNER JOIN saCliente as C ON FV.co_cli = C.co_cli

		UNION ALL
		
SELECT FV.doc_num, FV.co_ven, FVR.rowguid, 
		C.co_cli,C.cli_des,FV.co_sucu_in  FROM saDevolucionClienteReng as FVR 
		INNER JOIN saDevolucionCliente as FV ON FVR.doc_num = FV.doc_num 
		and FV.anulado = 0
		INNER JOIN saCliente as C ON FV.co_cli = C.co_cli
		
		UNION ALL
SELECT FV.nro_doc, FV.co_ven, FV.rowguid, 
		C.co_cli,C.cli_des,FV.co_sucu_in  FROM saDocumentoVenta as FV 
		INNER JOIN saCliente as C ON FV.co_cli = C.co_cli) AS FV ON CR.IdOri = FV.rowguid
		INNER JOIN saVendedor as V ON FV.co_ven = V.co_ven



WHERE
		( ( @dFecha_d IS NULL
                        OR dbo.fechasimple(CG.fecha_desde) >= @dFecha_d) AND ( @dFecha_h IS NULL
                        OR dbo.fechasimple(CG.fecha_hasta) <= @dFecha_h))
	    AND ( @sTipoRen IS NULL
            OR CG.co_comi = @sTipoRen)
		AND ( @sCo_Ven_d IS NULL
                  OR FV.co_ven >= @sCo_Ven_d)
                AND (@sCo_Ven_h IS NULL
```

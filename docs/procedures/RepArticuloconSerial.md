# SP: RepArticuloconSerial
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<23-07-10>
 Description:	<Articulos con sus Seriales>
 =============================================*/
CREATE PROCEDURE [dbo].[RepArticuloconSerial]
	-- Add the parameters for the stored procedure here
    @sCo_art_d CHAR(30) = NULL ,
    @sCo_art_h CHAR(30) = NULL ,
    @sCo_Descripcion_d CHAR(120) = NULL ,
    @sCo_Descripcion_h CHAR(120) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Status CHAR(6) = NULL ,
    @bCo_Status_filtro BIT = NULL ,
    @sCo_Serial_d CHAR(6) = NULL ,
    @sCo_Serial_h CHAR(6) = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sCo_Status = 'ENT' ) 
            SET @bCo_Status_Filtro = 1
        IF ( @sCo_Status = 'PEN' ) 
            SET @bCo_Status_Filtro = 0
	
        SELECT
            A.co_art, 
            A.art_des, 
            S.serial, 
            S.co_alma, 
            doc_tip_e,
            CASE WHEN S.doc_tip_e = 'TRAS' THEN TR.tras_num
                 WHEN S.doc_tip_e = 'AJUS' THEN AR.ajue_entrada
                 WHEN S.doc_tip_e = 'COMP' THEN FCR.doc_num
                 WHEN S.doc_tip_e = 'CPRO' THEN CPR.doc_num
                 WHEN S.doc_tip_e = 'NREC' THEN NRCR.doc_num
                 WHEN S.doc_tip_e = 'DPRO' THEN DCR.doc_num
                 WHEN S.doc_tip_e = 'FACT' THEN FVR.doc_num
                 WHEN S.doc_tip_e = 'CCLI' THEN CCR.doc_num
                 WHEN S.doc_tip_e = 'DCLI' THEN DVR.doc_num
                 WHEN S.doc_tip_e = 'NENT' THEN NEVR.doc_num
                 ELSE NULL
            END AS e_doc_num,
            S.doc_tip_s, 
            CASE WHEN S.doc_tip_s = 'TRAS' THEN TR.tras_num
                 WHEN S.doc_tip_s = 'AJUS' THEN AR.ajue_salida
                 WHEN S.doc_tip_s = 'COMP' THEN FCR.doc_num
                 WHEN S.doc_tip_s = 'CPRO' THEN CPR.doc_num
                 WHEN S.doc_tip_s = 'NREC' THEN NRCR.doc_num
                 WHEN S.doc_tip_s = 'DPRO' THEN DCR.doc_num
                 WHEN S.doc_tip_s = 'FACT' THEN FVR.doc_num
                 WHEN S.doc_tip_s = 'CCLI'
```

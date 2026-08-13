# SP: RepArticulosCostosxLotexAlmacen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		<Softech Sistemas
 Create date:   <30-10-2014>
 Description:	<Artículos con sus Costos x Lote x Almacén>
 =============================================*/
CREATE PROCEDURE [dbo].[RepArticulosCostosxLotexAlmacen]
	-- Add the parameters for the stored procedure here
    @sCo_Codigo_d CHAR(30) = NULL ,
    @sCo_Codigo_h CHAR(30) = NULL ,
    @sCo_Descripcion_d CHAR(120) = NULL ,
    @sCo_Descripcion_h CHAR(120) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Almacen_d CHAR(6) = NULL ,
    @sCo_Almacen_h CHAR(6) = NULL ,
    @sTipo_Unidad CHAR(4) = NULL , -- (Si es primaria o secundaria)
    @sCo_Uni CHAR(6) = NULL ,
    @sCo_NumeroLote_d CHAR(20) = NULL ,
    @sCo_NumeroLote_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        DECLARE @bObtenerUnidadPrincipal BIT ;

---------------Valores por Defecto-------------------
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_alma'

--------------Fin Valores por Defecto----------------
        DECLARE @sCo_fecha_h DATETIME
        SET @sCo_fecha_h = GETDATE() 

        SET @sCo_fecha_h = dbo.fechasimple(@sCo_fecha_h)


        SELECT TOP 10000
            A.*, LE.numero_lote,--Le.fecha_expiracion,
            AL.co_alma, AL.des_alma, AU.co_uni AS co_unidad,
            CASE WHEN LE.tipo_doc = 'COMP' THEN
					'Factura de Compra'
				WHEN LE.tipo_doc = 'TRAS' THEN
					'Traslado'
				WHEN LE.tipo_doc = 'GCOM' THEN
					'Generación de Compuesto'
				WHEN LE.tipo_doc = 'NREC' THEN
					'Nota de Recepción'
				WHEN LE.tipo_doc ='DCLI' THEN
					'Devolución de Cliente'
			END AS tipo_doc, 
			ISNULL(FCR.doc_num, ISNULL(TR.tras_num, ISNULL(ACGR.gene_num, ISNULL(NRR.doc_num, DCR.doc_num)))) AS doc_num,
			ISNULL(FC.fec_emis, ISNULL(T.fecha, ISNULL(ACG.fecha, ISNULL(NR.fec_emis, DC.fec_emis)))) AS fec_emis,
			ISNULL(FCR.cost_unit, ISNULL(TR.cost_unit, ISNULL(ACGR.cost_unit, ISNULL(NRR.cost_unit, 0)))) AS costo_unit,
			LE.fecha_expiracion
			
        FROM
            saArticulo AS A
```

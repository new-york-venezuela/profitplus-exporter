# SP: RepStockArticulosSecundarios
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2014-08-15>
-- Description:	<Artículos Secundarios con su Stock>
-- =============================================
CREATE PROCEDURE [dbo].[RepStockArticulosSecundarios]
    @sCo_Art_d CHAR(30) = NULL,
    @sCo_Art_h CHAR(30) = NULL,
    @sCo_Alma CHAR(6) = NULL,
    @sCo_Lin_d CHAR(6) = NULL,
    @sCo_Lin_h CHAR(6) = NULL,
    @sCo_Subl_d CHAR(6) = NULL,
    @sCo_Subl_h CHAR(6) = NULL,
    @sCo_Color_d CHAR(6) = NULL,
    @sCo_Color_h CHAR(6) = NULL,
    @sCo_Cat_d CHAR(6) = NULL,
    @sCo_Cat_h CHAR(6) = NULL,
    @deFactor decimal(18,5) = NULL,
    @dePorcError decimal(18,5) = NULL,
	@sCo_Movimiento CHAR(4) = NULL ,
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
    @sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6) = NULL,
    @bHeaderRep BIT= 0
AS
BEGIN
      SET NOCOUNT ON;
	  IF @deFactor IS NULL OR @deFactor = 0 --OR  @deFactor = ' '
		set @deFactor = 0
	  IF @dePorcError IS NULL OR @dePorcError = 0 -- OR @dePorcError = ' '
		set @dePorcError = -1
	  IF ( @sCo_Movimiento IS NULL OR @sCo_Movimiento = 'TODO') 
        SET @sCo_Movimiento = NULL

	  IF @dFecha_d IS NOT NULL
		SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
  
	  IF @dFecha_h IS NOT NULL
		SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
	  declare @sCo_Sucursal CHAR(6) 
	  set @sCo_Sucursal = NULL 

       Select A.co_art, ART.art_des,
              A.tipodoc, A.doc_num, A.reng_num, A.co_alma,
              A.co_uni, A.total_art, AUP.co_uni as co_uni_prin, A.total_art_prin,
              A.sco_uni, A.stotal_Art, AUS.co_uni as co_uni_sec, A.total_art_sec,
              (A.total_art_sec/A.total_art_prin) as Equivalencia,
              ISNULL((case when @deFactor = 0 then 0 else ROUND( ((A.total_art_sec /(A.total_art_prin* @deFactor))- 1)*100,2) end),0) as Porc_diferencia,
			  A.fecha
       FROM
       (
       Select
              'FACT' AS TipoDoc, R.doc_num, R.reng_num,
              R.co_art, R.co_alma,
              R.co_uni, R.total_art,  
              ISNULL([dbo].[ArtUnidadBase](R.co_art,R.co_uni,R.total_art),0.00000) as total_art_prin,
              R.sco_uni, R.stotal_Art,
              ISNULL([dbo].[ArtUnidadBase](R.co_art,R.sco_uni,R.stotal_art),0.00000) as total_art_sec, E.fec_emis as fecha
       from saArticulo A
              inner join saFacturaVentaReng R ON R.co_art = A.co_art
              inner j
```

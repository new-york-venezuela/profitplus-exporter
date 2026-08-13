# SP: RepDevolucionClientexReng
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/02/2011>
-- Description:	<Reporte de Devoluciones a Clientes por Renglones>
-- =============================================
CREATE PROCEDURE [dbo].[RepDevolucionClientexReng] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
    @cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
    @cTipo_origen CHAR(6) = NULL ,
    @cStatus CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)


-- Insert statements for procedure here

-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        IF ( @cTipo_origen IS NULL
             OR @cTipo_origen = 'TODO'
           ) 
            SET @cTipo_origen = NULL
 
        SELECT
            @cAnulado AS Filtro_anulado, 'devo' AS tip_rep, ART.art_des, ART.modelo, CL.cli_des, VE.ven_des, TR.des_tran,
            CP.cond_des,		
		/*Campos saFacturaVenta*/ FV.doc_num, FV.co_cli, FV.co_tran, FV.co_ven, FV.fec_emis, FV.fec_venc, FV.anulado,
		/*Campos saFacturaVentaReng*/ FVR.reng_num, FVR.doc_num, FVR.co_art, FVR.co_alma,
            ( CASE WHEN AU.uni_principal = 1 THEN ROUND(( dbo.ArtUnidadBase(FVR.co_art, FVR.co_uni, FVR.total_art) ), 5)
                   ELSE ROUND(( dbo.ArtUnidadBase(FVR.co_art, FVR.co_uni, 1) ), 5) / FVR.total_art
              END ) AS total_art, AU.co_uni,
            ( CASE WHEN AU.uni_principal = 1 THEN FVR.prec_vta
                   ELSE FVR.prec_vta / ROUND(( dbo.ArtUnidadBase(FVR.co_art, FVR.co_uni, 1) ), 5)
              END ) AS prec_vta, FVR.porc_desc, FV
```

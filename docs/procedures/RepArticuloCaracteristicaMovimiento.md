# SP: RepArticuloCaracteristicaMovimiento
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepArticuloCaracteristicaMovimiento
DESCRIPCION: Reporte de Articulos con sus Caracteristicas por sus Movimientos
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[RepArticuloCaracteristicaMovimiento]
	-- Add the parameters for the stored procedure here
    @sco_art char(30) = NULL,
	@dFecha_d smalldatetime = NULL,
	@dFecha_h smalldatetime = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
BEGIN

SET NOCOUNT ON;

IF (@sco_art IS  NULL and @bHeaderRep = 0)    
	BEGIN
		RAISERROR('No es posible ejecutar el reporte, debe seleccionar un artículo.',16,1);
		RETURN
	END 
	
select * from (	      
Select A.co_art, A.art_des, AV.Co_uni, AV.[tipo_doc],AV.[Num_Doc], AV.co_alma,
	case	when av.tipo_doc in('AJUE','AJUS') then Aju.fecha  
			when av.tipo_doc in('COMP')and Fc.anulado    = 0 then Fc.fec_emis  
			when av.tipo_doc in('DCLI')and D.anulado     = 0 then D.fec_emis  
			when av.tipo_doc in('DPRO')and Dpro.anulado  = 0 then Dpro.fec_emis  
			when av.tipo_doc in('FACT')and Fv.anulado    = 0 then Fv.fec_emis  
			when av.tipo_doc in('GCOM') then GC.fecha  
			when av.tipo_doc in('RGEN') then GCR.fecha
			when av.tipo_doc in('NDES')and NDES.anulado  = 0 then NDES.fec_emis
			when av.tipo_doc in('NENT')and NENT.anulado  = 0 then NENT.fec_emis
			when av.tipo_doc in('NREC')and NREC.anulado  = 0 then NREC.fec_emis
			when av.tipo_doc in('TRAS')and trass.anulado = 0 then trass.fec_sal
			when av.tipo_doc in('TRAE')and trase.anulado = 0 then trase.fec_conf
			--when av.tipo_doc in('TRAS') then trass2.fec_sal
			--when av.tipo_doc in('TRAE') then trase2.fec_conf
			else null end as fecha_reg,
	AV.[co_subl01], sub_01.subl_des AS subl_des01, 
	AV.[co_subl02], sub_02.subl_des AS subl_des02, 
	AV.[co_subl03], sub_03.subl_des AS subl_des03, 
	AV.[co_subl04], sub_04.subl_des AS subl_des04, 
	AV.[co_subl05], sub_05.subl_des AS subl_des05, 
	case when av.tipo_doc =('DPRO') then (AV.[cantidad]*-1) else AV.[cantidad] end as cantidad, av.reng_num 
     FROM savArtCaracteristica       AS Av
       INNER JOIN saArticulo         AS A    ON A.co_art        = AV.co_art														
	   left join saAjuste            AS Aju  ON Aju.ajue_num    = AV.Num_D
```

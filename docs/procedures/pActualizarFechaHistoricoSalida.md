# SP: pActualizarFechaHistoricoSalida
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarFechaHistoricoSalida]
*DESCRIPCIÓN	: Actualiza la fecha de registro de la tabla saCostoHistoricoSalida
				  al momento que es modificada la misma en el documento original
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarFechaHistoricoSalida]
    (
      @sdFecha_Registro SMALLDATETIME ,
      @sCo_Documento CHAR(20) ,
      @sTipo_Doc CHAR(4)
    )
AS 
    BEGIN
		
		
        IF ( @sTipo_Doc = 'AJUS' ) 
            BEGIN

                UPDATE
                    saCostoHistoricoSalida
                SET fecha_emision = @sdFecha_Registro
                WHERE
                    doc_orig IN ( SELECT
                                    r.rowguid
                                  FROM
                                    saAjusteReng r
                                  WHERE
                                    r.ajue_num = @sCo_Documento )
            END	
			
		--- Agregados segun analisis, se agregaran los procesos que manejen costos de salida
		--- como traslado,generacion de compuesto, devolucion proveedor, factura de 
		--- venta, nota de entrega. Como el Sp es llamado desde el proyecto, se agregaran en el
		--- BOR en el metodo ArmarActualizar de los procesos antes mencionados. 


        IF ( @sTipo_Doc = 'TRAS' ) 
            BEGIN

                UPDATE
                    saCostoHistoricoSalida
                SET fecha_emision = @sdFecha_Registro
                WHERE
                    doc_orig IN ( SELECT
                                    r.rowguid
                                  FROM
                                    saTrasladoReng r
                                  WHERE
                                    r.tras_num = @sCo_Documento )
            END	
					
        IF ( @sTipo_Doc = 'GCOM' ) 
            BEGIN

                UPDATE
                    saCostoHistoricoSalida
                SET fecha_emision = @sdFecha_Registro
                WHERE
                    doc_orig IN ( SELECT
                                    r.rowguid
                                  FROM
                                    saArtCompuestoGenReng r
                                  WHERE
                                    r.gene_num = @sCo_Documento )
            END	
		
        IF ( @sTipo_Doc = '
```

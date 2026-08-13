# SP: pActualizarFechaHistoricoEntrada
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarFechaHistoricoEntrada]
*DESCRIPCIÓN	: Actualiza la fecha de registro de la tabla saCostoHistoricoEntrada
				  al momento que es modificada la misma en el documento original
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarFechaHistoricoEntrada]
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
                    saCostoHistoricoEntrada
                SET fecha_registro = @sdFecha_Registro, fecha_emision = @sdFecha_Registro
                WHERE
                    doc_orig IN ( SELECT
                                    r.rowguid
                                  FROM
                                    saAjusteReng r
                                  WHERE
                                    r.ajue_num = @sCo_Documento )
            END	
		
		--- Bucles agregados segun analisis, se agregaran los procesos que manejen costos de entrada
		--- como traslado,generacion de compuesto, factura de compra, nota de recepcion y devolucion
		--- cliente. Como el Sp es llamado desde el proyecto, se agregaran en el BOR en el metodo
		--- ArmarActualizar de los procesos antes mencionados.
		
				
        IF ( @sTipo_Doc = 'TRAS' ) 
            BEGIN

                UPDATE
                    saCostoHistoricoEntrada
                SET fecha_registro = @sdFecha_Registro, fecha_emision = @sdFecha_Registro
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
                    saCostoHistoricoEntrada
                SET fecha_registro = @sdFecha_Registro, fecha_emision = @sdFecha_Registro
                WHERE
                    doc_orig IN ( SELECT
                                    r.rowguid
                                  FROM
                                    saArtCompuestoGenReng r
```

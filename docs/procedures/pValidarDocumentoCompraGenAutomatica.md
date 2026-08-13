# SP: pValidarDocumentoCompraGenAutomatica
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarDocumentoCompraGenAutomatica]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
        SET NOCOUNT ON ;
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(1024) )

        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                DC.nro_doc, DC.co_tipo_doc, DC.rowguid, '10' AS tipo,
                CASE WHEN DC.doc_orig <> 'FACT' THEN ' Doc_orig,'
                     ELSE ''
                END + CASE WHEN DC.aut <> 1 THEN ' Aut,'
                           ELSE ''
                      END + CASE WHEN DC.nro_orig <> F.doc_num
                                      OR DC.nro_orig IS NULL THEN ' nro_orig,'
                                 ELSE ''
                            END + CASE WHEN DC.Fec_Reg <> F.Fec_Reg THEN ' Fec_Reg,'
                                       ELSE ''
                                  END + CASE WHEN DC.Fec_Emis <> F.Fec_Emis THEN ' Fec_Emis,'
                                             ELSE ''
                                        END + CASE WHEN DC.Fec_Venc <> F.Fec_Venc THEN ' Fec_Venc,'
                                                   ELSE ''
                                              END + CASE WHEN DC.Co_Mone <> F.Co_Mone THEN ' Co_Mone,'
                                                         ELSE ''
                                                    END + CASE WHEN DC.tasa <> F.tasa THEN ' Tasa,'
                                                               ELSE ''
                                                          END + CASE WHEN DC.N_Control <> F.N_Control THEN ' N_Control,'
                                                                     ELSE ''
                                                                END
                + CASE WHEN DC.Nro_Fact <> F.Nro_Fact THEN ' Nro_Fact,'
                       ELSE ''
                  END + CASE WHEN DC.anulado <> F.anulado THEN ' Anulado,'
                             ELSE ''
                        END + CASE WHEN DC.Total_Bruto <> F.Total_Bruto THEN ' Total_Bruto,'
                                   ELSE ''
                              END + CASE WHEN DC.Monto_Reca <> F.Monto_Reca THEN ' Monto_Reca,'
                                         ELSE ''
                                    END + CASE WHEN DC.Monto_Desc_Glob <> F.Monto_Desc_Glob THEN ' Mon
```

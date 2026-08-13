# SP: pConsultarCostos
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: [pConsultarCostos]
DESCRIPCION	: Consultar los costos para un Tipo de Documento
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 17/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [pConsultarCostos]
    (
      @sCodigo CHAR(20) = NULL ,
      @sTipoDocumento CHAR(4)
    )
AS 
    BEGIN

        DECLARE @dateDefault DATETIME

        SET @dateDefault = CONVERT(DATETIME, '19900101', 112)
	
        IF ( @sTipoDocumento = 'AJUS' ) --Ajuste de Entrada/Salida
            BEGIN
                SELECT
                    AJR.reng_num, CASE TA.tipo_trans
                                    WHEN 0 THEN 'Entrada'
                                    ELSE 'Salida'
                                  END tipo_operacion, RTRIM(AJR.co_art) co_art, RTRIM(AT.art_des) art_des,
                    RTRIM(AU.co_uni) co_uni, RTRIM(AJR.co_alma) co_alma, CASE TA.tipo_trans
                                                                           WHEN 0 THEN ISNULL(CHE.cantidad, 0)
                                                                           ELSE ISNULL(CHS.cantidad, 0)
                                                                         END cantidad,
                    CASE TA.tipo_trans
                      WHEN 0 THEN ISNULL(CHE.cantidad_usada, 0)
                      ELSE 0
                    END cantidad_usada, CASE TA.tipo_trans
                                          WHEN 0 THEN ISNULL(CHE.costo, 0)
                                          ELSE ISNULL(CHE2.costo, 0)
                                        END costo_unitario, CASE TA.tipo_trans
                                                              WHEN 0 THEN costo_adi1
                                                              ELSE 0
                                                            END costo_adi1, CASE TA.tipo_trans
                                                                              WHEN 0 THEN costo_adi2
                                                                              ELSE 0
                                                                            END costo_adi2, CASE TA.tipo_trans
                                                                                              WHEN 0 THEN costo_adi3
```

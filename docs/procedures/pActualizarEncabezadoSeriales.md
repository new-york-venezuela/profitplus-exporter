# SP: pActualizarEncabezadoSeriales
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08/12/2009>
-- Description:	<Actualiza el Encabezado del Renglon para Indicar que cambio>
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarEncabezadoSeriales]
    (
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @tsValidador TIMESTAMP ,
      @sDoc_Tipo CHAR(4)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @rowGuidPadre UNIQUEIDENTIFIER
	--Ajustes
        IF ( @sDoc_Tipo = 'AJUS' ) 
            BEGIN
                UPDATE
                    saAjuste
                SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
                OUTPUT
                    inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                    INTO @TableTimestamp
                WHERE
                    rowguid = @gRowguid
                    AND validador = @tsValidador
            END
        ELSE
	--Traslados
            IF ( @sDoc_Tipo = 'TRAS' ) 
                BEGIN
                    UPDATE
                        saTraslado
                    SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
                    OUTPUT
                        inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                        INTO @TableTimestamp
                    WHERE
                        rowguid = @gRowguid
                        AND validador = @tsValidador
                END
	--Articulos compuestos
        IF ( @sDoc_Tipo = 'ARTC' ) 
            BEGIN
                UPDATE
                    saArtCompuestoGen
                SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
                OUTPUT
                    inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                    INTO @TableTimestamp
                WHERE
                    rowguid = @gRowguid
                    AND validador = @tsValidador
            END
	--Compras
        IF ( @sDoc_Tipo = 'COMP' ) 
            BEGIN
                UPDATE
```

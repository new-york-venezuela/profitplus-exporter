# SP: pv_ActualizaImpuestoRenglon
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pv_ActualizaImpuestoRenglon
*DESCRIPCIÓN	: Actualizar el impuesto del renglón de la factura 
*AUTOR			: Softech Sistemas
************************************************************************/

CREATE PROCEDURE [dbo].[pv_ActualizaImpuestoRenglon]
    (
      @sFact_Num CHAR(20) ,
      @iReng int ,
      @sTipo_Imp CHAR(1) ,
      @sPorc_Imp DECIMAL(18,5)
    )
AS 
    BEGIN

        UPDATE
            saFacturaVentaReng
        SET tipo_imp = @sTipo_Imp, porc_imp = @sPorc_Imp
        WHERE
            reng_num = @iReng
            AND doc_num = @sFact_Num

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER


    END
```

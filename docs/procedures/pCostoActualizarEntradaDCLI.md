# SP: pCostoActualizarEntradaDCLI
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarEntradaDCLI]
    @RowGuid_Doc_Orig UNIQUEIDENTIFIER ,
    @TipoCosto CHAR(1) = NULL,
    @Tipo_DocOrigenDe  CHAR(5) = NULL
AS 
BEGIN

SET NOCOUNT ON

IF ( @TipoCosto IS NULL ) 
            SELECT @TipoCosto = i_costo_inventario FROM par_emp

-- Se asume que la devolución solo tiene asociado una entrada (viene de proceso de recosteo pCostoActualizaEntradaTodos
DECLARE @PendienteCantidadAsignar DECIMAL(18, 5)
DECLARE @IdCostoEntradaAsociado UNIQUEIDENTIFIER
DECLARE @RowGuid_Art UNIQUEIDENTIFIER
DECLARE @strCod_Almacen CHAR(20)
DECLARE @iRengNumActual AS INT
DECLARE @Fecha_Us_In AS DATETIME
DECLARE @Fecha_Doc AS DATETIME
DECLARE @IdDocumentoOrigenDev AS UNIQUEIDENTIFIER
DECLARE @Tipo_DocOrigenDev AS CHAR(4)

-- Se obtiene el identificador asociado al renglon de origen de la devolucion (factura o nota entrega)
Select
        @IdDocumentoOrigenDev = DCLIR.rowguid_doc, @Tipo_DocOrigenDev = DCLIR.tipo_doc 
From
    saDevolucionClienteReng DCLIR
Where
    DCLIR.rowguid = @RowGuid_Doc_Orig

            -- Si es una nota de despacho hay que buscar el costo ya sea en la factura o en la nota de entrega
If @Tipo_DocOrigenDev = 'NDES'
Begin
       Select @IdDocumentoOrigenDev = NDESP.rowguid_doc, @Tipo_DocOrigenDev = NDESP.tipo_doc 
             From  saNotaDespachoVentaReng NDESP Where rowguid =@IdDocumentoOrigenDev
End

-- Se obtiene los costos de salida asociados al documento origen de la devolucion
DECLARE @tablaGenericaSalidasAsociadasOrigen TABLE
    (
        RowGuid_CHS UNIQUEIDENTIFIER ,
        Costo DECIMAL(18, 5) ,
        Costo_p DECIMAL(18, 5) ,
        Total_Art DECIMAL(18, 5) ,
        Total_Disp DECIMAL(18, 5) ,
        fecha_doc DATETIME ,
        Tipo_Doc CHAR(4),
        fecha_ins DATETIME
    )
        
INSERT  INTO @tablaGenericaSalidasAsociadasOrigen
-- Cantidad es la original menos la que ya existe otras devoluciones que hagan uso
        SELECT
            CHS.cod_costo_historico_salida, ISNULL(CHE.costo, 0), ISNULL(CHS.costo_pro, 0), CHS.cantidad,
            CHS.cantidad -  (case @Tipo_DocOrigenDe when 'DCLI1' then [dbo].[CostoCantidadProcesadaEntrada](CHS.cod_costo_historico_salida) else (SELECT ISNULL(SUM(cantidad),0) FROM saCostoHistoricoEntrada  WHERE rtrim( cod_costo_historico_salida_orig) = rtrim(CHS.cod_costo_historico_salida)) end),
            CHE.fecha_emision, CHS.tipo_doc,CHE.fecha_registro
        FROM
            saCostoHistoricoSali
```

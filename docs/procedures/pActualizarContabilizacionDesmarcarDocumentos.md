# SP: pActualizarContabilizacionDesmarcarDocumentos
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saCobro`](../tables/saCobro.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saPago`](../tables/saPago.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pActualizarContabilizacionDesmarcarDocumentos
DESCRIPCION	: Desmarcar los documentos con el comprobante que se desproceso
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 28/04/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarContabilizacionDesmarcarDocumentos]
	 (
      @sTipoDocumentos VARCHAR(MAX) ,
      @sdFeccom SMALLDATETIME ,
      @iNumcom INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60)
    )
AS 
    BEGIN

        DECLARE @TableDocumentosDesmarcados TABLE
            (
              nombreTabla VARCHAR(32) ,
              campo VARCHAR(MAX) ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        DECLARE CursorDocumentosDesmarcados CURSOR FAST_FORWARD
        FOR
            SELECT
                nombreTabla, campo, fe_us_mo, rowguid
            FROM
                @TableDocumentosDesmarcados
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @nombreTabla VARCHAR(32)
        DECLARE @campo VARCHAR(MAX)
		
	--Movimiento de Banco
        IF ( CHARINDEX('MBAN', @sTipoDocumentos) <> 0 ) 
            BEGIN
                UPDATE
                    saMovimientoBanco
                SET feccom = NULL, numcom = NULL, fe_us_mo = GETDATE(), co_sucu_mo = @sCo_Sucu_Mo, co_us_mo = @sCo_Us_Mo
                OUTPUT
                    'saMovimientoBanco',
                    '[Feccom]=' + CONVERT(NVARCHAR(100), Deleted.feccom, 121) + '->'
                    + CONVERT(NVARCHAR(100), ISNULL(Inserted.feccom, 0), 121) + '|[Numcom]='
                    + CAST(Deleted.numcom AS VARCHAR) + '->' + CAST(ISNULL(Inserted.numcom, 0) AS VARCHAR),
                    Inserted.fe_us_mo, Inserted.rowguid
                    INTO 
				@TableDocumentosDesmarcados
                WHERE
                    feccom = @sdFeccom
                    AND numcom = @iNumcom
            END
	--Ajuste de Entrada y Salida
        IF ( CHARINDEX('AJUE', @sTipoDocumentos) <> 0 ) 
            BEGIN
                UPDATE
                    saAjuste
                SET feccom = NULL, numcom = NULL, fe_us_mo = GETDATE(), co_sucu_mo = @sCo_Sucu_Mo, co_us_mo = @sCo_Us_Mo
                OUTP
```

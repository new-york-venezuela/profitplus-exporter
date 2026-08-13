# SP: pValidarExistenciaComprobanteIVA
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************
*NOMBRE			: [pValidarExistenciaComprobanteIVA]
*DESCRIPCIÓN	: Validar si Existe un numero de comprobante de iva para una fecha para un cliente
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-09-20
**************************************************************************************/

CREATE PROCEDURE [pValidarExistenciaComprobanteIVA]
    (
      @sdFecha SMALLDATETIME ,
      @sCoCLi CHAR(16) ,
      @besVenta BIT ,
      @bQuincena BIT = 0 -- Reservado para futuras implementaciones
    )
AS 
    BEGIN	

        DECLARE @sdDia AS INT
        DECLARE @sdFechaDesde SMALLDATETIME
        DECLARE @sdFechaHasta SMALLDATETIME
        DECLARE @sComprobanteResult CHAR(14)
	
        SET @sdDia = DAY(@sdFecha)
        SET @sdFechaDesde = dbo.FechaSimple(@sdFecha)
	-- Primero de mes
        SET @sdFechaDesde = DATEADD(dd, ( @sdDia * -1 ) + 1, @sdFechaDesde)
	
        IF ( @sdDia <= 15 ) 
            BEGIN
                SET @sdFechaHasta = DATEADD(dd, 15, @sdFechaDesde)
            END
        ELSE 
            BEGIN
                SET @sdFechaHasta = DATEADD(dd, -1, DATEADD(mm, 1, @sdFechaDesde))
                SET @sdFechaDesde = DATEADD(dd, 15, @sdFechaDesde)
            END
	
        DECLARE @existe BIT

        IF ( @besVenta = 1 ) 
            SELECT
                @sComprobanteResult = MAX(num_comprobante)
            FROM
                saDocumentoVenta DC
            WHERE
                DC.co_cli = @sCoCLi
                AND LEN(num_comprobante) = 14
                AND ISNUMERIC(RIGHT(num_comprobante, 6)) = 1
                AND DC.fec_emis BETWEEN @sdFechaDesde AND @sdFechaHasta
        ELSE 
            SELECT
                @sComprobanteResult = MAX(num_comprobante)
            FROM
                saDocumentoCompra DC
            WHERE
                DC.co_prov = @sCoCLi
                AND LEN(num_comprobante) = 14
                AND ISNUMERIC(RIGHT(num_comprobante, 6)) = 1
                AND DC.fec_emis BETWEEN @sdFechaDesde AND @sdFechaHasta
	
        IF ( @sComprobanteResult IS NULL ) 
            SET @sComprobanteResult = ''
						
        SELECT
            @sComprobanteResult AS ExisteComprobante

    END
```

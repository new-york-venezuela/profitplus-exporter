# SP: pValidarRengImportadoCotizacionClienteReng
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarRengImportadoCotizacionClienteReng]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER

    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @R1Id UNIQUEIDENTIFIER
        DECLARE @pR1Doc_Num CHAR(20)
        DECLARE @pR1Num_Doc CHAR(20)
        DECLARE @pR2Doc_Num CHAR(20)
        DECLARE @pR1Reng_num INT
        DECLARE @pR2Reng_num INT
        DECLARE @pR1Co_Art CHAR(30)
        DECLARE @pR2Co_Art CHAR(30)
        DECLARE @pR1Co_Alma CHAR(6)
        DECLARE @pR2Co_Alma CHAR(6)
        DECLARE @pR1Co_Uni CHAR(6)
        DECLARE @pR2Co_Uni CHAR(6)
        DECLARE @PuedeCorregirZoombies BIT
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @PuedeCorregir BIT
        DECLARE @TipoDocOrig CHAR(4)

        SET @TipoDocOrig = 'CCLI'

        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                R1.rowguid, R1.doc_num, R1.num_doc, R2.doc_num, R1.reng_num, R2.reng_num, R1.co_art, R2.co_art,
                R1.co_alma, R2.co_alma, R1.co_uni, R2.co_uni, 1 AS PuedeCorregir
            FROM
                saFacturaVentaReng R1
                LEFT JOIN saCotizacionClienteReng R2 ON R1.rowguid_doc = R2.rowguid
            WHERE
                R1.tipo_doc = @TipoDocOrig
                AND ( R2.rowguid IS NULL
                      OR R1.co_art <> R2.co_art
                      OR R1.co_alma <> R2.co_alma
                      OR R1.co_uni <> R2.co_uni
                      OR R1.num_doc <> R2.doc_num
                    )
            ORDER BY
                R1.doc_num, R1.reng_num

        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @R1Id, @pR1Doc_Num, @pR1Num_Doc, @pR2Doc_Num, @pR1Reng_num, @pR2Reng_num,
            @pR1Co_Art, @pR2Co_Art, @pR1Co_Alma, @pR2Co_Alma, @pR1Co_Uni, @pR2Co_Uni, @PuedeCorregirZoombies

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PuedeCorregir = 1
                IF @pR2Reng_num IS NULL 
                    BEGIN
                        SET @PistaMensaje = 'La factura de venta nro. "' + RTRIM(@pR1Doc_Num) + '" renglon "'
                            + LTRIM(RTRIM(STR(@pR1Reng_num))) + '" viene de un renglon que no existe.' 
                        SET @PuedeCorregir = @PuedeCorregirZoombies
```

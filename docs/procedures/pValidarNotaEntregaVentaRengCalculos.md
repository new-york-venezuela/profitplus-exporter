# SP: pValidarNotaEntregaVentaRengCalculos
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarNotaEntregaVentaRengCalculos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @pMontoOri DECIMAL(18, 5)
        DECLARE @pMontoNew DECIMAL(18, 5)
        DECLARE @pRengNum INT
        DECLARE @pDoc_Num CHAR(20)
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @Impresa BIT
        DECLARE @CobrosAsociados BIT
        DECLARE @Contabilizada BIT
        DECLARE @Procesada BIT
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME

        DECLARE @bPuedeCorregir BIT
	
        DECLARE @i INT
        SET @i = 1

        WHILE @i <= 4 
            BEGIN
		
                IF ( @i = 1 ) 
                    BEGIN
                        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
                        FOR
                            SELECT
                                R.monto_desc AS montoActual,
                                ROUND(dbo.CalcularMontoPorcentaje(R.porc_desc, R.prec_vta * R.total_art, 1), 5) AS montoCalculado,
                                R.reng_num, R.doc_num, R.rowguid, E.impresa,
                                CASE WHEN ( E.total_neto <> E.saldo ) THEN 1
                                     ELSE 0
                                END AS cobrosasociados, CASE WHEN ( E.numcom IS NULL
                                                                    AND E.feccom IS NULL
                                                                  ) THEN 0
                                                             ELSE 1
                                                        END AS contabilizada, CASE WHEN ( E.status <> 0 ) THEN 1
                                                                                   ELSE 0
                                                                              END AS procesada
                            FROM
                                saNotaEntregaVentaReng R
                                INNER JOIN saNotaEntregaVenta E ON E.doc_num = R.doc_num
                            WHERE
                                R.monto_desc <> ROUND(dbo.CalcularMontoPorcentaje(R.porc_desc, R.prec_vta * R.total_art,
                                                                                  1), 5)
                    END
```

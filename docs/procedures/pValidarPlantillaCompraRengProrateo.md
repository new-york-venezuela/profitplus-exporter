# SP: pValidarPlantillaCompraRengProrateo
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarPlantillaCompraRengProrateo]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @pdoc_num CHAR(20)
        DECLARE @pReng_num INT
        DECLARE @pValorOld DECIMAL(18, 5)
        DECLARE @pvalorNew DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @Impresa BIT
        DECLARE @CobrosAsociados BIT
        DECLARE @Contabilizada BIT
        DECLARE @Procesada BIT

        DECLARE @bPuedeCorregir BIT

        DECLARE @i INT
        SET @i = 1

        WHILE @i <= 5 
            BEGIN
                IF ( @i = 1 ) 
                    BEGIN
                        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
                        FOR
                            SELECT
                                R.doc_num, R.reng_num, R.otros1_glob AS ValorOld,
                                ROUND(( E.otros1 * R.reng_neto ) / E.total_bruto, 5) AS ValorNew, R.rowguid, E.impresa,
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
                                saPlantillaCompraReng R
                                INNER JOIN saPlantillaCompra E ON E.doc_num = R.doc_num
                            WHERE
							 E.total_bruto > 0 
								 AND
                                R.otros1_glob <> ROUND(( E.otros1 * R.reng_neto ) / E.total_bruto, 5)
                                AND R.reng_num <> ( SELECT
                                                        MAX(RMAX.reng_num)
```

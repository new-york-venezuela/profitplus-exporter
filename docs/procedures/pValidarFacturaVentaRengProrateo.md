# SP: pValidarFacturaVentaRengProrateo
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarFacturaVentaRengProrateo]
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
		 DECLARE @DesdePV BIT 

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
                                                                              END AS procesada ,
																			  CASE WHEN (EXT.rowguid_doc_num IS NULL) THEN 0 ELSE 1 END AS desdePV
                            FROM
                                saFacturaVentaReng R
                                INNER JOIN saFacturaVenta E ON E.doc_num = R.doc_num
								 LEFT JOIN pvFacturaVentaExt EXT ON Ext.rowguid_doc_num = E.rowguid 
								 left join saDocumentoVenta dv on dv.nro_doc = e.doc_num and dv.co_tipo_doc='FACT' --DN 060522
		                         left join saDocumentoVentaInfoIGTF dvig on
```

# SP: pValidarPendienteNotaDespachoVentaReng
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarPendienteNotaDespachoVentaReng]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN    
       
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )

        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR

             SELECT
                F.doc_num, F.reng_num, F.pendiente AS pedienteOld, F.total_art - F.total_art_import AS pedienteNew,
                F.rowguid
            FROM
                ( SELECT
                    R.rowguid, R.doc_num, R.reng_num, R.total_art, R.pendiente,
                    ISNULL(I.total_art, 0) AS total_art_import
                  FROM
                    saNotaDespachoVentaReng R
                    LEFT JOIN ( SELECT
                                    A.rowguid_doc, SUM(A.total_art) AS total_art
                                FROM
                                    ( 
                                  -- Las devoluciones afectan pendiente
                                      SELECT
                                        SUM(R.total_art) AS total_art, R.rowguid_doc
                                      FROM
                                       saDevolucionClienteReng R
                                        INNER JOIN saDevolucionCliente E ON E.doc_num = R.doc_num
                                      WHERE
                                        tipo_doc = 'NDES'
                                        AND e.anulado = 0
                                      GROUP BY
                                        rowguid_doc
                                    ) A
                                GROUP BY
                                    A.rowguid_doc
                              ) I ON I.rowguid_doc = R.rowguid
                ) F
            WHERE
                F.pendiente <> F.total_art - F.total_art_import

        OPEN PENDIENTE_VALIDAR

        DECLARE @pDoc_Num CHAR(20)
        DECLARE @pReng_num INT
        DECLARE @pPendienteNew DECIMAL(18, 5)
        DECLARE @pPendienteOld DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @pDoc_Num, @pReng_num, @pPendienteOld, @pPendienteNew, @Id

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PistaMensaje = 'La nota
```
